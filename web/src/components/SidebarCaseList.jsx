import { buildSidebarCaseSubtitle } from "../lib/sidebar-case-list.js";
import StatusBadge from "./StatusBadge.jsx";

export default function SidebarCaseList({
  activeId,
  cases,
  lang,
  onOpenCase,
  t,
  tr,
}) {
  if (cases.length === 0) {
    return (
      <div style={{ padding: "24px 12px", textAlign: "center", color: t.textVeryFaint, fontSize: "0.75rem", lineHeight: 1.8 }}>
        {tr("app.noCases")}<br />{tr("app.noCasesHint")}
      </div>
    );
  }

  return cases.map((kase) => (
    <div
      key={kase.id}
      className="case-item"
      onClick={() => onOpenCase(kase.id)}
      style={{ padding: "10px 12px", borderLeft: `3px solid ${activeId === kase.id ? t.accent : "transparent"}`, background: activeId === kase.id ? t.bgSelected : "transparent", borderBottom: `1px solid ${t.border}`, cursor: "pointer", userSelect: "none" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 3 }}>
        <div style={{ fontSize: "0.75rem", color: activeId === kase.id ? t.text : t.textLabel, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: activeId === kase.id ? 600 : 400 }}>
          {kase.name}
        </div>
        <StatusBadge status={kase.status} t={t} tr={tr} />
      </div>
      <div style={{ fontSize: "0.65rem", color: t.textVeryFaint }}>
        {buildSidebarCaseSubtitle(kase, lang)}
      </div>
    </div>
  ));
}
