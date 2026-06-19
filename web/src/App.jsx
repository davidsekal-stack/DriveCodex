import { useState, useCallback } from "react";

import { MSG }                              from "./constants/enums.js";
import { signOut }                           from "./lib/supabase.js";
import * as storage                          from "./lib/storage.js";
import { ThemeProvider, useTheme }          from "./contexts/ThemeContext.jsx";
import AppHeader                            from "./components/AppHeader.jsx";
import AppSidebar                           from "./components/AppSidebar.jsx";
import CaseDialogs                          from "./components/CaseDialogs.jsx";
import GlobalStyles                         from "./components/GlobalStyles.jsx";
import LoadingScreen                        from "./components/LoadingScreen.jsx";
import NewCaseView                          from "./components/NewCaseView.jsx";
import SessionView                          from "./components/SessionView.jsx";
import LoginPage                            from "./components/LoginPage.jsx";
import ErrorBoundary                        from "./components/ErrorBoundary.jsx";
import ConsentGate                          from "./components/ConsentBanner.jsx";
import WelcomeView                          from "./components/WelcomeView.jsx";
import ReviewPanel                          from "./components/ReviewPanel.jsx";
import AnalyticsPanel                       from "./components/AnalyticsPanel.jsx";
import ManualChapterView                    from "./components/ManualChapterView.jsx";
import useAdminData                         from "./hooks/useAdminData.js";
import useAppBootstrapData                  from "./hooks/useAppBootstrapData.js";
import useAuthSession                       from "./hooks/useAuthSession.js";
import useCaseDraft                         from "./hooks/useCaseDraft.js";
import useCaseDialogs                       from "./hooks/useCaseDialogs.js";
import useCaseWorkflow                      from "./hooks/useCaseWorkflow.js";
import useCases                             from "./hooks/useCases.js";
import useRepairGuide                       from "./hooks/useRepairGuide.js";
import useGlobalShortcuts                   from "./hooks/useGlobalShortcuts.js";
import useIsMobile                          from "./hooks/useIsMobile.js";
import { useI18n }                          from "./i18n/index.jsx";

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "davidsekal@gmail.com").split(",").map((e) => e.trim());

