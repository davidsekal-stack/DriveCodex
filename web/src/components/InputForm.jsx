import { useState } from "react";
import { SYMPTOM_CATEGORIES, getObdCodes } from "../constants/index.js";
import { useI18n } from "../i18n/index.jsx";
import useIsMobile from "../hooks/useIsMobile.js";
import { isWebBluetoothSupported, readObdCodes } from "../lib/obd-reader.js";

const OBD_REGEX = /^[PCBU][0-9A-F]{4}$/;

export default function InputForm({ onSubmit, loading, label, t, vehicle }) {
  const { tr } = useI18n();
  const mobile = useIsMobile();

  const TABS = [
    { key: "symptoms", label: tr('input.symptomsTab') },
    { key: "obd",      label: tr('input.obdTab')      },
    { key: "text",     label: tr('input.textTab')      },
  ];

  const [tab,      setTab]      = useState("symptoms");
  const [symptoms, setSymptoms] = useState([]);   // stores i18n keys like "sym.lossOfPower"
  const [obdInput, setObdInput] = useState("");
  const [obdCodes, setObdCodes] = useState([]);
  const [text,     setText]     = useState("");
  const [openCat,  setOpenCat]  = useState(SYMPTOM_CATEGORIES[0]?.catKey ?? "");
  const [bleStatus, setBleStatus] = useState("idle"); // idle | connecting | error
  const [bleError,  setBleError]  = useState(null);
  const bleSupported = isWebBluetoothSupported();

  const toggleSymptom = (key) =>
    setSymptoms((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]);

  const toggleObd = (code) =>
    setObdCodes((prev) => prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]);

  const addObdFromInput = () => {
    const parsed = obdInput.toUpperCase().split(/[\s,;]+/).filter((c) => OBD_REGEX.test(c));
    setObdCodes((prev) => [...new Set([...prev, ...parsed])]);
    setObdInput("");
  };

  const handleBleRead = async () => {
    setBleStatus("connecting");
    setBleError(null);
    const { codes, error } = await readObdCodes();
    if (error) {
      setBleStatus("error");
      setBleError(error);
    } else if (codes.length > 0) {
      setObdCodes((prev) => [...new Set([...prev, ...codes])]);
      setBleStatus("idle");
    } else {
      setBleStatus("idle");
    }
  };

  const handleSubmit = () => {
    if (!total) return;
    onSubmit({ symptoms, obdCodes, text: text.trim() });
    setSymptoms([]);
    setObdCodes([]);
    setText("");
  };

  const total = symptoms.length + obdCodes.length + (text.trim() ? 1 : 0);

  const tabHints = {
    symptoms: tr('input.selectedCount', { count: symptoms.length }),
    obd:      tr('input.codesCount', { count: obdCodes.length }),
    text:     text.trim() ? "✓" : "—",
  };

  const displayLabel = label || tr('app.runDiag');

  return (
    <div>
      {/* Tab navigace */}
      <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`, marginBottom: 12 }}>
        {TABS.map(({ key, label: tabLabel }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "8px 14px", borderBottom: tab === key ? `2px solid ${t.accent}` : "2px solid transparent", color: tab === key ? t.accent : t.textLabel, fontSize: "0.68rem", letterSpacing: "0.08em", fontWeight: 600 }}>
            {tabLabel}
            <span style={{ display: "block", fontSize: "0.54rem", color: tab === key ? t.accentText : t.textVeryFaint, marginTop: 1 }}>
              {tabHints[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Panel: Příznaky */}
      {tab === "symptoms" && (
        <div style={{ maxHeight: 280, overflowY: "auto" }}>
          {SYMPTOM_CATEGORIES.map(({ catKey, symptoms: symKeys }) => {
            const selectedCount = symKeys.filter((s) => symptoms.includes(s)).length;
            const isOpen = openCat === catKey;
            return (
              <div key={catKey} style={{ marginBottom: 4 }}>
                <button onClick={() => setOpenCat(isOpen ? null : catKey)}
                  style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "7px 10px", backgroundColor: isOpen ? t.bgCatOpen : t.bgCat, color: isOpen ? t.accent : t.textLabel, fontSize: "0.65rem", letterSpacing: "0.08em", borderLeft: isOpen ? `3px solid ${t.accent}` : `3px solid ${t.border}` }}>
                  {isOpen ? "▼" : "▶"} {tr(catKey).toUpperCase()}
                  {selectedCount > 0 && <span style={{ marginLeft: 8, color: t.textFaint }}>({selectedCount})</span>}
                </button>
                {isOpen && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: mobile ? 4 : 5, padding: mobile ? "6px 8px" : "8px 10px", background: t.bgMuted, borderLeft: `3px solid ${t.border}` }}>
                    {symKeys.map((symKey) => {
                      const sel = symptoms.includes(symKey);
                      return (
                        <div key={symKey} onClick={() => toggleSymptom(symKey)}
                          style={{ cursor: "pointer", userSelect: "none", padding: mobile ? "3px 7px" : "4px 9px", fontSize: mobile ? "0.62rem" : "0.68rem", background: sel ? t.chipSelBg : t.chipBg, color: sel ? t.chipSelText : t.chipText, border: `1px solid ${sel ? t.accent : t.chipBorder}`, fontWeight: sel ? 600 : 400, borderRadius: 2, transition: "all 0.12s" }}>
                          {tr(symKey)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Panel: OBD kódy */}
      {tab === "obd" && (() => {
        const codes = getObdCodes(vehicle?.brand, vehicle?.model, vehicle?.enginePower);
        const hasEngine = codes.engine.length > 0;
        const hasBrand  = codes.brand.length > 0;
        const chipStyle = (sel) => ({ cursor: "pointer", userSelect: "none", padding: mobile ? "3px 7px" : "4px 10px", fontFamily: "monospace", fontSize: mobile ? "0.68rem" : "0.75rem", background: sel ? t.accent : t.bgInput, color: sel ? "#fff" : t.obdText, border: `1px solid ${sel ? t.accent : t.obdBorder}`, borderRadius: 2, transition: "all 0.12s" });
        const sectionLabel = (text) => ({ fontSize: "0.6rem", letterSpacing: "0.08em", color: t.textFaint, fontWeight: 600, marginBottom: 4, marginTop: 8 });
        return (
        <div>
          <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
            <input value={obdInput} onChange={(e) => setObdInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addObdFromInput()}
              placeholder={tr('input.obdPlaceholder')}
              style={{ flex: 1, background: t.bgInput, border: `1px solid ${t.borderInput}`, color: t.text, padding: "8px 10px", fontSize: "0.78rem", fontFamily: "'IBM Plex Mono',monospace", borderRadius: 2, outline: "none" }} />
            <button onClick={addObdFromInput}
              style={{ background: t.accent, color: "#fff", border: "none", cursor: "pointer", padding: "8px 14px", fontSize: "0.7rem", fontFamily: "inherit", fontWeight: 700, borderRadius: 2 }}>
              +
            </button>
          </div>

          {/* BLE OBD Reader button */}
          {bleSupported && (
            <div style={{ marginBottom: 10 }}>
              <button onClick={handleBleRead} disabled={bleStatus === "connecting"}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: bleStatus === "error" ? "rgba(220,38,38,0.08)" : t.bgMuted, border: `1px solid ${bleStatus === "error" ? "rgba(220,38,38,0.3)" : t.border}`, color: bleStatus === "connecting" ? t.textFaint : bleStatus === "error" ? "#dc2626" : t.accent, padding: "9px 14px", fontSize: "0.75rem", fontFamily: "inherit", fontWeight: 600, cursor: bleStatus === "connecting" ? "wait" : "pointer", borderRadius: 2, transition: "all 0.15s", letterSpacing: "0.04em" }}>
                {bleStatus === "connecting"
                  ? <><span style={{ animation: "pulse 1.5s ease infinite", display: "inline-block" }}>📡</span> {tr('input.bleConnecting')}</>
                  : <><span>📡</span> {tr('input.bleReadCodes')}</>}
              </button>
              {bleError && (
                <div style={{ fontSize: "0.7rem", color: "#dc2626", marginTop: 4, padding: "4px 8px" }}>
                  {bleError}
                </div>
              )}
            </div>
          )}

          {/* Obecné kódy */}
          <div style={sectionLabel()}>{tr('input.commonCodes')}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 4 }}>
            {codes.common.map((c) => (
              <div key={c} onClick={() => toggleObd(c)} style={chipStyle(obdCodes.includes(c))}>{c}</div>
            ))}
          </div>

          {/* Kódy dle technologie motoru */}
          {hasEngine && <>
            <div style={sectionLabel()}>{tr('input.engineCodes')}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 4 }}>
              {codes.engine.map((c) => (
                <div key={c} onClick={() => toggleObd(c)} style={chipStyle(obdCodes.includes(c))}>{c}</div>
              ))}
            </div>
          </>}

          {/* Kódy dle značky */}
          {hasBrand && <>
            <div style={sectionLabel()}>{tr('input.brandCodes', { brand: vehicle?.brand })}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 4 }}>
              {codes.brand.map((c) => (
                <div key={c} onClick={() => toggleObd(c)} style={chipStyle(obdCodes.includes(c))}>{c}</div>
              ))}
            </div>
          </>}

          {obdCodes.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
              {obdCodes.map((c) => (
                <div key={c} onClick={() => toggleObd(c)}
                  style={{ padding: "2px 8px", background: t.obdBg, border: `1px solid ${t.accent}`, color: t.accent, fontSize: "0.72rem", fontFamily: "monospace", cursor: "pointer", borderRadius: 2 }}>
                  {c} ✕
                </div>
              ))}
            </div>
          )}
        </div>
        );
      })()}

      {/* Panel: Volný text */}
      {tab === "text" && (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
          placeholder={tr('input.describeFault')}
          style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.borderInput}`, color: t.text, padding: "10px 12px", fontSize: "0.8rem", lineHeight: 1.7, fontFamily: "'IBM Plex Mono',monospace", resize: "vertical", outline: "none", borderRadius: 2 }} />
      )}

      {/* Spodní lišta: souhrn + odeslat */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "10px 12px", background: t.bgMuted, border: `1px solid ${t.border}`, borderRadius: 2, gap: 8 }}>
        <div style={{ display: "flex", gap: 12, fontSize: "0.7rem", flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {symptoms.length > 0 && <span style={{ color: t.accent }}>⚡ {symptoms.length}</span>}
          {obdCodes.length > 0 && <span style={{ color: t.obdText }}>📡 {obdCodes.length}</span>}
          {text.trim()         && <span style={{ color: t.doneStatusColor }}>✍️</span>}
          {total === 0         && <span style={{ color: t.textVeryFaint }}>{tr('input.enterHint')}</span>}
        </div>
        <button disabled={total === 0 || loading} onClick={handleSubmit}
          style={{ background: total > 0 ? t.accent : t.border, color: total > 0 ? "#fff" : t.textFaint, border: "none", cursor: total > 0 && !loading ? "pointer" : "not-allowed", padding: "9px 22px", letterSpacing: "0.1em", fontSize: "0.75rem", fontFamily: "inherit", fontWeight: 700, borderRadius: 2, transition: "background 0.2s, color 0.2s, opacity 0.2s", opacity: total === 0 || loading ? 0.55 : 1, flexShrink: 0, whiteSpace: "nowrap" }}>
          {loading
            ? <span style={{ display: "inline-block", animation: "pulse 1.5s ease infinite" }}>{tr('input.analyzing')}</span>
            : `▶ ${displayLabel}`}
        </button>
      </div>
    </div>
  );
}

