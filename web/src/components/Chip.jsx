/**
 * Znovupoužitelný chip/badge pro příznaky a OBD kódy.
 * Používáno v SessionTimeline, SharedCaseView, DiagCard.
 */
import { useTheme } from "../contexts/ThemeContext.jsx";

export function SymptomChip({ label }) {
  const { t } = useTheme();
  return (
    <span style={{ padding: "2px 8px", background: t.sympBg, border: `1px solid ${t.sympBorder}`, color: t.sympText, fontSize: "0.76rem", borderRadius: 2 }}>
      {label}
    </span>
  );
}

export function ObdChip({ code }) {
  const { t } = useTheme();
  return (
    <span style={{ padding: "2px 8px", background: t.obdBg, border: `1px solid ${t.obdBorder}`, color: t.obdText, fontSize: "0.76rem", fontFamily: "monospace", borderRadius: 2 }}>
      {code}
    </span>
  );
}
