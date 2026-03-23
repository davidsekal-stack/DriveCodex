import { ACTIVE_BRAND_DROPDOWN_OPTIONS, findIdentHistory, getBrandModels, getModelPowers, setDefaultBrand } from "../constants/index.js";
import { fmtDate } from "../lib/utils.js";
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
  t,
  tr,
}) {
  const modelOptions = getBrandModels(newVehicle.brand);
  const powers = getModelPowers(newVehicle.model);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: mobile ? "14px 10px" : "24px", background: t.bg }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: mobile ? 14 : 20 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: mobile ? "1.2rem" : "1.5rem", fontWeight: 700, color: t.accent, letterSpacing: "0.05em", marginBottom: 4 }}>{tr("app.newCaseTitle")}</div>
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
                }}
                style={{ flex: 1, background: t.bgInput, border: `1px solid ${t.borderInput}`, color: t.text, padding: "9px 10px", fontSize: "0.82rem", fontFamily: "inherit", borderRadius: 2, outline: "none", textTransform: "uppercase" }} />
            </div>
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
        <InputForm onSubmit={onSubmit} loading={loading} label={tr("app.startDiag")} t={t} vehicle={newVehicle} />
      </div>
    </div>
  );
}
