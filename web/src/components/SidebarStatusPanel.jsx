import { useTheme } from "../contexts/ThemeContext.jsx";

export default function SidebarStatusPanel({
  cloudStatus,
  globalCaseCount,
  tr,
}) {
  const { t } = useTheme();
  const isActive = cloudStatus === "ok";
  const isError = cloudStatus === "error";

  let label;
  let color;

  if (isError) {
    label = tr("app.dbInactive");
    color = "#dc2626";
  } else if (isActive && globalCaseCount > 0) {
    label = tr("app.dbActive", { count: globalCaseCount });
    color = t.doneStatusColor;
  } else if (isActive && globalCaseCount === 0) {
    label = tr("app.dbActiveEmpty");
    color = t.doneStatusColor;
  } else {
    label = tr("app.dbConnecting");
    color = t.textVeryFaint;
  }

  return (
    <div style={{ padding: "7px 12px", fontSize: "0.67rem", color, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: "0.5rem" }}>{isError ? "●" : isActive ? "●" : "○"}</span>
      <span>{label}</span>
    </div>
  );
}