// ── FollowUpPrompt — jednoduchá promptlina pro pokračování diagnostiky ─────────
export function FollowUpPrompt({ onSubmit, loading, t }) {
  const { tr } = useI18n();
  const [text, setText] = useState("");

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onSubmit({ symptoms: [], obdCodes: [], text: trimmed });
    setText("");
  };

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
        placeholder={tr('input.followupPlaceholder')}
        rows={2}
        style={{ flex: 1, background: t.bgInput, border: `1px solid ${t.borderInput}`, color: t.text, padding: "10px 12px", fontSize: "0.88rem", lineHeight: 1.6, fontFamily: "'IBM Plex Mono',monospace", resize: "none", outline: "none", borderRadius: 2 }}
      />
      <button
        disabled={!text.trim() || loading}
        onClick={handleSubmit}
        style={{ background: text.trim() ? t.accent : t.border, color: text.trim() ? "#fff" : t.textFaint, border: "none", cursor: text.trim() && !loading ? "pointer" : "not-allowed", padding: "10px 20px", fontSize: "0.82rem", fontFamily: "inherit", fontWeight: 700, borderRadius: 2, transition: "all 0.2s", whiteSpace: "nowrap", flexShrink: 0 }}>
        {loading
          ? <span style={{ animation: "pulse 1.5s ease infinite", display: "inline-block" }}>...</span>
          : tr('input.send')}
      </button>
    </div>
  );
}
