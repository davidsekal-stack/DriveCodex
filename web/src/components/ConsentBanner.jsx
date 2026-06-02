import { useState } from "react";
import { useI18n } from "../i18n/index.jsx";
import { DARK } from "../theme.js";

const CONSENT_KEY = "gb_gdprConsent";   // "accepted" | "declined"

export function hasConsent() {
  return localStorage.getItem(CONSENT_KEY) === "accepted";
}

export function getConsentStatus() {
  return localStorage.getItem(CONSENT_KEY);          // null | "accepted" | "declined"
}

/**
 * Full-screen consent gate — shown once after first login.
 * Renders instead of the main app until user accepts or declines.
 * Returns null if user already decided (lets app render normally).
 */
export default function ConsentGate({ children }) {
  const { tr } = useI18n();
  const t = DARK;
  const [decided, setDecided] = useState(() => !!localStorage.getItem(CONSENT_KEY));

  if (decided) return children;

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setDecided(true);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setDecided(true);
  };

  return (
    <div style={{
      height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: t.bg, fontFamily: "'Exo 2',sans-serif",
      padding: 20,
    }}>
      <div style={{
        maxWidth: 520, width: "100%", background: t.bgCard,
        border: `1px solid ${t.border}`, borderRadius: 4,
        padding: "32px 28px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 34, height: 34, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", clipPath: "polygon(10% 0%,90% 0%,100% 10%,100% 90%,90% 100%,10% 100%,0% 90%,0% 10%)", flexShrink: 0 }}>
            <span style={{ fontSize: "17px" }}>🔧</span>
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: "1.6rem", fontWeight: 800, color: t.text, letterSpacing: "0.05em" }}>
            DRIVE<span style={{ color: t.accent }}>Codex</span>
          </div>
        </div>

        {/* Title */}
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: t.text, marginBottom: 14, letterSpacing: "0.06em" }}>
          🔒 {tr('consent.title')}
        </div>

        {/* Text */}
        <p style={{ margin: "0 0 20px", fontSize: "0.82rem", color: t.textMuted, lineHeight: 1.7 }}>
          {tr('consent.text')}
        </p>

        {/* Decline note */}
        <p style={{ margin: "0 0 24px", fontSize: "0.72rem", color: t.textVeryFaint, lineHeight: 1.6 }}>
          {tr('consent.declineNote')}
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={decline}
            style={{
              background: "transparent", border: `1px solid ${t.border}`, color: t.textFaint,
              padding: "10px 22px", fontSize: "0.82rem", cursor: "pointer",
              fontFamily: "inherit", borderRadius: 2,
            }}>
            {tr('consent.decline')}
          </button>
          <button onClick={accept} data-testid="consent-accept"
            style={{
              background: t.accent, border: "none", color: "#fff",
              padding: "10px 28px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", borderRadius: 2,
            }}>
            {tr('consent.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
