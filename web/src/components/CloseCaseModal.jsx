import { useState, useRef, useEffect } from "react";
import ModalShell from "./ModalShell.jsx";

// ── Jedna závada s radio-button řešeními ─────────────────────────────────────

function FaultResolutionGroup({ fault, index, selectedFaultIdx, selectedOption, customText, onSelect, onCustomChange, t, tr }) {
  const isActive = selectedFaultIdx === index;
  const hasOptions = fault.řešení?.length > 0;
  const customRef = useRef(null);

  // Auto-focus "Jiné" editbox when this fault becomes active and "custom" is selected
  useEffect(() => {
    if (isActive && selectedOption === "custom" && customRef.current) {
      customRef.current.focus();
    }
  }, [isActive, selectedOption]);

  if (!hasOptions && !fault.název) return null;

  const accent = fault.zdroj === "databáze" ? "#16a34a" : "#1a6fd8";

  return (
    <div style={{ marginBottom: 12, padding: "10px 12px", background: t.bgCard, border: `1px solid ${isActive ? accent : t.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 2, transition: "border-color 0.15s" }}>
      {/* Fault header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: hasOptions ? 8 : 0 }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: t.text, fontFamily: "'Barlow Condensed',sans-serif" }}>
          {fault.název}
        </div>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: accent }}>
          {fault.pravděpodobnost}%
        </div>
      </div>

      {/* AI-suggested options */}
      {hasOptions && fault.řešení.map((option, optIdx) => {
        const optionId = `${index}-${optIdx}`;
        const isChecked = isActive && selectedOption === optionId;
        return (
          <label key={optIdx} onClick={() => onSelect(index, optionId, option)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", cursor: "pointer", fontSize: "0.82rem", color: isChecked ? t.text : t.textMuted, borderRadius: 2, background: isChecked ? `${accent}11` : "transparent", transition: "background 0.1s" }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${isChecked ? accent : t.border}`, background: isChecked ? accent : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
              {isChecked && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
            </span>
            {option}
          </label>
        );
      })}

      {/* "Jiné" option with editbox */}
      {hasOptions && (
        <div style={{ marginTop: 4 }}>
          <label onClick={() => onSelect(index, "custom", "")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", cursor: "pointer", fontSize: "0.82rem", color: (isActive && selectedOption === "custom") ? t.text : t.textMuted }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${(isActive && selectedOption === "custom") ? accent : t.border}`, background: (isActive && selectedOption === "custom") ? accent : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
              {(isActive && selectedOption === "custom") && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
            </span>
            {tr("app.closeOther")}
          </label>
          {isActive && selectedOption === "custom" && (
            <input ref={customRef} type="text" value={customText} onChange={(e) => onCustomChange(e.target.value)}
              placeholder={tr("app.closeCustomPlaceholder")}
              style={{ width: "100%", marginTop: 4, marginLeft: 24, background: t.bgInput, border: `1px solid ${t.borderInput}`, color: t.text, padding: "6px 10px", fontSize: "0.82rem", fontFamily: "'IBM Plex Mono',monospace", outline: "none", borderRadius: 2, boxSizing: "border-box", maxWidth: "calc(100% - 24px)" }} />
          )}
        </div>
      )}
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
  // Smart close state — which fault and which option is selected
  const [selectedFaultIdx, setSelectedFaultIdx] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [customText, setCustomText] = useState("");

  // Faults that have řešení options
  const faultsWithOptions = faults.filter((f) => f.řešení?.length > 0);
  const hasSmartOptions = faultsWithOptions.length > 0;

  // Default: focus on "Jiné" of first fault (prevent mindless clicking)
  useEffect(() => {
    if (hasSmartOptions && selectedFaultIdx === null) {
      setSelectedFaultIdx(0);
      setSelectedOption("custom");
    }
  }, [hasSmartOptions, selectedFaultIdx]);

  const handleSelect = (faultIdx, optionId, optionText) => {
    setSelectedFaultIdx(faultIdx);
    setSelectedOption(optionId);
    if (optionId !== "custom") {
      // Prepend fault name to option for context
      const fault = faults[faultIdx];
      const resText = `${fault.název}: ${optionText}`;
      onChangeResolution(resText);
      setCustomText("");
    } else {
      // Custom selected — clear resolution until they type
      onChangeResolution(customText);
    }
  };

  const handleCustomChange = (value) => {
    setCustomText(value);
    if (selectedFaultIdx !== null) {
      const fault = faults[selectedFaultIdx];
      onChangeResolution(value ? `${fault.název}: ${value}` : "");
    }
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
        <p style={{ fontSize: "0.85rem", color: t.textMuted, marginBottom: 16, lineHeight: 1.7 }}>
          {hasSmartOptions ? tr("app.closeCaseHelpSmart") : tr("app.closeCaseHelp")}
        </p>

        {/* Smart close — AI-suggested resolutions */}
        {hasSmartOptions && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "0.68rem", color: t.textFaint, letterSpacing: "0.1em", marginBottom: 8 }}>{tr("app.closeSelectResolution")}</div>
            {faults.map((fault, idx) => (
              fault.řešení?.length > 0 && (
                <FaultResolutionGroup
                  key={idx}
                  fault={fault}
                  index={idx}
                  selectedFaultIdx={selectedFaultIdx}
                  selectedOption={selectedOption}
                  customText={customText}
                  onSelect={handleSelect}
                  onCustomChange={handleCustomChange}
                  t={t}
                  tr={tr}
                />
              )
            ))}
          </div>
        )}

        {/* Fallback textarea — shown when no AI options available */}
        {!hasSmartOptions && (
          <>
            <div style={{ fontSize: "0.68rem", color: t.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>{tr("app.repairLabel")}</div>
            <textarea ref={textareaRef} value={resolution} onChange={(event) => onChangeResolution(event.target.value)} rows={5}
              placeholder={tr("app.repairPlaceholder")}
              style={{ width: "100%", background: t.bgInput, border: `1px solid ${closeError ? "#dc2626" : t.borderInput}`, color: t.text, padding: "10px 12px", fontSize: "0.88rem", lineHeight: 1.7, marginBottom: closeError ? 8 : 16, fontFamily: "'IBM Plex Mono',monospace", resize: "vertical", outline: "none", borderRadius: 2 }} />
          </>
        )}

        {closeError && (
          <div style={{ fontSize: "0.8rem", color: "#dc2626", marginBottom: 12, padding: "6px 10px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 2 }}>
            {closeError}
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
