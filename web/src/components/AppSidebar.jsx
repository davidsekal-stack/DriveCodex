import { useTheme } from "../contexts/ThemeContext.jsx";
import useSidebarFeedback from "../hooks/useSidebarFeedback.js";
import SidebarCaseList from "./SidebarCaseList.jsx";
import SidebarFeedback from "./SidebarFeedback.jsx";
import SidebarStatusPanel from "./SidebarStatusPanel.jsx";

export default function AppSidebar({
  activeId,
  cases,
  cloudStatus,
  globalCaseCount,
  isAdmin,
  lang,
  mobile,
  onCloseSidebar,
  onOpenCase,
  onStartAnalytics,
  onStartNewCase,
  onStartReview,
  pendingReviewCount,
  sidebarOpen,
  syncError,
  syncStatus,
  tr,
  view,
}) {
  const { t } = useTheme();
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
          <button onClick={onStartNewCase} data-testid="new-case-btn"
            style={{ width: "100%", background: t.accent, color: "#fff", border: "none", cursor: "pointer", padding: "10px", fontSize: "0.78rem", letterSpacing: "0.1em", fontWeight: 700, fontFamily: "inherit", borderRadius: 2, clipPath: "polygon(5px 0%,100% 0%,calc(100% - 5px) 100%,0% 100%)" }}>
            {tr("app.newCase")}
          </button>
          {isAdmin && (
            <button onClick={onStartReview}
              style={{ width: "100%", marginTop: 6, background: view === "review" ? t.bgSelected : "transparent", border: `1px solid ${t.border}`, cursor: "pointer", padding: "8px 10px", fontSize: "0.75rem", letterSpacing: "0.06em", fontWeight: 500, fontFamily: "inherit", borderRadius: 2, color: t.textMuted, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{tr("review.sidebarBtn")}</span>
              {pendingReviewCount > 0 && (
                <span style={{ background: "#dc2626", color: "#fff", fontSize: "0.6rem", fontWeight: 700, padding: "1px 6px", borderRadius: 8, minWidth: 18, textAlign: "center" }}>
                  {pendingReviewCount}
                </span>
              )}
            </button>
          )}
          {isAdmin && (
            <button onClick={onStartAnalytics}
              style={{ width: "100%", marginTop: 6, background: view === "analytics" ? t.bgSelected : "transparent", border: `1px solid ${t.border}`, cursor: "pointer", padding: "8px 10px", fontSize: "0.75rem", letterSpacing: "0.06em", fontWeight: 500, fontFamily: "inherit", borderRadius: 2, color: t.textMuted, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{tr("analytics.sidebarBtn")}</span>
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          <SidebarCaseList
            activeId={activeId}
            cases={cases}
            lang={lang}
            onOpenCase={onOpenCase}
            tr={tr}
          />
        </div>

        <div style={{ borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
          <SidebarStatusPanel
            cloudStatus={cloudStatus}
            globalCaseCount={globalCaseCount}
            tr={tr}
          />
          <SidebarFeedback
            feedbackStatus={feedbackStatus}
            feedbackText={feedbackText}
            onChangeText={setFeedbackText}
            onSubmit={submitFeedback}
            tr={tr}
          />
        </div>
      </aside>
    </>
  );
}
