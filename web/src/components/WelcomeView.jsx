import { useTheme } from "../contexts/ThemeContext.jsx";

export default function WelcomeView({ mobile, onStartNewCase, tr }) {
  const { t } = useTheme();
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: mobile ? "2rem" : "3rem", opacity: 0.07 }}>🔧</div>
      <div style={{ fontSize: "0.8rem", color: t.textFaint, letterSpacing: "0.1em", textAlign: "center", lineHeight: 1.9 }}>
        {tr("app.welcomeText")}<br />{tr("app.welcomeHint")}
      </div>
      <button onClick={onStartNewCase} data-testid="welcome-new-case-btn"
        style={{ background: t.accent, color: "#fff", border: "none", cursor: "pointer", padding: "11px 30px", fontSize: "0.78rem", letterSpacing: "0.12em", fontFamily: "inherit", fontWeight: 700, borderRadius: 2, marginTop: 8 }}>
        {tr("app.newCase")}
      </button>
    </div>
  );
}
