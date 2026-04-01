/**
 * Admin Analytics Panel — denní přehledy AI usage, sessions, případy
 */

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import BarChart from "./BarChart.jsx";
import StatCard from "./StatCard.jsx";
import { FONT, SMALL, TINY } from "../constants/typography.js";
const PROJECT_START = "2026-03-17";

/** Fill missing days with zeroes so all charts have the same x-axis */
function fillDays(sparse, sinceDate, labelKey, defaultRow) {
  const map = new Map(sparse.map((d) => [d[labelKey], d]));
  const start = new Date(sinceDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    result.push(map.get(key) ?? { [labelKey]: key, ...defaultRow });
  }
  return result;
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export default function AnalyticsPanel({ tr, fetchAnalytics }) {
  const { t } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAnalytics(days);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fetchAnalytics, days]);

  useEffect(() => { load(); }, [load]);

  // Aggregate totals from daily data, filling gaps with zeroes
  const sinceDate = data?.since ?? PROJECT_START;
  const aiDaily = fillDays(data?.ai_daily ?? [], sinceDate, "day", { calls: 0, input_tok: 0, output_tok: 0, users: 0 });
  const sessDaily = fillDays(data?.sessions_daily ?? [], sinceDate, "day", { new_sessions: 0, active_users: 0 });
  const caseStats = data?.case_stats ?? {};
  const regUsers = data?.registered_users ?? {};
  const topUsers = data?.top_users ?? [];
  const brandStats = data?.brand_stats ?? [];

  const totalCalls = aiDaily.reduce((s, d) => s + (d.calls ?? 0), 0);
  const totalInputTok = aiDaily.reduce((s, d) => s + (d.input_tok ?? 0), 0);
  const totalOutputTok = aiDaily.reduce((s, d) => s + (d.output_tok ?? 0), 0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAi = aiDaily.find((d) => d.day === todayStr);
  const todaySess = sessDaily.find((d) => d.day === todayStr);

  const fmtTok = (v) => v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + "M" : v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px", background: t.bg }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: "1.5rem", fontWeight: 700, color: t.accent, letterSpacing: "0.05em" }}>
              {tr("analytics.title")}
            </div>
            <div style={{ fontSize: SMALL, color: t.textFaint, marginTop: 2 }}>
              {loading ? tr("analytics.loading") : days === 0 ? tr("analytics.periodMax") : tr("analytics.period", { days })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[7, 14, 30, 0].map((d) => {
              const label = d === 0 ? "Max" : `${d}d`;
              return (
                <button key={d} onClick={() => setDays(d)}
                  style={{
                    background: days === d ? t.accent : t.bgCard,
                    border: `1px solid ${days === d ? t.accent : t.border}`,
                    color: days === d ? "#fff" : t.textMuted,
                    padding: "5px 12px", fontSize: SMALL, cursor: "pointer",
                    fontFamily: "inherit", borderRadius: 2, fontWeight: days === d ? 600 : 400,
                  }}>
                  {label}
                </button>
              );
            })}
            <button onClick={load} disabled={loading}
              style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted, padding: "5px 12px", fontSize: SMALL, cursor: "pointer", fontFamily: "inherit", borderRadius: 2 }}>
              ↻
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 14, padding: "10px 13px", background: "rgba(220,38,38,0.08)", border: "1px solid #dc2626", color: "#dc2626", fontSize: FONT, borderRadius: 2 }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: t.textFaint, fontSize: FONT }}>
            {tr("analytics.loading")}
          </div>
        )}

        {!loading && data && (
          <>
            {/* Stat cards */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
              <StatCard label={tr("analytics.totalCalls")} value={totalCalls.toLocaleString()}
                sub={todayAi ? `${tr("analytics.today")}: ${todayAi.calls}` : null} color={t.accent} />
              <StatCard label={tr("analytics.tokens")} value={fmtTok(totalInputTok + totalOutputTok)}
                sub={`${fmtTok(totalInputTok)} in / ${fmtTok(totalOutputTok)} out`} color="#2563eb" />
              <StatCard label={tr("analytics.activeDays")} value={sessDaily.length}
                sub={todaySess ? `${tr("analytics.today")}: ${todaySess.active_users} ${tr("analytics.users")}` : null} color="#059669" />
              <StatCard label={tr("analytics.cases")} value={caseStats.total ?? 0}
                sub={`${caseStats.approved ?? 0} ✓  ${caseStats.pending ?? 0} ⏳  ${caseStats.rejected ?? 0} ✕`} color="#d97706" />
              <StatCard label={tr("analytics.registeredUsers")} value={regUsers.total_users ?? 0}
                sub={`${tr("analytics.new7d")}: +${regUsers.users_7d ?? 0}  ${tr("analytics.new30d")}: +${regUsers.users_30d ?? 0}`} color="#7c3aed" />
            </div>

            {/* AI calls chart */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: SMALL, fontWeight: 600, color: t.textMuted, marginBottom: 8, letterSpacing: "0.06em" }}>
                {tr("analytics.chartCalls")}
              </div>
              {aiDaily.length > 0
                ? <BarChart data={aiDaily} labelKey="day" valueKey="calls" color={t.accent} />
                : <div style={{ fontSize: SMALL, color: t.textVeryFaint, padding: "20px 0" }}>{tr("analytics.noData")}</div>
              }
            </div>

            {/* Token consumption chart */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: SMALL, fontWeight: 600, color: t.textMuted, marginBottom: 8, letterSpacing: "0.06em" }}>
                {tr("analytics.chartTokens")}
              </div>
              {aiDaily.length > 0
                ? <BarChart data={aiDaily.map((d) => ({ ...d, total_tok: (d.input_tok ?? 0) + (d.output_tok ?? 0) }))}
                    labelKey="day" valueKey="total_tok" color="#2563eb" formatValue={fmtTok} />
                : <div style={{ fontSize: SMALL, color: t.textVeryFaint, padding: "20px 0" }}>{tr("analytics.noData")}</div>
              }
            </div>

            {/* Active users chart */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: SMALL, fontWeight: 600, color: t.textMuted, marginBottom: 8, letterSpacing: "0.06em" }}>
                {tr("analytics.chartUsers")}
              </div>
              {sessDaily.length > 0
                ? <BarChart data={sessDaily} labelKey="day" valueKey="active_users" color="#059669" height={120} />
                : <div style={{ fontSize: SMALL, color: t.textVeryFaint, padding: "20px 0" }}>{tr("analytics.noData")}</div>
              }
            </div>

            {/* Brand stats */}
            {brandStats.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: SMALL, fontWeight: 600, color: t.textMuted, marginBottom: 8, letterSpacing: "0.06em" }}>
                  {tr("analytics.brandStats")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {brandStats.map((b) => {
                    const maxSess = brandStats[0]?.sessions ?? 1;
                    const pct = Math.round((b.sessions / maxSess) * 100);
                    const opacity = 0.3 + 0.7 * (pct / 100);
                    return (
                      <div key={b.brand} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 12px", background: t.bgCard,
                        border: `1px solid ${t.border}`, borderRadius: 2,
                        minWidth: 170,
                      }}>
                        <span style={{ fontSize: FONT, fontWeight: 600, color: t.text, opacity, flex: 1 }}>{b.brand}</span>
                        <span style={{ fontSize: TINY, color: t.textMuted, fontWeight: 600 }} title={tr("analytics.brandSessions")}>{b.sessions}</span>
                        {b.closed_cases > 0 && (
                          <span style={{ fontSize: TINY, color: "#059669", fontWeight: 600 }} title={tr("analytics.brandClosed")}>{b.closed_cases} ✓</span>
                        )}
                        <div style={{ width: 40, height: 5, background: t.bgMuted, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: t.accent, borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top users table */}
            {topUsers.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: SMALL, fontWeight: 600, color: t.textMuted, marginBottom: 8, letterSpacing: "0.06em" }}>
                  {tr("analytics.topUsers")}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: SMALL }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `2px solid ${t.border}`, color: t.textFaint, fontSize: TINY, letterSpacing: "0.06em" }}>#</th>
                      <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `2px solid ${t.border}`, color: t.textFaint, fontSize: TINY, letterSpacing: "0.06em" }}>{tr("analytics.user")}</th>
                      <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: `2px solid ${t.border}`, color: t.textFaint, fontSize: TINY, letterSpacing: "0.06em" }}>{tr("analytics.topCalls")}</th>
                      <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: `2px solid ${t.border}`, color: t.textFaint, fontSize: TINY, letterSpacing: "0.06em" }}>{tr("analytics.topTokens")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topUsers.map((u, i) => {
                      const maxTok = topUsers[0]?.total_tok ?? 1;
                      const pct = Math.round((u.total_tok / maxTok) * 100);
                      return (
                        <tr key={u.user_id} style={{ background: i % 2 === 0 ? "transparent" : t.bgMuted }}>
                          <td style={{ padding: "7px 10px", color: t.textVeryFaint, fontWeight: 600 }}>{i + 1}</td>
                          <td style={{ padding: "7px 10px", color: t.text }}>
                            <div>{u.user_email}</div>
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right", color: t.textMuted }}>{u.calls}</td>
                          <td style={{ padding: "7px 10px", textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                              <div style={{ width: 60, height: 6, background: t.bgMuted, borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: "#7c3aed", borderRadius: 3 }} />
                              </div>
                              <span style={{ color: t.text, fontWeight: 600, minWidth: 40, textAlign: "right" }}>{fmtTok(u.total_tok)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
