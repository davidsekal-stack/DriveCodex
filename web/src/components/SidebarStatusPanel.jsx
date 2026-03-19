import {
  getCloudStatusMeta,
  getGlobalCaseCountLabel,
  getSyncStatusMeta,
} from "../lib/sidebar-status.js";

function getToneColor(tone, t) {
  if (tone === "success") return t.doneStatusColor;
  if (tone === "danger") return "#dc2626";
  return t.textVeryFaint;
}

export default function SidebarStatusPanel({
  cloudStatus,
  globalCaseCount,
  syncError,
  syncStatus,
  t,
  tr,
}) {
  const cloudMeta = getCloudStatusMeta(cloudStatus, tr);
  const syncMeta = getSyncStatusMeta(syncStatus, tr);

  return (
    <>
      <div style={{ padding: "7px 12px", fontSize: "0.67rem", color: t.textVeryFaint, borderBottom: `1px solid ${t.border}` }}>
        {getGlobalCaseCountLabel(globalCaseCount, tr)}
      </div>
      <div style={{ padding: "7px 12px", fontSize: "0.67rem", color: getToneColor(cloudMeta.tone, t), display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5, borderBottom: `1px solid ${t.border}` }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span>{cloudMeta.icon}</span>
          <span>{cloudMeta.label}</span>
        </span>
      </div>
      <div title={syncError || ""} style={{ padding: "7px 12px", fontSize: "0.67rem", color: getToneColor(syncMeta.tone, t), borderBottom: `1px solid ${t.border}` }}>
        <span>{syncMeta.icon} {syncMeta.label}</span>
        {syncMeta.showWarning && (
          <div style={{ marginTop: 4, color: "#f87171", fontSize: "0.62rem", lineHeight: 1.5 }}>
            {tr("app.syncWarning")}
          </div>
        )}
      </div>
    </>
  );
}
