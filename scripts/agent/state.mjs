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

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = join(__dirname, 'agent.db');

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
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
`;

export class AgentState {
  #db;

  constructor(dbPath = DEFAULT_DB_PATH) {
    this.#db = new DatabaseSync(dbPath);
    this.#db.exec('PRAGMA journal_mode=WAL');
    this.#db.exec('PRAGMA foreign_keys=ON');
    this.#migrate();
  }

  #migrate() {
    this.#db.exec(MIGRATIONS);
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
      'cooldown_until',
    ];
    const entries = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (entries.length === 0) return;

    const sets = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    const stmt = this.#db.prepare(`UPDATE forums SET ${sets} WHERE id = ?`);
    stmt.run(...values, id);
  }

  getForumsToProcess(limit = 50) {
    const stmt = this.#db.prepare(
      `SELECT * FROM forums
       WHERE status IN ('discovered', 'queued', 'active')
         AND status NOT IN ('disqualified', 'calibration_failed', 'exhausted')
         AND (cooldown_until IS NULL OR cooldown_until < datetime('now'))
       ORDER BY
         last_crawled_at IS NULL DESC,
         last_crawled_at ASC
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
    const id = sha256(url);
    const stmt = this.#db.prepare(
      `INSERT OR IGNORE INTO threads (id, forum_id, url, title)
       VALUES (?, ?, ?, ?)`
    );
    stmt.run(id, forumId, url, title);
    return id;
  }

  getThread(id) {
    const stmt = this.#db.prepare('SELECT * FROM threads WHERE id = ?');
    return stmt.get(id) ?? null;
  }

  getThreadByUrl(url) {
    const stmt = this.#db.prepare('SELECT * FROM threads WHERE url = ?');
    return stmt.get(url) ?? null;
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

  updateCase(id, fields) {
    const allowed = ['status', 'review_note', 'payload_json'];
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
}
