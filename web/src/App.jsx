import { useState, useCallback } from "react";

import { DARK, LIGHT }                      from "./theme.js";
import { signOut }                           from "./lib/supabase.js";
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
import useAppBootstrapData                  from "./hooks/useAppBootstrapData.js";
import useAuthSession                       from "./hooks/useAuthSession.js";
import useCaseDraft                         from "./hooks/useCaseDraft.js";
import useCaseDialogs                       from "./hooks/useCaseDialogs.js";
import useCaseWorkflow                      from "./hooks/useCaseWorkflow.js";
import useCases                             from "./hooks/useCases.js";
import useGlobalShortcuts                   from "./hooks/useGlobalShortcuts.js";
import useIsMobile                          from "./hooks/useIsMobile.js";
import { useI18n }                          from "./i18n/index.jsx";

const LANGS = [
  { code: "cs", label: "CS" },
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
];

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [darkMode, setDarkMode] = useState(false);
  const t = darkMode ? DARK : LIGHT;
  const { tr, lang, changeLang } = useI18n();
  const mobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { appReady, session, setSession } = useAuthSession();

  const [view,       setView]       = useState("welcome");

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

  const diagCount   = activeCase?.messages.filter((m) => m.type === "diagnosis").length ?? 0;

  // Extract faults from the latest diagnosis for smart close modal
  const latestDiag = activeCase?.messages?.filter((m) => m.type === "diagnosis").at(-1);
  const diagFaults = latestDiag?.result?.závady ?? [];

  const handleLogout = useCallback(async () => {
    await signOut();
    setSession(null);
    setView("welcome");
  }, [setSession, setView]);

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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: t.bg, color: t.text, fontFamily: "'IBM Plex Mono','Courier New',monospace", overflow: "hidden", transition: "background 0.2s, color 0.2s" }}>
      <GlobalStyles t={t} darkMode={darkMode} />

      <AppHeader
        changeLang={changeLang}
        darkMode={darkMode}
        lang={lang}
        langs={LANGS}
        mobile={mobile}
        onLogout={handleLogout}
        onToggleDarkMode={() => setDarkMode((dark) => !dark)}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        session={session}
        sidebarOpen={sidebarOpen}
        t={t}
        tr={tr}
      />

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <AppSidebar
          activeId={activeId}
          cases={cases}
          cloudStatus={cloudStatus}
          globalCaseCount={globalCaseCount}
          lang={lang}
          mobile={mobile}
          onCloseSidebar={() => setSidebarOpen(false)}
          onOpenCase={openCase}
          onStartNewCase={startNewCase}
          sidebarOpen={sidebarOpen}
          syncError={syncError}
          syncStatus={syncStatus}
          t={t}
          tr={tr}
        />

        {/* MAIN */}
        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* Welcome */}
          {view === "welcome" && (
            <WelcomeView mobile={mobile} onStartNewCase={startNewCase} t={t} tr={tr} />
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
              t={t}
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
              mobile={mobile}
              onRequestCloseCase={openCloseModal}
              onRequestDelete={requestDeleteCase}
              onRunDiag={runDiag}
              t={t}
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
        onChangeResolution={changeResolution}
        onConfirmCloseCase={confirmCloseCase}
        onConfirmDeleteCase={confirmDeleteCase}
        resolution={resolution}
        t={t}
        tr={tr}
      />

    </div>
    </ConsentGate>
  );
}

export default function WrappedApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