const LANGS = [
  { code: "cs", label: "CS" },
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
];

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const { t, darkMode, toggleDarkMode } = useTheme();
  const { tr, lang, changeLang } = useI18n();
  const mobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { appReady, session, setSession } = useAuthSession();

  const [view,       setView]       = useState("welcome");
  const [manualSection, setManualSection] = useState(null);
  const [prevView,   setPrevView]   = useState("welcome");

  const {
    cases, activeCase, activeId, setActiveId,
    casesRef, updateCase, createCase,
    deleteCase: deleteCaseFromStore, loadCases, syncError, syncStatus,
  } = useCases();

  const {
    clearCloseError,
    closeCase,
    closeError,
    cloudStatus,
    error,
    handleCreateCase,
    handleDeleteCase: deleteCaseAction,
    loading,
    openCase,
    runDiag,
    setCloudStatus,
    startNewCase,
  } = useCaseWorkflow({
    activeId,
    casesRef,
    createCase,
    updateCase,
    deleteCase: deleteCaseFromStore,
    setActiveId,
    setView,
    setSidebarOpen,
    tr,
    lang,
  });

  const globalCaseCount = useAppBootstrapData({
    loadCases,
    session,
    setCloudStatus,
  });

  useGlobalShortcuts({ onStartNewCase: startNewCase });

  const {
    cancelCloseModal,
    cancelDeleteCase,
    changeResolution,
    closeModal,
    confirmCloseCase,
    confirmDeleteCase,
    deleteId,
    openCloseModal,
    requestDeleteCase,
    resolution,
  } = useCaseDialogs({
    clearCloseError,
    closeCase,
    deleteCaseAction,
  });

  const {
    defaultBrand,
    identHistory,
    newVehicle,
    setDefaultBrandState,
    setIdentHistory,
    setNewVehicle,
    submitNewCase,
  } = useCaseDraft({
    handleCreateCase,
    runDiag,
    tr,
  });

  const {
    cancelEndAttempt,
    cancelStartRepairGuide,
    confirmEndAttempt,
    confirmStartRepairGuide,
    pendingEndAttempt,
    pendingGuideStart,
    startRepairGuide,
    ...guideActions
  } = useRepairGuide({
    activeId,
    casesRef,
    updateCase,
  });

  const diagCount   = activeCase?.messages.filter((m) => m.type === MSG.DIAGNOSIS).length ?? 0;

  // Extract faults from the latest diagnosis for smart close modal
  const latestDiag = activeCase?.messages?.filter((m) => m.type === MSG.DIAGNOSIS).at(-1);
  const diagFaults = latestDiag?.result?.závady ?? [];

  const isAdmin = session && ADMIN_EMAILS.includes(session.user?.email);
  const { pendingReviewCount, refreshPendingCount } = useAdminData(session, isAdmin);

  const handleLogout = useCallback(async () => {
    await signOut();
    setSession(null);
    setView("welcome");
  }, [setSession, setView]);

  const handleOpenManual = useCallback((section) => {
    setPrevView(view);
    setManualSection(section);
    setView("manual");
  }, [view]);

  const handleBackFromManual = useCallback(() => {
    setView(prevView === "manual" ? "session" : prevView);
    setManualSection(null);
  }, [prevView]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!appReady) {
    return <LoadingScreen message={tr("app.loading")} />;
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!session) {
    return <LoginPage onAuth={setSession} />;
  }

  // ── Hlavní render ─────────────────────────────────────────────────────────
  return (
    <ConsentGate>
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: t.bg, color: t.text, fontFamily: "'Exo 2',sans-serif", overflow: "hidden", transition: "background 0.2s, color 0.2s" }}>
      <GlobalStyles />

      <AppHeader
        changeLang={changeLang}
        lang={lang}
        langs={LANGS}
        mobile={mobile}
        onLogout={handleLogout}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        session={session}
        sidebarOpen={sidebarOpen}
        tr={tr}
      />

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <AppSidebar
          activeId={activeId}
          cases={cases}
          cloudStatus={cloudStatus}
          globalCaseCount={globalCaseCount}
          isAdmin={isAdmin}
          lang={lang}
          mobile={mobile}
          onCloseSidebar={() => setSidebarOpen(false)}
          onOpenCase={openCase}
          onStartNewCase={startNewCase}
          onStartAnalytics={() => { setView("analytics"); setActiveId(null); setSidebarOpen(false); }}
          onStartReview={() => { setView("review"); setActiveId(null); setSidebarOpen(false); }}
          pendingReviewCount={pendingReviewCount}
          sidebarOpen={sidebarOpen}
          syncError={syncError}
          syncStatus={syncStatus}
          tr={tr}
          view={view}
        />

        {/* MAIN */}
        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* Manual chapter view */}
          {view === "manual" && manualSection && (
            <ManualChapterView
              section={manualSection}
              onBack={handleBackFromManual}
            />
          )}

          {/* Admin analytics */}
          {view === "analytics" && isAdmin && (
            <AnalyticsPanel
              tr={tr}
              fetchAnalytics={(days) => storage.fetchAnalytics(days)}
            />
          )}

          {/* Admin review */}
          {view === "review" && isAdmin && (
            <ReviewPanel
              lang={lang}
              tr={tr}
              fetchCases={() => storage.fetchReviewCases("pending")}
              updateStatus={(idOrIds, status, reason) => {
                return storage.updateCaseStatus(idOrIds, status, reason).then((res) => {
                  refreshPendingCount();
                  return res;
                });
              }}
            />
          )}

          {/* Welcome */}
          {view === "welcome" && (
            <WelcomeView mobile={mobile} onStartNewCase={startNewCase} tr={tr} />
          )}

          {/* Nový případ */}
          {view === "new" && (
            <NewCaseView
              cases={cases}
              defaultBrand={defaultBrand}
              error={error}
              identHistory={identHistory}
              lang={lang}
              loading={loading}
              mobile={mobile}
              newVehicle={newVehicle}
              onOpenCase={openCase}
              onSubmit={submitNewCase}
              setDefaultBrandState={setDefaultBrandState}
              setIdentHistory={setIdentHistory}
              setNewVehicle={setNewVehicle}
              tr={tr}
            />
          )}

          {/* Aktivní případ */}
          {view === "session" && activeCase && (
            <SessionView
              activeCase={activeCase}
              activeId={activeId}
              cases={cases}
              diagCount={diagCount}
              error={error}
              lang={lang}
              loading={loading}
              guideActions={guideActions}
              mobile={mobile}
              onOpenManual={handleOpenManual}
              onRequestCloseCase={openCloseModal}
              onRequestDelete={requestDeleteCase}
              onRunDiag={runDiag}
              onStartRepair={startRepairGuide}
              tr={tr}
            />
          )}
        </main>
      </div>

      <CaseDialogs
        cases={cases}
        closeError={closeError}
        closeModal={closeModal}
        deleteId={deleteId}
        faults={diagFaults}
        mobile={mobile}
        onCancelCloseCase={cancelCloseModal}
        onCancelDeleteCase={cancelDeleteCase}
        onCancelEndAttempt={cancelEndAttempt}
        onCancelReplaceGuide={cancelStartRepairGuide}
        onChangeResolution={changeResolution}
        onConfirmCloseCase={confirmCloseCase}
        onConfirmDeleteCase={confirmDeleteCase}
        onConfirmEndAttempt={confirmEndAttempt}
        onConfirmReplaceGuide={confirmStartRepairGuide}
        pendingEndAttempt={pendingEndAttempt}
        pendingGuideStart={pendingGuideStart}
        resolution={resolution}
        tr={tr}
      />

    </div>
    </ConsentGate>
  );
}

export default function WrappedApp() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
