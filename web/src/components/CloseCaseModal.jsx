import ModalShell from "./ModalShell.jsx";

export default function CloseCaseModal({
  closeError,
  mobile,
  onCancel,
  onChangeResolution,
  onConfirm,
  resolution,
  t,
  tr,
}) {
  return (
    <ModalShell onClose={onCancel} width={500}>
      <div style={{ background: t.bgModal, border: `1px solid ${t.border}`, borderRadius: 4, padding: mobile ? "16px" : "26px", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "1.4rem", fontWeight: 700, color: t.doneStatusColor, marginBottom: 8 }}>{tr("app.closeCaseTitle")}</div>
        <p style={{ fontSize: "0.85rem", color: t.textMuted, marginBottom: 16, lineHeight: 1.7 }}>
          {tr("app.closeCaseHelp")}
        </p>
        <div style={{ fontSize: "0.68rem", color: t.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>{tr("app.repairLabel")}</div>
        <textarea value={resolution} onChange={(event) => onChangeResolution(event.target.value)} autoFocus rows={5}
          placeholder={tr("app.repairPlaceholder")}
          style={{ width: "100%", background: t.bgInput, border: `1px solid ${closeError ? "#dc2626" : t.borderInput}`, color: t.text, padding: "10px 12px", fontSize: "0.88rem", lineHeight: 1.7, marginBottom: closeError ? 8 : 16, fontFamily: "'IBM Plex Mono',monospace", resize: "vertical", outline: "none", borderRadius: 2 }} />
        {closeError && (
          <div style={{ fontSize: "0.8rem", color: "#dc2626", marginBottom: 12, padding: "6px 10px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 2 }}>
            ⚠ {closeError}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel}
            style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textFaint, padding: "8px 20px", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", borderRadius: 2 }}>
            {tr("app.cancel")}
          </button>
          <button disabled={!resolution.trim()} onClick={onConfirm}
            style={{ background: resolution.trim() ? t.doneStatusColor : "transparent", color: resolution.trim() ? "#fff" : t.textVeryFaint, border: `1px solid ${resolution.trim() ? t.doneStatusColor : t.border}`, padding: "8px 24px", fontSize: "0.82rem", fontWeight: 700, cursor: resolution.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", borderRadius: 2 }}>
            {tr("app.confirm")}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
