import { useState } from "react";
import ModalShell from "./ModalShell.jsx";

const FONT = "0.85rem";

const TOS_POINTS = [
  { title: "tos.aiDisclaimer", desc: "tos.aiDisclaimerDesc" },
  { title: "tos.liability",    desc: "tos.liabilityDesc" },
  { title: "tos.dataUsage",    desc: "tos.dataUsageDesc" },
  { title: "tos.privacy",      desc: "tos.privacyDesc" },
  { title: "tos.law",          desc: "tos.lawDesc" },
];

export default function TosModal({ onAccept, onDecline, t, tr }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <ModalShell onClose={onDecline} width={520}>
      <div style={{ background: t.bgModal, border: `1px solid ${t.border}`, borderRadius: 4, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.35)", maxHeight: "85vh", overflowY: "auto" }}>

        {/* Title */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "1.4rem", fontWeight: 700, color: t.text }}>
            {tr("tos.title")}
          </div>
        </div>

        <p style={{ fontSize: FONT, color: t.textMuted, marginBottom: 16, lineHeight: 1.7 }}>
          {tr("tos.intro")}
        </p>

        {/* Key points box */}
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 2, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: t.text, marginBottom: 12 }}>
            {tr("tos.keyPoints")}
          </div>

          {TOS_POINTS.map((point, i) => (
            <div key={i} style={{ marginBottom: i < TOS_POINTS.length - 1 ? 14 : 0 }}>
              <div style={{ fontSize: FONT, color: t.text }}>
                <strong>{tr(point.title)}</strong>
                {" — "}
                {tr(point.desc)}
              </div>
            </div>
          ))}
        </div>

        {/* Checkbox */}
        <label
          onClick={() => setAgreed((prev) => !prev)}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 20, padding: "8px 0" }}
        >
          <span style={{
            width: 18, height: 18, borderRadius: 3, flexShrink: 0,
            border: `2px solid ${agreed ? t.doneStatusColor : t.border}`,
            background: agreed ? t.doneStatusColor : "transparent",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}>
            {agreed && <span style={{ color: "#fff", fontSize: "0.75rem", lineHeight: 1, fontWeight: 700 }}>&#10003;</span>}
          </span>
          <span style={{ fontSize: FONT, color: t.text, fontWeight: 600 }}>
            {tr("tos.agree")}
          </span>
        </label>

        {/* Buttons */}
        <button
          disabled={!agreed}
          onClick={onAccept}
          style={{
            width: "100%", padding: "12px", fontSize: FONT, fontWeight: 700,
            fontFamily: "inherit", borderRadius: 2, border: "none", marginBottom: 10,
            background: agreed ? t.doneStatusColor : t.border,
            color: agreed ? "#fff" : t.textVeryFaint,
            cursor: agreed ? "pointer" : "not-allowed",
            transition: "all 0.15s",
          }}
        >
          {tr("tos.accept")}
        </button>

        <div
          onClick={onDecline}
          style={{ textAlign: "center", fontSize: "0.78rem", color: t.textFaint, cursor: "pointer", padding: "6px 0" }}
        >
          {tr("tos.decline")}
        </div>
      </div>
    </ModalShell>
  );
}
