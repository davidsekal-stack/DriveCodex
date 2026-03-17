import { useState, useEffect } from "react";
import { useI18n } from "../i18n/index.jsx";

const CONSENT_KEY = "gb_gdprConsent";   // "accepted" | "declined"

export function hasConsent() {
  return localStorage.getItem(CONSENT_KEY) === "accepted";
}

export function getConsentStatus() {
  return localStorage.getItem(CONSENT_KEY);          // null | "accepted" | "declined"
}

export default function ConsentBanner({ t }) {
  const { tr } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner only if user hasn't decided yet
    if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
  };

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: t.bgCard, borderTop: `2px solid ${t.accent}`,
      padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12,
      boxShadow: "0 -4px 24px rgba(0,0,0,0.4)",
    }}>
      <p style={{ margin: 0, fontSize: "0.82rem", color: t.text, lineHeight: 1.5 }}>
        🔒 {tr('consent.text')}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button onClick={decline}
          style={{
            background: "transparent", border: `1px solid ${t.border}`, color: t.textFaint,
            padding: "8px 20px", fontSize: "0.78rem", cursor: "pointer",
            fontFamily: "inherit", borderRadius: 2,
          }}>
          {tr('consent.decline')}
        </button>
        <button onClick={accept}
          style={{
            background: t.accent, border: "none", color: "#fff",
            padding: "8px 24px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
            fontFamily: "inherit", borderRadius: 2,
          }}>
          {tr('consent.accept')}
        </button>
      </div>
    </div>
  );
}
