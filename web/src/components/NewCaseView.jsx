import { useState, useCallback } from "react";
import { ACTIVE_BRAND_DROPDOWN_OPTIONS, ACTIVE_BRANDS, findIdentHistory, getBrandModels, getModelPowers, setDefaultBrand } from "../constants/index.js";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { fmtDate } from "../lib/utils.js";
import { isValidVin, decodeVin } from "../lib/vin-decoder.js";
import InputForm from "./InputForm.jsx";

export default function NewCaseView({
  cases,
  defaultBrand,
  error,
  identHistory,
  lang,
  loading,
  mobile,
  newVehicle,
  onOpenCase,
  onSubmit,
  setDefaultBrandState,
  setIdentHistory,
  setNewVehicle,
  tr,
}) {
  const { t } = useTheme();
  const modelOptions = getBrandModels(newVehicle.brand);
  const powers = getModelPowers(newVehicle.model);

  const [vinLoading, setVinLoading] = useState(false);
  const [vinResult, setVinResult] = useState(null); // { ok, brand, model, year, engineDesc, ... } or { ok: false, error }

  const handleVinDecode = useCallback(async () => {
    const vin = newVehicle.identValue?.trim();
    if (!vin || !isValidVin(vin)) return;
    setVinLoading(true);
    setVinResult(null);
    try {
      const result = await decodeVin(vin);
      setVinResult(result);
      if (result.ok) {
        // Auto-fill vehicle fields from VIN decode
        setNewVehicle((v) => {
          const update = { ...v };
          // Match brand to our catalog
          if (result.brand) {
            const catalogBrand = ACTIVE_BRANDS.find((b) => b.brand === result.brand);
            if (catalogBrand) update.brand = catalogBrand.brand;
          }
          // Try to match model from catalog — fuzzy match on model name + year
          if (result.model && result.year && update.brand) {
            const models = getBrandModels(update.brand);
            const matched = matchCatalogModel(models, result.model, result.year);
            if (matched) {
              update.model = matched.label;
              update.enginePower = "";
              // Try to match engine power
              if (result.kw) {
                const modelPowers = getModelPowers(matched.label);
                const matchedPower = matchCatalogPower(modelPowers, result.kw, result.displacementL);
                if (matchedPower) update.enginePower = matchedPower;
              }
            }
          }
          return update;
        });
      }
    } finally {
      setVinLoading(false);
    }
  }, [newVehicle.identValue, setNewVehicle]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: mobile ? "14px 10px" : "24px", background: t.bg }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: mobile ? 14 : 20 }}>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: mobile ? "1.2rem" : "1.5rem", fontWeight: 700, color: t.accent, letterSpacing: "0.05em", marginBottom: 4 }}>{tr("app.newCaseTitle")}</div>
          <div style={{ fontSize: "0.78rem", color: t.textFaint }}>{tr("app.newCaseSubtitle")}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: mobile ? 8 : 12, marginBottom: mobile ? 8 : 12 }}>
          <div>
            <div style={{ fontSize: "0.68rem", color: t.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>{tr("app.vehicleBrand")}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select value={newVehicle.brand}
                onChange={(e) => setNewVehicle((vehicle) => ({ ...vehicle, brand: e.target.value, model: "", enginePower: "" }))}
                style={{ flex: 1, background: t.bgInput, border: `1px solid ${t.borderInput}`, color: t.text, padding: "9px 10px", fontSize: "0.82rem", fontFamily: "inherit", borderRadius: 2, outline: "none" }}>
                {ACTIVE_BRAND_DROPDOWN_OPTIONS.map((item) => (
                  item.type === "separator"
                    ? <option key={item.key} disabled>{item.label}</option>
                    : <option key={item.key} value={item.brand}>{item.label}</option>
                ))}
              </select>
              <button
                title={tr("app.defaultBrandHint")}
                onClick={() => {
                  const isDefault = defaultBrand === newVehicle.brand;
                  const nextDefault = isDefault ? "" : newVehicle.brand;
                  setDefaultBrand(nextDefault);
                  setDefaultBrandState(nextDefault);
                }}
                style={{
                  background: defaultBrand === newVehicle.brand ? t.accent : "transparent",
                  border: `1px solid ${defaultBrand === newVehicle.brand ? t.accent : t.borderInput}`,
                  color: defaultBrand === newVehicle.brand ? "#fff" : t.textFaint,
                  width: 36,
                  height: 36,
                  fontSize: "1rem",
                  cursor: "pointer",
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}>
                ★
              </button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.68rem", color: t.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>{tr("app.vehicleModel")}</div>
            <select value={newVehicle.model}
              onChange={(e) => {
                const item = modelOptions.find((option) => option.label === e.target.value);
                if (item?.label) setNewVehicle((vehicle) => ({ ...vehicle, model: item.label, enginePower: "" }));
              }}
              style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.borderInput}`, color: t.text, padding: "9px 10px", fontSize: "0.82rem", fontFamily: "inherit", borderRadius: 2, outline: "none" }}>
              <option value="">{tr("app.selectModel")}</option>
              {modelOptions.map((item, index) => (
                item.group
                  ? <option key={index} disabled>── {item.group} ──</option>
                  : <option key={index} value={item.label}>{item.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: mobile ? 8 : 12, marginBottom: mobile ? 12 : 18 }}>
          <div>
            <div style={{ fontSize: "0.68rem", color: t.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>{tr("app.enginePower")}</div>
            <select value={newVehicle.enginePower}
              onChange={(e) => setNewVehicle((vehicle) => ({ ...vehicle, enginePower: e.target.value }))}
              disabled={!powers.length}
              style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.borderInput}`, color: powers.length ? t.text : t.textFaint, padding: "9px 10px", fontSize: "0.82rem", fontFamily: "inherit", borderRadius: 2, outline: "none", opacity: powers.length ? 1 : 0.5 }}>
              <option value="">{tr("app.optional")}</option>
              {powers.map((power, index) => <option key={index} value={power}>{power}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: "0.68rem", color: t.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>{tr("app.mileageKm")}</div>
            <input type="number" placeholder="185000" value={newVehicle.mileage}
              onChange={(e) => setNewVehicle((vehicle) => ({ ...vehicle, mileage: e.target.value }))}
              style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.borderInput}`, color: t.text, padding: "9px 10px", fontSize: "0.82rem", fontFamily: "inherit", borderRadius: 2, outline: "none" }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: mobile ? 8 : 12, marginBottom: mobile ? 12 : 18 }}>
          <div style={{ gridColumn: mobile ? "1" : "1 / -1" }}>
            <div style={{ fontSize: "0.68rem", color: t.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>{tr("app.identLabel")}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select value={newVehicle.identType || "spz"}
                onChange={(e) => setNewVehicle((vehicle) => ({ ...vehicle, identType: e.target.value }))}
                style={{ width: 80, flexShrink: 0, background: t.bgInput, border: `1px solid ${t.borderInput}`, color: t.text, padding: "9px 8px", fontSize: "0.82rem", fontFamily: "inherit", borderRadius: 2, outline: "none" }}>
                <option value="spz">{tr("app.identPlate")}</option>
                <option value="vin">VIN</option>
              </select>
              <input type="text" placeholder={tr("app.identPlaceholder")} value={newVehicle.identValue || ""}
                onChange={(e) => {
                  const identValue = e.target.value;
                  setNewVehicle((vehicle) => ({ ...vehicle, identValue }));
                  setIdentHistory(findIdentHistory(identValue));
                  setVinResult(null);
                }}
                style={{ flex: 1, background: t.bgInput, border: `1px solid ${t.borderInput}`, color: t.text, padding: "9px 10px", fontSize: "0.82rem", fontFamily: "inherit", borderRadius: 2, outline: "none", textTransform: "uppercase" }} />
              {newVehicle.identType === "vin" && isValidVin(newVehicle.identValue) && (
                <button onClick={handleVinDecode} disabled={vinLoading}
                  style={{ flexShrink: 0, background: vinLoading ? t.bgMuted : t.accent, color: vinLoading ? t.textFaint : "#fff", border: "none", cursor: vinLoading ? "wait" : "pointer", padding: "9px 14px", fontSize: "0.75rem", fontFamily: "inherit", fontWeight: 700, borderRadius: 2, transition: "all 0.15s", letterSpacing: "0.04em" }}>
                  {vinLoading ? "..." : tr("app.vinDecode")}
                </button>
              )}
            </div>
            {vinResult && (
              <div style={{ marginTop: 6, padding: "8px 10px", background: vinResult.ok ? "rgba(5,150,105,0.08)" : "rgba(220,38,38,0.08)", border: `1px solid ${vinResult.ok ? "rgba(5,150,105,0.3)" : "rgba(220,38,38,0.3)"}`, borderRadius: 2, fontSize: "0.75rem" }}>
                {vinResult.ok ? (
                  <div style={{ color: t.text }}>
                    <span style={{ fontWeight: 600, color: "#059669" }}>✓ VIN:</span>{" "}
                    {[vinResult.brand, vinResult.model, vinResult.year, vinResult.engineDesc, vinResult.fuelType, vinResult.trim].filter(Boolean).join(" · ")}
                  </div>
                ) : (
                  <div style={{ color: "#dc2626" }}>
                    ⚠ {tr("app.vinError")}
                  </div>
                )}
              </div>
            )}
            {identHistory.length > 0 && (
              <div style={{ marginTop: 6, padding: "6px 10px", background: t.bgMuted, border: `1px solid ${t.border}`, borderRadius: 2, fontSize: "0.75rem", color: t.textFaint }}>
                <span>{tr("app.identHistory", { count: identHistory.length })}</span>
                <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                  {identHistory.slice(0, 5).map((entry, index) => {
                    const matchCase = cases.find((kase) => kase.id === entry.caseId);
                    return (
                      <div key={index} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.7rem" }}>
                        <span style={{ color: t.textVeryFaint }}>{fmtDate(entry.date, lang)}</span>
                        {matchCase ? (
                          <span onClick={() => onOpenCase(matchCase.id)} style={{ color: t.accent, cursor: "pointer", textDecoration: "underline" }}>
                            {matchCase.name}
                          </span>
                        ) : (
                          <span style={{ color: t.textVeryFaint }}>{entry.caseName || "—"}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <div style={{ marginBottom: 14, padding: "10px 13px", background: "rgba(220,38,38,0.08)", border: "1px solid #dc2626", color: "#dc2626", fontSize: "0.82rem", borderRadius: 2 }}>⚠ {error}</div>}
        <InputForm onSubmit={onSubmit} loading={loading} label={tr("app.startDiag")} vehicle={newVehicle} />
      </div>
    </div>
  );
}

// ── Fuzzy matching helpers for catalog lookup ─────────────────────────────────

/**
 * Match NHTSA model name + year to our catalog model list.
 * E.g. NHTSA "Golf" + "2014" → catalog "Golf VII (2012–2020)"
 */
function matchCatalogModel(models, nhtsaModel, year) {
  if (!models?.length || !nhtsaModel) return null;
  const nm = nhtsaModel.toLowerCase().replace(/[-_]/g, " ");
  const yr = parseInt(year, 10) || 0;

  // Score each catalog model
  let best = null;
  let bestScore = 0;

  for (const item of models) {
    if (item.group || !item.label) continue;
    const label = item.label.toLowerCase();

    // Check if model name appears in catalog label
    const nameMatch = label.includes(nm) || nm.includes(label.split("(")[0].trim().split(" ").pop());
    if (!nameMatch) continue;

    // Check year range
    const yearMatch = matchYearRange(item.label, yr);
    const score = (nameMatch ? 10 : 0) + (yearMatch ? 5 : 0);

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

/**
 * Check if year falls within a catalog model's year range.
 * E.g. "Golf VII (2012–2020)" with year 2014 → true
 */
function matchYearRange(label, year) {
  if (!year) return false;
  const rangeMatch = label.match(/\((\d{4})[-–](\d{4}|)\)/);
  if (!rangeMatch) return false;
  const from = parseInt(rangeMatch[1], 10);
  const to = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 2099;
  return year >= from && year <= to;
}

/**
 * Match decoded kW + displacement to a catalog power string.
 * E.g. kw=92, displacement=1.0 → "92 kW – 1.0 EcoBoost"
 */
function matchCatalogPower(powers, kw, displacementL) {
  if (!powers?.length || !kw) return null;
  const targetKw = parseInt(kw, 10);
  const targetL = displacementL ? parseFloat(displacementL) : 0;

  let best = null;
  let bestDiff = Infinity;

  for (const power of powers) {
    const kwMatch = power.match(/^(\d+)\s*kW/);
    if (!kwMatch) continue;
    const pKw = parseInt(kwMatch[1], 10);
    const kwDiff = Math.abs(pKw - targetKw);

    // Also check displacement if available
    let lDiff = 0;
    if (targetL) {
      const lMatch = power.match(/(\d+\.\d+)/);
      if (lMatch) lDiff = Math.abs(parseFloat(lMatch[1]) - targetL);
    }

    const totalDiff = kwDiff + lDiff * 20; // Displacement difference weighted more
    if (totalDiff < bestDiff) {
      bestDiff = totalDiff;
      best = power;
    }
  }

  // Only accept if kW is within ±10
  if (best && bestDiff < 15) return best;
  return null;
}
