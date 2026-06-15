import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/index.jsx";
import { useTheme } from "../contexts/ThemeContext.jsx";
import useIsMobile from "../hooks/useIsMobile.js";
import { fetchKnownFaults, fetchKnownFaultCases } from "../lib/storage-edge.js";
import { BANDS, bandTotals, countForBand, pickFaultLabel, sourceLabelFor, topObdCodes } from "../lib/known-faults.js";
import { fmtDate, fmtMileage } from "../lib/utils.js";

const FETCH_DEBOUNCE_MS = 400;
const MIN_CASES_FOR_PANEL = 5;
const MAX_ROWS = 8;

// ── Panel „Známé závady tohoto vozu" ──────────────────────────────────────────
// Zobrazí se na formuláři nového případu po výběru značky a modelu. Čte čistou
// DB agregaci (edge fn known-faults) — žádné AI tokeny, fail-quiet (při chybě
// se nevykreslí nic). Statistiky jsou generačně přesné; širší pohled přes
// všechny generace je dostupný jen jako explicitně označený fallback.
export default function KnownFaultsPanel({ brand, model, onPrefill }) {
  const { t } = useTheme();
  const { tr, lang } = useI18n();
  const mobile = useIsMobile();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  // Výchozí pásmo je vždy "vše": ~90 % případů má prázdný nájezd, takže
  // automatické přepnutí na číselné pásmo by panel zdánlivě vyprázdnilo.
  const [band, setBand] = useState("all");
  const [familyView, setFamilyView] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [casesByKey, setCasesByKey] = useState({});
  const [loadingKey, setLoadingKey] = useState(null);

  const requestIdRef = useRef(0);
  const statsCacheRef = useRef(new Map());

  // Klíč detailu obsahuje vozidlo — fault_id je z číselníku (napříč vozidly
  // stejný), takže bez brand|model by se případy mezi modely srážely.
  const caseKey = (faultId) => `${brand}|${model}|${faultId}|${band}|${familyView ? "family" : "exact"}`;

  useEffect(() => {
    setData(null);
    setBand("all");
    setFamilyView(false);
    setExpanded(null);
    setCasesByKey({});
    setLoadingKey(null);
    if (!brand || !model) return undefined;

    const requestId = ++requestIdRef.current;
    const cacheKey = `${brand}|${model}`;
    const apply = (result) => {
      if (requestIdRef.current !== requestId) return;
      setData(result?.ok ? result : null);
      setLoading(false);
    };

    const cached = statsCacheRef.current.get(cacheKey);
    if (cached) {
      apply(cached);
      return undefined;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      const result = await fetchKnownFaults({ brand, model });
      if (result?.ok) statsCacheRef.current.set(cacheKey, result);
      apply(result);
    }, FETCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [brand, model]);

  const toggleExpand = async (faultId) => {
    if (expanded === faultId) {
      setExpanded(null);
      return;
    }
    setExpanded(faultId);
    const key = caseKey(faultId);
    if (casesByKey[key]) return;
    const rid = requestIdRef.current;
    setLoadingKey(key);
    const result = await fetchKnownFaultCases({
      brand,
      model,
      faultId,
      band: band === "all" ? null : band,
      gen: familyView ? "family" : "exact",
    });
    // Vozidlo se mezitím změnilo → zahodit opožděný výsledek (jinak by přistál
    // pod kolizním klíčem a zobrazil opravy z jiného vozu).
    if (requestIdRef.current !== rid) return;
    setCasesByKey((prev) => ({ ...prev, [key]: result.cases ?? [] }));
    setLoadingKey((k) => (k === key ? null : k));
  };

  if (!brand || !model) return null;

  if (loading && !data) {
    return (
      <div style={{ marginBottom: mobile ? 12 : 18, padding: "12px 14px", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 2 }}>
        <span style={{ fontSize: "0.72rem", color: t.textFaint, animation: "pulse 1.5s ease infinite", display: "inline-block" }}>
          {tr("known.loading")}
        </span>
      </div>
    );
  }

  if (!data?.ok) return null;

  const faults = familyView ? data.familyFaults : data.faults;
  const total = familyView ? data.totalFamily : data.total;

  // Málo dat pro vybranou generaci → tichý řádek místo lživé statistiky
  if (!familyView && data.total < MIN_CASES_FOR_PANEL) {
    if (data.total === 0 && data.totalFamily < MIN_CASES_FOR_PANEL) return null;
    return (
      <div style={{ marginBottom: mobile ? 12 : 18, padding: "10px 14px", background: t.bgMuted, border: `1px solid ${t.border}`, borderRadius: 2, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.72rem", color: t.textFaint }}>
          {tr("known.lowData", { count: data.total })}
        </span>
        {data.totalFamily >= MIN_CASES_FOR_PANEL && (
          <button onClick={() => { setFamilyView(true); setExpanded(null); }}
            style={{ background: "none", border: `1px solid ${t.borderAccent}`, color: t.accentText, cursor: "pointer", padding: "4px 10px", fontSize: "0.68rem", fontFamily: "inherit", borderRadius: 2 }}>
            {tr("known.showAllGens", { count: data.totalFamily })}
          </button>
        )}
      </div>
    );
  }

  const totals = bandTotals(faults);
  const visibleFaults = faults
    .map((f) => ({ fault: f, count: countForBand(f, band) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_ROWS);
  const maxCount = visibleFaults[0]?.count ?? 1;

  const bandLabels = {
    all: tr("known.bandAll"),
    "0-100": tr("known.band0"),
    "100-150": tr("known.band100"),
    "150-200": tr("known.band150"),
    "200+": tr("known.band200"),
  };

  return (
    <div data-testid="known-faults-panel" style={{ marginBottom: mobile ? 12 : 18, background: t.bgCard, border: `1px solid ${t.borderAccent}`, borderRadius: 2, overflow: "hidden" }}>
      {/* Hlavička */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: mobile ? "10px 12px" : "12px 14px", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: mobile ? "0.78rem" : "0.85rem", fontWeight: 700, color: t.accentText, letterSpacing: "0.06em" }}>
            {tr("known.title")}
          </div>
          <div style={{ fontSize: "0.66rem", color: t.textLabel, marginTop: 2 }}>
            {tr("known.subtitle")}
          </div>
        </div>
        <div style={{ flexShrink: 0, padding: "3px 9px", background: t.doneStatusBg, border: `1px solid ${t.doneStatusBorder}`, color: t.doneStatusColor, fontSize: "0.68rem", borderRadius: 2, whiteSpace: "nowrap" }}>
          {tr("app.casesCount", { count: total })}
        </div>
      </div>

      {/* Upozornění na pohled přes všechny generace */}
      {familyView && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "7px 14px", background: t.openStatusBg, borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontSize: "0.66rem", color: t.openStatusColor }}>⚠ {tr("known.allGensNote")}</span>
          {data.total > 0 && (
            <button onClick={() => { setFamilyView(false); setExpanded(null); }}
              style={{ background: "none", border: "none", color: t.accentText, cursor: "pointer", padding: 0, fontSize: "0.66rem", fontFamily: "inherit", textDecoration: "underline" }}>
              {tr("known.exactGensOnly")}
            </button>
          )}
        </div>
      )}

      {/* Filtr pásem nájezdu */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", padding: mobile ? "8px 12px" : "8px 14px", borderBottom: `1px solid ${t.border}` }}>
        <span style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.08em", marginRight: 2 }}>{tr("known.bandLabel")}</span>
        {BANDS.map((b) => {
          const sel = band === b;
          const disabled = b !== "all" && totals[b] === 0;
          return (
            <button key={b} onClick={() => { if (!disabled) { setBand(b); setExpanded(null); } }} disabled={disabled}
              style={{ background: sel ? t.chipSelBg : t.chipBg, color: sel ? t.chipSelText : disabled ? t.textVeryFaint : t.chipText, border: `1px solid ${sel ? t.accent : t.chipBorder}`, cursor: disabled ? "default" : "pointer", padding: mobile ? "3px 7px" : "4px 9px", fontSize: mobile ? "0.62rem" : "0.66rem", fontFamily: "inherit", borderRadius: 2, opacity: disabled ? 0.5 : 1, transition: "all 0.12s" }}>
              {bandLabels[b]}{b !== "all" && totals[b] > 0 ? ` (${totals[b]})` : ""}
            </button>
          );
        })}
      </div>

      {/* Žebříček závad */}
      {visibleFaults.length === 0 ? (
        <div style={{ padding: "10px 14px", fontSize: "0.7rem", color: t.textFaint }}>
          {/* Při "vše" a prázdném žebříčku případy existují, jen nejsou roztříděné */}
          {band === "all" ? tr("known.allUnclassified") : tr("known.noFaultsForBand")}
        </div>
      ) : visibleFaults.map(({ fault, count }, index) => {
        const isOpen = expanded === fault.faultId;
        const key = caseKey(fault.faultId);
        const cases = casesByKey[key];
        return (
          <div key={fault.faultId}>
            <div onClick={() => toggleExpand(fault.faultId)} data-testid={`known-fault-row-${fault.faultId}`}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: mobile ? "8px 12px" : "9px 14px", borderTop: `1px solid ${t.border}`, cursor: "pointer", background: isOpen ? t.bgSelected : "transparent", transition: "background 0.12s" }}>
              <div style={{ flexShrink: 0, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", background: t.chipBg, border: `1px solid ${t.chipBorder}`, color: t.textLabel, fontSize: "0.64rem", borderRadius: 2 }}>
                {index + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: mobile ? "0.74rem" : "0.78rem", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pickFaultLabel(fault, lang)}
              </div>
              <div style={{ flexShrink: 0, width: mobile ? 56 : 76, textAlign: "right" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, color: t.accentText }}>{count}×</div>
                <div style={{ height: 3, background: t.probBarBg, borderRadius: 2, marginTop: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round((count / maxCount) * 100)}%`, background: t.accent }} />
                </div>
              </div>
              <span style={{ flexShrink: 0, fontSize: "0.6rem", color: t.textFaint }}>{isOpen ? "▼" : "▶"}</span>
            </div>

            {/* Detail: podkladové případy */}
            {isOpen && (
              <div style={{ padding: mobile ? "8px 12px 10px" : "10px 14px 12px", background: t.bgMuted, borderTop: `1px solid ${t.border}` }}>
                <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.08em", marginBottom: 6 }}>
                  {tr("known.casesHeader")}
                </div>
                {!cases && loadingKey === key && (
                  <div style={{ fontSize: "0.7rem", color: t.textFaint, animation: "pulse 1.5s ease infinite" }}>{tr("known.loadingCases")}</div>
                )}
                {(cases ?? []).slice(0, 5).map((c) => {
                  const source = sourceLabelFor(c.threadUrl);
                  return (
                    <div key={c.id} style={{ padding: "7px 0", borderBottom: `1px solid ${t.border}` }}>
                      <div style={{ fontSize: "0.72rem", color: t.diagText, lineHeight: 1.5 }}>{c.resolution}</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4, fontSize: "0.62rem", color: t.textFaint }}>
                        <span>{c.vehicleModel}</span>
                        {c.enginePower && <span>{c.enginePower}</span>}
                        <span>{c.mileage ? fmtMileage(c.mileage, lang) : tr("known.mileageUnknown")}</span>
                        {c.closedAt && <span>{fmtDate(c.closedAt, lang)}</span>}
                        {source ? (
                          <a href={c.threadUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                            style={{ color: t.accentText, textDecoration: "underline" }}>
                            {source} ↗
                          </a>
                        ) : (
                          <span style={{ color: t.sympText }}>{tr("known.sourceUser")}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {cases && onPrefill && (
                  <button data-testid="known-fault-prefill-btn"
                    onClick={() => onPrefill({
                      obdCodes: topObdCodes(cases),
                      text: tr("known.hypothesis", { fault: pickFaultLabel(fault, lang), count, model: `${brand} ${model}` }),
                    })}
                    style={{ marginTop: 8, background: t.accent, color: "#fff", border: "none", cursor: "pointer", padding: "7px 13px", fontSize: "0.68rem", fontFamily: "inherit", fontWeight: 700, borderRadius: 2, letterSpacing: "0.04em" }}>
                    🔧 {tr("known.prefillBtn")}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Patičky: případy bez určené generace / bez zařazené závady.
          V režimu „všechny generace" se počet nezařazených bere z celé rodiny. */}
      {(() => {
        const unclassified = familyView ? (data.familyUnclassified ?? 0) : data.unclassified;
        if ((familyView || data.genUnknown <= 0) && unclassified <= 0) return null;
        return (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "7px 14px", borderTop: `1px solid ${t.border}` }}>
            {!familyView && data.genUnknown > 0 && (
              <button onClick={() => { setFamilyView(true); setExpanded(null); }}
                style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", padding: 0, fontSize: "0.62rem", fontFamily: "inherit", textDecoration: "underline" }}>
                {tr("known.genUnknown", { count: data.genUnknown })}
              </button>
            )}
            {unclassified > 0 && (
              <span style={{ fontSize: "0.62rem", color: t.textVeryFaint }}>
                {tr("known.unclassified", { count: unclassified })}
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}
