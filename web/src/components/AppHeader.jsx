import { useTheme } from "../contexts/ThemeContext.jsx";

export default function AppHeader({
  changeLang,
  lang,
  mobile,
  onLogout,
  onToggleSidebar,
  session,
  sidebarOpen,
  tr,
  langs,
}) {
  const { t, darkMode, toggleDarkMode } = useTheme();
  return (
    <header style={{ background: t.bgHeader, borderBottom: `2px solid ${t.accent}`, padding: mobile ? "0 10px" : "0 20px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, boxShadow: darkMode ? "none" : "0 1px 8px rgba(0,0,0,0.07)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: mobile ? 6 : 10 }}>
        {mobile && (
          <button onClick={onToggleSidebar}
            style={{ background: "none", border: "none", color: t.text, fontSize: "1.3rem", cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}>
            {sidebarOpen ? "✕" : "☰"}
          </button>
        )}
        <div style={{ width: 30, height: 30, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", clipPath: "polygon(10% 0%,90% 0%,100% 10%,100% 90%,90% 100%,10% 100%,0% 90%,0% 10%)", flexShrink: 0 }}>
          <span style={{ fontSize: "15px" }}>🔧</span>
        </div>
        <div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: mobile ? "1.2rem" : "1.5rem", fontWeight: 800, color: t.text, letterSpacing: "0.05em", lineHeight: 1 }}>
            DRIVE<span style={{ color: t.accent }}>Codex</span>
          </div>
          {!mobile && <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.1em", lineHeight: 1, marginTop: 1 }}>{tr("app.subtitle")}</div>}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: mobile ? 4 : 8 }}>
        <select value={lang} onChange={(event) => changeLang(event.target.value)}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted, padding: "5px 8px", fontSize: "0.75rem", fontFamily: "inherit", cursor: "pointer", borderRadius: 20, height: 30, outline: "none" }}>
          {langs.map((item) => (
            <option key={item.code} value={item.code}>{item.label}</option>
          ))}
        </select>

        <button onClick={toggleDarkMode}
          style={{ display: "flex", alignItems: "center", gap: 5, background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted, padding: "5px 11px", fontSize: "0.75rem", fontFamily: "inherit", cursor: "pointer", borderRadius: 20, height: 30 }}>
          {darkMode ? (mobile ? "☀" : tr("app.lightMode")) : (mobile ? "☾" : tr("app.darkMode"))}
        </button>

        {!mobile && (
          <span style={{ fontSize: "0.7rem", color: t.textFaint, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {session.user?.email}
          </span>
        )}

        <button onClick={onLogout}
          style={{ display: "flex", alignItems: "center", gap: 5, background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted, padding: "5px 11px", fontSize: "0.75rem", cursor: "pointer", borderRadius: 20, height: 30, fontFamily: "inherit" }}>
          {mobile ? "↗" : tr("app.logout")}
        </button>
      </div>
    </header>
  );
}
