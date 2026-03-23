import useSidebarFeedback from "../hooks/useSidebarFeedback.js";
import SidebarCaseList from "./SidebarCaseList.jsx";
import SidebarFeedback from "./SidebarFeedback.jsx";
import SidebarStatusPanel from "./SidebarStatusPanel.jsx";

export default function AppSidebar({
  activeId,
  cases,
  cloudStatus,
  globalCaseCount,
  lang,
  mobile,
  onCloseSidebar,
  onOpenCase,
  onStartNewCase,
  sidebarOpen,
  syncError,
  syncStatus,
  t,
  tr,
}) {
  const {
    feedbackStatus,
    feedbackText,
    setFeedbackText,
    submitFeedback,
  } = useSidebarFeedback({ lang });

  return (
    <>
      {mobile && sidebarOpen && (
        <div onClick={onCloseSidebar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 49 }} />
      )}

      <aside style={{
        ...(mobile
          ? { position: "fixed", top: 52, left: 0, bottom: 0, width: 280, zIndex: 50, transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.2s ease" }
          : { width: 264, flexShrink: 0 }),
        borderRight: `1px solid ${t.border}`,
        display: "flex",
        flexDirection: "column",
        background: t.bgSidebar,
      }}>
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.border}` }}>
          <button onClick={onStartNewCase}
            style={{ width: "100%", background: t.accent, color: "#fff", border: "none", cursor: "pointer", padding: "10px", fontSize: "0.78rem", letterSpacing: "0.1em", fontWeight: 700, fontFamily: "inherit", borderRadius: 2, clipPath: "polygon(5px 0%,100% 0%,calc(100% - 5px) 100%,0% 100%)" }}>
            {tr("app.newCase")}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          <SidebarCaseList
            activeId={activeId}
            cases={cases}
            lang={lang}
            onOpenCase={onOpenCase}
            t={t}
            tr={tr}
          />
        </div>

        <div style={{ borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
          <SidebarStatusPanel
            cloudStatus={cloudStatus}
            globalCaseCount={globalCaseCount}
            t={t}
            tr={tr}
          />
          <SidebarFeedback
            feedbackStatus={feedbackStatus}
            feedbackText={feedbackText}
            onChangeText={setFeedbackText}
            onSubmit={submitFeedback}
            t={t}
            tr={tr}
          />
        </div>
      </aside>
    </>
  );
}
