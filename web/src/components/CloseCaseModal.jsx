import { useState, useRef, useEffect } from "react";
import ModalShell from "./ModalShell.jsx";

const FONT = "0.85rem";

// ── Checkbox component ───────────────────────────────────────────────────────

function Checkbox({ checked, accent, t }) {
  return (
    <span style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${checked ? accent : t.border}`, background: checked ? accent : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
      {checked && <span style={{ color: "#fff", fontSize: "0.7rem", lineHeight: 1, fontWeight: 700 }}>✓</span>}
    </span>
  );
}

// ── Jedna závada s checkbox řešeními ─────────────────────────────────────────

function FaultResolutionGroup({ fault, index, checkedOptions, onToggle, t }) {
  const hasOptions = fault.řešení?.length > 0;
  if (!hasOptions) return null;

  const accent = fault.zdroj === "databáze" ? "#16a34a" : "#1a6fd8";

  return (
    <div style={{ marginBottom: 10, padding: "10px 12px", background: t.bgCard, border: `1px solid ${t.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 2 }}>
      {/* Fault header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: FONT, fontWeight: 600, color: t.text }}>
          {fault.název}
        </div>
        <div style={{ fontSize: FONT, fontWeight: 700, color: accent }}>
          {fault.pravděpodobnost}%
        </div>
      </div>

      {/* Checkbox options */}
      {fault.řešení.map((option, optIdx) => {
        const key = `${index}-${optIdx}`;
        const isChecked = !!checkedOptions[key];
        return (
          <label key={optIdx} onClick={() => onToggle(key, fault.název, option)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", cursor: "pointer", fontSize: FONT, color: isChecked ? t.text : t.textMuted, borderRadius: 2, background: isChecked ? `${accent}11` : "transparent", transition: "background 0.1s" }}>
            <Checkbox checked={isChecked} accent={accent} t={t} />
            {option}
          </label>
        );
      })}
    </div>
  );
}

// ── Hlavní modal ─────────────────────────────────────────────────────────────

