/**
 * Admin Analytics Panel — denní přehledy AI usage, sessions, případy
 * SVG sloupcové grafy, inline styly, theme-aware
 */

import { useState, useEffect, useCallback } from "react";

const FONT = "0.82rem";
const SMALL = "0.7rem";
const TINY = "0.65rem";
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

// ── SVG Bar Chart ──────────────────────────────────────────────────────────────

function BarChart({ data, labelKey, valueKey, color, t, height = 160, formatValue }) {
  if (!data.length) return null;

  const values = data.map((d) => d[valueKey] ?? 0);
  const max = Math.max(...values, 1);
  const barW = Math.max(8, Math.min(28, Math.floor(600 / data.length) - 4));
  const chartW = data.length * (barW + 4) + 40;
  const fmt = formatValue || ((v) => v.toLocaleString());

  return (
    <div style={{ overflowX: "auto", marginBottom: 8 }}>
      <svg width={Math.max(chartW, 300)} height={height + 30} style={{ display: "block" }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={35} y1={height - height * frac}
            x2={chartW} y2={height - height * frac}
            stroke={t.border} strokeDasharray="3,3"
          />
        ))}
        {/* Y-axis labels */}
        {[0, 0.5, 1].map((frac) => (
          <text key={frac} x={32} y={height - height * frac + 4}
            textAnchor="end" fill={t.textVeryFaint} fontSize={9} fontFamily="inherit">
            {fmt(Math.round(max * frac))}
          </text>
        ))}
        {/* Bars */}
        {data.map((d, i) => {
          const val = d[valueKey] ?? 0;
          const barH = (val / max) * height;
          const x = 40 + i * (barW + 4);
          const label = d[labelKey] ?? "";
          // Show day label every few bars to avoid clutter
          const showLabel = data.length <= 15 || i % Math.ceil(data.length / 10) === 0 || i === data.length - 1;
          return (
            <g key={i}>
              <rect
                x={x} y={height - barH}
                width={barW} height={Math.max(barH, 1)}
                fill={color} rx={1} opacity={0.85}
              />
              {/* Tooltip on hover via title */}
              <title>{`${label}: ${fmt(val)}`}</title>
              {showLabel && (
                <text x={x + barW / 2} y={height + 14}
                  textAnchor="middle" fill={t.textVeryFaint} fontSize={8} fontFamily="inherit">
                  {label.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, t }) {
  return (
    <div style={{ flex: "1 1 120px", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 4, padding: "14px 16px", minWidth: 120 }}>
      <div style={{ fontSize: TINY, color: t.textFaint, letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 700, color: color || t.accent }}>{value}</div>
      {sub && <div style={{ fontSize: TINY, color: t.textVeryFaint, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export default function AnalyticsPanel({ t, tr, fetchAnalytics }) {
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
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "1.5rem", fontWeight: 700, color: t.accent, letterSpacing: "0.05em" }}>
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
                sub={todayAi ? `${tr("analytics.today")}: ${todayAi.calls}` : null} color={t.accent} t={t} />
              <StatCard label={tr("analytics.tokens")} value={fmtTok(totalInputTok + totalOutputTok)}
                sub={`${fmtTok(totalInputTok)} in / ${fmtTok(totalOutputTok)} out`} color="#2563eb" t={t} />
              <StatCard label={tr("analytics.activeDays")} value={sessDaily.length}
                sub={todaySess ? `${tr("analytics.today")}: ${todaySess.active_users} ${tr("analytics.users")}` : null} color="#059669" t={t} />
              <StatCard label={tr("analytics.cases")} value={caseStats.total ?? 0}
                sub={`${caseStats.approved ?? 0} ✓  ${caseStats.pending ?? 0} ⏳  ${caseStats.rejected ?? 0} ✕`} color="#d97706" t={t} />
            </div>

            {/* AI calls chart */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: SMALL, fontWeight: 600, color: t.textMuted, marginBottom: 8, letterSpacing: "0.06em" }}>
                {tr("analytics.chartCalls")}
              </div>
              {aiDaily.length > 0
                ? <BarChart data={aiDaily} labelKey="day" valueKey="calls" color={t.accent} t={t} />
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
                    labelKey="day" valueKey="total_tok" color="#2563eb" t={t} formatValue={fmtTok} />
                : <div style={{ fontSize: SMALL, color: t.textVeryFaint, padding: "20px 0" }}>{tr("analytics.noData")}</div>
              }
            </div>

            {/* Active users chart */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: SMALL, fontWeight: 600, color: t.textMuted, marginBottom: 8, letterSpacing: "0.06em" }}>
                {tr("analytics.chartUsers")}
              </div>
              {sessDaily.length > 0
                ? <BarChart data={sessDaily} labelKey="day" valueKey="active_users" color="#059669" t={t} height={120} />
                : <div style={{ fontSize: SMALL, color: t.textVeryFaint, padding: "20px 0" }}>{tr("analytics.noData")}</div>
              }
            </div>
          </>
        )}
      </div>
    </div>
  );
}
