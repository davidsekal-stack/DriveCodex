/**
 * Statistická karta — label, velká hodnota, volitelný sub-text.
 * Props: label, value, sub, color, t (theme)
 */
const TINY = "0.65rem";

export default function StatCard({ label, value, sub, color, t }) {
  return (
    <div style={{ flex: "1 1 120px", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 4, padding: "14px 16px", minWidth: 120 }}>
      <div style={{ fontSize: TINY, color: t.textFaint, letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 700, color: color || t.accent }}>{value}</div>
      {sub && <div style={{ fontSize: TINY, color: t.textVeryFaint, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