export default function CloseCaseModal({
  closeError,
  faults = [],
  mobile,
  onCancel,
  onChangeResolution,
  onConfirm,
  resolution,
  t,
  tr,
}) {
  // Checkbox state: { "0-1": { fault: "...", option: "..." }, ... }
  const [checkedOptions, setCheckedOptions] = useState({});
  const [customText, setCustomText] = useState("");
  const [customActive, setCustomActive] = useState(false);
  const customRef = useRef(null);

  const hasSmartOptions = faults.some((f) => f.řešení?.length > 0);

  // Default: custom editbox focused (prevent mindless clicking)
  useEffect(() => {
    if (hasSmartOptions) {
      setCustomActive(true);
    }
  }, [hasSmartOptions]);

  useEffect(() => {
    if (customActive && customRef.current) {
      customRef.current.focus();
    }
  }, [customActive]);

  // Build resolution text — group actions by fault name
  const buildResolution = (checked, custom) => {
    const byFault = {};
    for (const v of Object.values(checked)) {
      if (!byFault[v.fault]) byFault[v.fault] = [];
      byFault[v.fault].push(v.option);
    }
    const parts = Object.entries(byFault).map(([fault, actions]) => `${fault}: ${actions.join(", ")}`);
    if (custom.trim()) parts.push(custom.trim());
    return parts.join(". ");
  };

  const handleToggle = (key, faultName, optionText) => {
    setCheckedOptions((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = { fault: faultName, option: optionText };
      }
      onChangeResolution(buildResolution(next, customText));
      return next;
    });
  };

  const handleCustomToggle = () => {
    setCustomActive((prev) => {
      if (prev) {
        // Turning off — clear custom text
        setCustomText("");
        onChangeResolution(buildResolution(checkedOptions, ""));
      }
      return !prev;
    });
  };

  const handleCustomChange = (value) => {
    setCustomText(value);
    onChangeResolution(buildResolution(checkedOptions, value));
  };

  // Fallback textarea ref for non-smart mode
  const textareaRef = useRef(null);
  useEffect(() => {
    if (!hasSmartOptions && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [hasSmartOptions]);

  return (
    <ModalShell onClose={onCancel} width={540}>
      <div style={{ background: t.bgModal, border: `1px solid ${t.border}`, borderRadius: 4, padding: mobile ? "16px" : "26px", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "1.4rem", fontWeight: 700, color: t.doneStatusColor, marginBottom: 8 }}>{tr("app.closeCaseTitle")}</div>
        <p style={{ fontSize: FONT, color: t.textMuted, marginBottom: 16, lineHeight: 1.7 }}>
          {hasSmartOptions ? tr("app.closeCaseHelpSmart") : tr("app.closeCaseHelp")}
        </p>

        {/* Smart close — AI-suggested resolutions */}
        {hasSmartOptions && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "0.7rem", color: t.textFaint, letterSpacing: "0.1em", marginBottom: 8 }}>{tr("app.closeSelectResolution")}</div>
            {faults.map((fault, idx) => (
              <FaultResolutionGroup
                key={idx}
                fault={fault}
                index={idx}
                checkedOptions={checkedOptions}
                onToggle={handleToggle}
                t={t}
              />
            ))}

            {/* Standalone "Jiné" option — always visible */}
            <div style={{ marginTop: 4, padding: "10px 12px", background: t.bgCard, border: `1px solid ${customActive ? t.accent : t.border}`, borderLeft: `3px solid ${t.textFaint}`, borderRadius: 2 }}>
              <label onClick={handleCustomToggle} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", cursor: "pointer", fontSize: FONT, color: customActive ? t.text : t.textMuted }}>
                <Checkbox checked={customActive} accent={t.accent || "#888"} t={t} />
                {tr("app.closeOther")}
              </label>
              {customActive && (
                <textarea ref={customRef} value={customText} onChange={(e) => handleCustomChange(e.target.value)}
                  placeholder={tr("app.closeCustomPlaceholder")} rows={1}
                  onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                  style={{ width: "calc(100% - 28px)", marginTop: 6, marginLeft: 28, background: t.bgInput, border: `1px solid ${t.borderInput}`, color: t.text, padding: "6px 10px", fontSize: FONT, fontFamily: "'IBM Plex Mono',monospace", outline: "none", borderRadius: 2, boxSizing: "border-box", resize: "none", overflow: "hidden", lineHeight: 1.6 }} />
              )}
            </div>
          </div>
        )}

        {/* Fallback textarea — shown when no AI options available */}
        {!hasSmartOptions && (
          <>
            <div style={{ fontSize: "0.7rem", color: t.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>{tr("app.repairLabel")}</div>
            <textarea ref={textareaRef} value={resolution} onChange={(event) => onChangeResolution(event.target.value)} rows={5}
              placeholder={tr("app.repairPlaceholder")}
              style={{ width: "100%", background: t.bgInput, border: `1px solid ${closeError ? "#dc2626" : t.borderInput}`, color: t.text, padding: "10px 12px", fontSize: FONT, lineHeight: 1.7, marginBottom: closeError ? 8 : 16, fontFamily: "'IBM Plex Mono',monospace", resize: "vertical", outline: "none", borderRadius: 2 }} />
          </>
        )}

        {closeError && (
          <div style={{ fontSize: FONT, color: "#dc2626", marginBottom: 12, padding: "6px 10px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 2 }}>
            {closeError}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel}
            style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textFaint, padding: "8px 20px", fontSize: FONT, cursor: "pointer", fontFamily: "inherit", borderRadius: 2 }}>
            {tr("app.cancel")}
          </button>
          <button disabled={!resolution.trim()} onClick={onConfirm}
            style={{ background: resolution.trim() ? t.doneStatusColor : "transparent", color: resolution.trim() ? "#fff" : t.textVeryFaint, border: `1px solid ${resolution.trim() ? t.doneStatusColor : t.border}`, padding: "8px 24px", fontSize: FONT, fontWeight: 700, cursor: resolution.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", borderRadius: 2 }}>
            {tr("app.confirm")}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
