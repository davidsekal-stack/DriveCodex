/**
 * SQLite state manager for the autonomous crawl agent.
 * Requires Node.js 24+ with --experimental-sqlite flag.
 *
 * Usage:
 *   import { AgentState } from './state.mjs';
 *   const state = new AgentState();
 */

import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { canonicalizeThreadUrl } from './url-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = join(__dirname, 'agent.db');

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

const THREAD_STATUS_PRIORITY = {
  extracted: 40,
  discarded: 30,
  error: 20,
  pending: 10,
};

// Must stay aligned with calibrate.mjs MAX_ATTEMPTS.
const CALIBRATION_FINAL_FAILURE_ATTEMPTS = 3;

const CASE_STATUS_PRIORITY = {
  imported: 90,
  import_ready: 80,
  verified: 70,
  ai_approved: 60,
  crosscheck_error: 50,
  import_failed: 40,
  verify_error: 30,
  verify_skipped: 20,
  verify_rejected: 10,
  crosscheck_dupe: 5,
};

function threadPriority(thread) {
  return THREAD_STATUS_PRIORITY[thread.status] ?? 0;
}

function casePriority(caseRow) {
  return CASE_STATUS_PRIORITY[caseRow.status] ?? 0;
}

function normalizeCaseIdentity(value) {
  return (value ?? '').toString().trim().toLowerCase();
}

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS forums (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  name TEXT,
  brand TEXT,
  language TEXT DEFAULT 'en',
  parser TEXT DEFAULT 'unknown',
  status TEXT DEFAULT 'discovered',
  sections_json TEXT DEFAULT '[]',
  threads_found INTEGER DEFAULT 0,
  threads_crawled INTEGER DEFAULT 0,
  new_threads_last_batch INTEGER DEFAULT 0,
  cases_total INTEGER DEFAULT 0,
  calibration_json TEXT DEFAULT '{}',
  calibration_status TEXT DEFAULT 'pending',
  calibration_attempts INTEGER DEFAULT 0,
  cooldown_until TEXT,
  last_crawled_at TEXT,
  diary_md TEXT,
  priority_score REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  forum_id TEXT REFERENCES forums(id),
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  status TEXT DEFAULT 'pending',
  discard_reason TEXT,
  thread_text TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  thread_id TEXT REFERENCES threads(id),
  payload_json TEXT NOT NULL,
  status TEXT DEFAULT 'ai_approved',
  review_note TEXT,
  verify_attempts INTEGER DEFAULT 0,
  crosscheck_attempts INTEGER DEFAULT 0,
  import_attempts INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  threads_processed INTEGER DEFAULT 0,
  cases_extracted INTEGER DEFAULT 0,
  cases_verified INTEGER DEFAULT 0,
  cases_imported INTEGER DEFAULT 0,
  mode TEXT,
  stop_reason TEXT
);

CREATE TABLE IF NOT EXISTS agent_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT DEFAULT (datetime('now')),
  level TEXT NOT NULL,
  phase TEXT,
  message TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_meta (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Nightly metrics time-series (long format) written by the daily coach.
-- One row per (night date, scope, metric); scope='global' or a forum id.
-- Long format = adding a new metric never needs a schema change, and a single
-- metric's trend over time is one query. Source of truth for measuring evolution.
CREATE TABLE IF NOT EXISTS crawl_metrics (
  date TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global',
  metric TEXT NOT NULL,
  value REAL,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (date, scope, metric)
);
`;

export class AgentState {
  #db;
  #readOnly = false;

  constructor(dbPath = DEFAULT_DB_PATH, options = {}) {
    this.#readOnly = options.readOnly === true;
    this.#db = new DatabaseSync(dbPath, { readOnly: this.#readOnly });
    if (!this.#readOnly) {
      this.#db.exec('PRAGMA journal_mode=WAL');
      this.#db.exec('PRAGMA foreign_keys=ON');
      this.#migrate();
    }
  }

  #migrate() {
    this.#db.exec(MIGRATIONS);
    // Incremental column additions for existing databases
    const alterations = [
      'ALTER TABLE forums ADD COLUMN diary_md TEXT',
      'ALTER TABLE runs ADD COLUMN stop_reason TEXT',
      'ALTER TABLE cases ADD COLUMN verify_attempts INTEGER DEFAULT 0',
      'ALTER TABLE cases ADD COLUMN crosscheck_attempts INTEGER DEFAULT 0',
      'ALTER TABLE cases ADD COLUMN import_attempts INTEGER DEFAULT 0',
      'ALTER TABLE forums ADD COLUMN priority_score REAL DEFAULT 0',
    ];
    for (const sql of alterations) {
      try { this.#db.exec(sql); } catch { /* column already exists */ }
    }
    this.#repairLegacyState();
  }

  close() {
    this.#db.close();
  }

  // ── Forums ──────────────────────────────────────────────

  addForum({ url, name = null, brand = null, language = 'en', parser = 'unknown' }) {
    const id = sha256(url);
    const stmt = this.#db.prepare(
      `INSERT OR IGNORE INTO forums (id, url, name, brand, language, parser)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    stmt.run(id, url, name, brand, language, parser);
    return id;
  }

  getForum(id) {
    const stmt = this.#db.prepare('SELECT * FROM forums WHERE id = ?');
    return stmt.get(id) ?? null;
  }

  getForumByUrl(url) {
    const stmt = this.#db.prepare('SELECT * FROM forums WHERE url = ?');
    return stmt.get(url) ?? null;
  }

  /**
   * Check if any forum with the same hostname already exists.
   * Prevents duplicate crawls of different sections of the same domain.
   */
  getForumsByDomain(url) {
    let hostname;
    try { hostname = new URL(url).hostname; } catch { return []; }
    const stmt = this.#db.prepare(
      `SELECT * FROM forums WHERE url LIKE ?`
    );
    return stmt.all(`%${hostname}%`);
  }

  updateForum(id, fields) {
    const allowed = [
      'name', 'brand', 'language', 'parser', 'status',
      'sections_json', 'threads_found', 'threads_crawled',
      'new_threads_last_batch', 'cases_total', 'last_crawled_at',
      'calibration_json', 'calibration_status', 'calibration_attempts',
      'cooldown_until', 'diary_md', 'priority_score',
    ];
    const entries = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (entries.length === 0) return;

    const sets = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    const stmt = this.#db.prepare(`UPDATE forums SET ${sets} WHERE id = ?`);
    stmt.run(...values, id);
  }

  /**
   * Store an LLM-written diary entry for a forum.
   */
  setForumDiary(forumId, diaryMd) {
    const stmt = this.#db.prepare('UPDATE forums SET diary_md = ? WHERE id = ?');
    stmt.run(diaryMd, forumId);
  }

  /**
   * Return diary entries from forums with a similar parser type and/or language.
   * Used to inject past lessons into Phase 0 prompts for new forums.
   */
  getRelevantDiaries({ parser = null, language = null, limit = 3 } = {}) {
    let where = 'diary_md IS NOT NULL AND diary_md != \'\'';
    const params = [];
    if (parser) { where += ' AND parser = ?'; params.push(parser); }
    if (language) { where += ' AND language = ?'; params.push(language); }
    params.push(limit);
    const stmt = this.#db.prepare(
      `SELECT name, url, parser, language, diary_md FROM forums
       WHERE ${where}
       ORDER BY last_crawled_at DESC
       LIMIT ?`
    );
    return stmt.all(...params);
  }

  getForumsToProcess(limit = 50) {
    const stmt = this.#db.prepare(
      `SELECT * FROM forums
       WHERE status IN ('discovered', 'queued', 'active', 'exhausted')
         AND status NOT IN ('disqualified', 'calibration_failed')
         AND (cooldown_until IS NULL OR cooldown_until < datetime('now'))
       ORDER BY
         last_crawled_at IS NULL DESC,
         COALESCE(priority_score, 0) DESC,
         last_crawled_at ASC
       LIMIT ?`
    );
    return stmt.all(limit);
  }

  getForumsPendingCalibration(limit = 10) {
    const stmt = this.#db.prepare(
      `SELECT * FROM forums
       WHERE status IN ('discovered', 'queued', 'active', 'exhausted')
         AND status NOT IN ('disqualified', 'calibration_failed')
         AND (calibration_status IS NULL OR calibration_status = 'pending')
         AND (cooldown_until IS NULL OR cooldown_until < datetime('now'))
       ORDER BY
         COALESCE(calibration_attempts, 0) ASC,
         created_at ASC
       LIMIT ?`
    );
    return stmt.all(limit);
  }

  /**
   * Count how many threads for this forum have already been processed
   * (any status other than 'pending').
   */
  countCrawledThreads(forumId) {
    const stmt = this.#db.prepare(
      `SELECT COUNT(*) as count FROM threads
       WHERE forum_id = ? AND status != 'pending'`
    );
    return stmt.get(forumId)?.count ?? 0;
  }

  /**
   * Count cases produced from a forum's threads.
   */
  countForumCases(forumId) {
    const stmt = this.#db.prepare(
      `SELECT COUNT(*) as count FROM cases c
       JOIN threads t ON c.thread_id = t.id
       WHERE t.forum_id = ?`
    );
    return stmt.get(forumId)?.count ?? 0;
  }

  // ── Threads ─────────────────────────────────────────────

  addThread({ forumId, url, title = null }) {
    const canonicalUrl = canonicalizeThreadUrl(url);
    const existing = this.#db.prepare('SELECT id FROM threads WHERE url = ?').get(canonicalUrl);
    if (existing?.id) return existing.id;
    const id = sha256(canonicalUrl);
    const stmt = this.#db.prepare(
      `INSERT OR IGNORE INTO threads (id, forum_id, url, title)
       VALUES (?, ?, ?, ?)`
    );
    stmt.run(id, forumId, canonicalUrl, title);
    return id;
  }

  getThread(id) {
    const stmt = this.#db.prepare('SELECT * FROM threads WHERE id = ?');
    return stmt.get(id) ?? null;
  }

  getThreadByUrl(url) {
    const canonicalUrl = canonicalizeThreadUrl(url);
    const stmt = this.#db.prepare('SELECT * FROM threads WHERE url = ?');
    return stmt.get(canonicalUrl) ?? null;
  }

  updateThread(id, fields) {
    const allowed = ['title', 'status', 'discard_reason', 'thread_text', 'forum_id'];
    const entries = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (entries.length === 0) return;

    const sets = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    const stmt = this.#db.prepare(`UPDATE threads SET ${sets} WHERE id = ?`);
    stmt.run(...values, id);
  }

  getPendingThreads(limit = 50) {
    const stmt = this.#db.prepare(
      `SELECT * FROM threads WHERE status = 'pending'
       ORDER BY created_at LIMIT ?`
    );
    return stmt.all(limit);
  }

  getClassifiedThreads(limit = 50) {
    const stmt = this.#db.prepare(
      `SELECT * FROM threads WHERE status = 'classified'
       ORDER BY created_at LIMIT ?`
    );
    return stmt.all(limit);
  }

  getExtractedThreads(limit = 50) {
    const stmt = this.#db.prepare(
      `SELECT * FROM threads WHERE status = 'extracted'
       ORDER BY created_at LIMIT ?`
    );
    return stmt.all(limit);
  }

  countThreadsByStatus() {
    const stmt = this.#db.prepare(
      'SELECT status, COUNT(*) as count FROM threads GROUP BY status'
    );
    const rows = stmt.all();
    const result = {};
    for (const row of rows) {
      result[row.status] = row.count;
    }
    return result;
  }

  // ── Cases ───────────────────────────────────────────────

  addCase({ id, threadId, payload }) {
    const payloadJson = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const stmt = this.#db.prepare(
      `INSERT OR IGNORE INTO cases (id, thread_id, payload_json)
       VALUES (?, ?, ?)`
    );
    stmt.run(id, threadId, payloadJson);
    return id;
  }

  getCase(id) {
    const stmt = this.#db.prepare('SELECT * FROM cases WHERE id = ?');
    return stmt.get(id) ?? null;
  }

  getCasesForThread(threadId, excludeCaseId = null) {
    if (excludeCaseId) {
      return this.#db.prepare(
        'SELECT * FROM cases WHERE thread_id = ? AND id != ? ORDER BY created_at'
      ).all(threadId, excludeCaseId);
    }
    return this.#db.prepare(
      'SELECT * FROM cases WHERE thread_id = ? ORDER BY created_at'
    ).all(threadId);
  }

  updateCase(id, fields) {
    const allowed = [
      'status',
      'review_note',
      'payload_json',
      'verify_attempts',
      'crosscheck_attempts',
      'import_attempts',
    ];
    const entries = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (entries.length === 0) return;

    const sets = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    const stmt = this.#db.prepare(`UPDATE cases SET ${sets} WHERE id = ?`);
    stmt.run(...values, id);
  }

  getCasesByStatus(status, limit = 100) {
    const stmt = this.#db.prepare(
      `SELECT * FROM cases WHERE status = ?
       ORDER BY created_at LIMIT ?`
    );
    return stmt.all(status, limit);
  }

  getCasesForVerification(limit = 100, maxRetryAttempts = 3) {
    const stmt = this.#db.prepare(
      `SELECT * FROM cases
       WHERE status = 'ai_approved'
          OR (status = 'verify_error' AND verify_attempts < ?)
       ORDER BY
         CASE WHEN status = 'ai_approved' THEN 0 ELSE 1 END,
         created_at
       LIMIT ?`
    );
    return stmt.all(maxRetryAttempts, limit);
  }

  getCasesForCrosscheck(limit = 100, maxRetryAttempts = 3) {
    const stmt = this.#db.prepare(
      `SELECT * FROM cases
       WHERE status = 'verified'
          OR (status = 'crosscheck_error' AND crosscheck_attempts < ?)
       ORDER BY
         CASE WHEN status = 'verified' THEN 0 ELSE 1 END,
         created_at
       LIMIT ?`
    );
    return stmt.all(maxRetryAttempts, limit);
  }

  getCasesForImport(limit = 100, maxRetryAttempts = 3) {
    const stmt = this.#db.prepare(
      `SELECT * FROM cases
       WHERE status = 'import_ready'
          OR (status = 'import_failed' AND import_attempts < ?)
       ORDER BY
         CASE WHEN status = 'import_ready' THEN 0 ELSE 1 END,
         created_at
       LIMIT ?`
    );
    return stmt.all(maxRetryAttempts, limit);
  }

  countCasesByStatus() {
    const stmt = this.#db.prepare(
      'SELECT status, COUNT(*) as count FROM cases GROUP BY status'
    );
    const rows = stmt.all();
    const result = {};
    for (const row of rows) {
      result[row.status] = row.count;
    }
    return result;
  }

  // ── Runs ────────────────────────────────────────────────

  startRun(mode = 'full') {
    const stmt = this.#db.prepare('INSERT INTO runs (mode) VALUES (?)');
    const result = stmt.run(mode);
    return Number(result.lastInsertRowid);
  }

  finishRun(runId, stats = {}, stopReason = null) {
    const stmt = this.#db.prepare(
      `UPDATE runs SET
         finished_at = datetime('now'),
         threads_processed = ?,
         cases_extracted = ?,
         cases_verified = ?,
         cases_imported = ?,
         stop_reason = ?
       WHERE id = ?`
    );
    stmt.run(
      stats.threads_processed ?? 0,
      stats.cases_extracted ?? 0,
      stats.cases_verified ?? 0,
      stats.cases_imported ?? 0,
      stopReason,
      runId,
    );
  }

  // ── Agent meta (agent-wide key/value: pause_until, last_success_at, …) ──

  getMeta(key) {
    // try/catch: read-only connections skip migrations, so the table may
    // not exist yet on old databases opened with --stats
    try {
      const row = this.#db.prepare('SELECT value FROM agent_meta WHERE key = ?').get(key);
      return row?.value ?? null;
    } catch {
      return null;
    }
  }

  setMeta(key, value) {
    this.#db.prepare(
      `INSERT INTO agent_meta (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).run(key, value);
  }

  deleteMeta(key) {
    try {
      this.#db.prepare('DELETE FROM agent_meta WHERE key = ?').run(key);
    } catch { /* table may not exist on legacy DBs */ }
  }

  // ── Nightly metrics (daily coach) ───────────────────────

  /** Upsert one metric value for a night. Idempotent per (date, scope, metric). */
  recordMetric(date, metric, value, scope = 'global') {
    this.#db.prepare(
      `INSERT INTO crawl_metrics (date, scope, metric, value, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(date, scope, metric) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).run(date, scope, metric, value);
  }

  /** Time-series for one metric, oldest→newest. For trend measurement. */
  getMetricSeries(metric, scope = 'global', limit = 90) {
    try {
      return this.#db.prepare(
        `SELECT date, value FROM crawl_metrics WHERE metric = ? AND scope = ?
         ORDER BY date DESC LIMIT ?`
      ).all(metric, scope, limit).reverse();
    } catch {
      return [];
    }
  }

  /** All metrics for one night, as a {metric: value} map (scope='global'). */
  getMetricsForDate(date, scope = 'global') {
    try {
      const rows = this.#db.prepare(
        'SELECT metric, value FROM crawl_metrics WHERE date = ? AND scope = ?'
      ).all(date, scope);
      return Object.fromEntries(rows.map(r => [r.metric, r.value]));
    } catch {
      return {};
    }
  }

  // ── Agent log ───────────────────────────────────────────

  log(level, message, phase = null) {
    const stmt = this.#db.prepare(
      'INSERT INTO agent_log (level, phase, message) VALUES (?, ?, ?)'
    );
    stmt.run(level, phase, message);
  }

  getRecentLogs(limit = 50) {
    const stmt = this.#db.prepare(
      'SELECT * FROM agent_log ORDER BY id DESC LIMIT ?'
    );
    return stmt.all(limit).reverse();
  }

  getLastRun() {
    const stmt = this.#db.prepare(
      'SELECT * FROM runs ORDER BY id DESC LIMIT 1'
    );
    return stmt.get() ?? null;
  }

  // ── Windowed reads (daily coach OBSERVE) ────────────────
  // created_at / started_at are UTC 'YYYY-MM-DD HH:MM:SS'; pass a matching cutoff.

  getThreadsCreatedSince(cutoff) {
    return this.#db.prepare(
      'SELECT id, forum_id, status, discard_reason, created_at FROM threads WHERE created_at >= ?'
    ).all(cutoff);
  }

  getCasesCreatedSince(cutoff) {
    return this.#db.prepare(
      'SELECT id, thread_id, status, review_note, payload_json, created_at FROM cases WHERE created_at >= ?'
    ).all(cutoff);
  }

  getRunsSince(cutoff) {
    return this.#db.prepare(
      'SELECT * FROM runs WHERE started_at >= ? ORDER BY id'
    ).all(cutoff);
  }

  // ── Stats ───────────────────────────────────────────────

  getAllForums() {
    const stmt = this.#db.prepare('SELECT * FROM forums ORDER BY created_at');
    return stmt.all();
  }

  getStats() {
    const forumCount = this.#db.prepare('SELECT COUNT(*) as count FROM forums').get();
    return {
      forums: forumCount.count,
      forums_detail: this.getAllForums(),
      threads_by_status: this.countThreadsByStatus(),
      cases_by_status: this.countCasesByStatus(),
      last_run: this.getLastRun(),
    };
  }

  #repairLegacyState() {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      this.#repairLegacyThreads();
      this.#repairLegacyCases();
      this.#repairCalibrationState();
      this.#db.exec('COMMIT');
    } catch (err) {
      this.#db.exec('ROLLBACK');
      throw err;
    }
  }

  #repairLegacyThreads() {
    const threads = this.#db.prepare(
      `SELECT id, forum_id, url, title, status, discard_reason, thread_text, created_at
       FROM threads
       ORDER BY created_at, id`
    ).all();

    const groups = new Map();
    for (const thread of threads) {
      const canonicalUrl = canonicalizeThreadUrl(thread.url);
      if (!groups.has(canonicalUrl)) groups.set(canonicalUrl, []);
      groups.get(canonicalUrl).push({ ...thread, canonicalUrl });
    }

    const updateThread = this.#db.prepare(
      `UPDATE threads
       SET url = ?, title = ?, status = ?, discard_reason = ?, thread_text = ?
       WHERE id = ?`
    );
    const moveCases = this.#db.prepare('UPDATE cases SET thread_id = ? WHERE thread_id = ?');
    const deleteThread = this.#db.prepare('DELETE FROM threads WHERE id = ?');

    for (const [canonicalUrl, rows] of groups) {
      const primary = rows
        .slice()
        .sort((a, b) =>
          threadPriority(b) - threadPriority(a) ||
          ((b.thread_text?.length ?? 0) - (a.thread_text?.length ?? 0)) ||
          ((b.title?.length ?? 0) - (a.title?.length ?? 0)) ||
          Number(b.url === canonicalUrl) - Number(a.url === canonicalUrl) ||
          String(a.created_at).localeCompare(String(b.created_at)) ||
          String(a.id).localeCompare(String(b.id))
        )[0];

      const mergedTitle = rows
        .map(row => row.title)
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0] ?? null;
      const mergedThreadText = rows
        .map(row => row.thread_text)
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0] ?? null;
      const mergedDiscardReason = rows.find(row => row.discard_reason)?.discard_reason ?? null;

      for (const duplicate of rows) {
        if (duplicate.id === primary.id) continue;
        moveCases.run(primary.id, duplicate.id);
        deleteThread.run(duplicate.id);
      }

      updateThread.run(
        canonicalUrl,
        mergedTitle,
        primary.status,
        mergedDiscardReason,
        mergedThreadText,
        primary.id,
      );
    }
  }

  #repairLegacyCases() {
    const threads = this.#db.prepare('SELECT id, url FROM threads').all();
    const threadUrlById = new Map(threads.map(thread => [thread.id, thread.url]));

    const cases = this.#db.prepare(
      `SELECT id, thread_id, payload_json, status, review_note,
              verify_attempts, crosscheck_attempts, import_attempts, created_at
       FROM cases
       ORDER BY created_at, id`
    ).all();

    const updateCaseRow = this.#db.prepare(
      `UPDATE cases
       SET thread_id = ?, payload_json = ?, status = ?, review_note = ?,
           verify_attempts = ?, crosscheck_attempts = ?, import_attempts = ?
       WHERE id = ?`
    );
    const deleteCase = this.#db.prepare('DELETE FROM cases WHERE id = ?');

    const groups = new Map();
    for (const caseRow of cases) {
      let payload = {};
      try {
        payload = JSON.parse(caseRow.payload_json || '{}') || {};
      } catch {
        payload = {};
      }

      const threadUrl = threadUrlById.get(caseRow.thread_id) || payload.thread_url || '';
      const canonicalThreadUrl = canonicalizeThreadUrl(threadUrl);

      if (canonicalThreadUrl) {
        payload.thread_url = canonicalThreadUrl;
        if (typeof payload.source_ref === 'string' && payload.source_ref.startsWith('agent:thread:')) {
          payload.source_ref = `agent:thread:${canonicalThreadUrl}`;
        }
      }

      updateCaseRow.run(
        caseRow.thread_id,
        JSON.stringify(payload),
        caseRow.status,
        caseRow.review_note,
        caseRow.verify_attempts ?? 0,
        caseRow.crosscheck_attempts ?? 0,
        caseRow.import_attempts ?? 0,
        caseRow.id,
      );

      const duplicateKey = [
        canonicalThreadUrl,
        normalizeCaseIdentity(payload.case_author),
      ].join('|');

      if (!canonicalThreadUrl || !normalizeCaseIdentity(payload.case_author)) {
        continue;
      }

      if (!groups.has(duplicateKey)) groups.set(duplicateKey, []);
      groups.get(duplicateKey).push({
        ...caseRow,
        payload,
        canonicalThreadUrl,
      });
    }

    for (const rows of groups.values()) {
      if (rows.length < 2) continue;

      const primary = rows
        .slice()
        .sort((a, b) =>
          casePriority(b) - casePriority(a) ||
          ((b.review_note?.length ?? 0) - (a.review_note?.length ?? 0)) ||
          String(a.created_at).localeCompare(String(b.created_at)) ||
          String(a.id).localeCompare(String(b.id))
        )[0];

      for (const duplicate of rows) {
        if (duplicate.id === primary.id) continue;
        deleteCase.run(duplicate.id);
      }
    }
  }

  #repairCalibrationState() {
    // Historical bug: quota/interruption inside phaseCalibrate marked forums as
    // calibration_failed even when the calibration loop had not exhausted all attempts.
    // Those forums should remain retryable.
    this.#db.prepare(
      `UPDATE forums
       SET status = 'discovered',
           calibration_status = 'pending'
       WHERE status = 'calibration_failed'
         AND calibration_status = 'failed'
         AND COALESCE(calibration_attempts, 0) < ?`
    ).run(CALIBRATION_FINAL_FAILURE_ATTEMPTS);

    // A successfully crawled forum must stay calibrated or it becomes invisible
    // to future crawl batches even though it already proved crawlable.
    this.#db.prepare(
      `UPDATE forums
       SET calibration_status = 'calibrated'
       WHERE status IN ('queued', 'active', 'exhausted')
         AND COALESCE(calibration_status, '') != 'calibrated'`
    ).run();
  }
}
