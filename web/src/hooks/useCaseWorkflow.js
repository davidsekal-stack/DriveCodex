import { useCallback, useState } from "react";

import { CASE_STATUS } from "../constants/enums.js";
import { validateResolution } from "../lib/validation.js";
import { executeDiagnosis } from "../lib/run-diagnosis.js";
import * as storage from "../lib/storage.js";
import { hasConsent } from "../components/ConsentBanner.jsx";

export default function useCaseWorkflow({
  activeId,
  casesRef,
  createCase,
  updateCase,
  deleteCase,
  setActiveId,
  setView,
  setSidebarOpen,
  tr,
  lang,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [closeError, setCloseError] = useState(null);
  const [cloudStatus, setCloudStatus] = useState("idle");

  const clearError = useCallback(() => setError(null), []);
  const clearCloseError = useCallback(() => setCloseError(null), []);

  const startNewCase = useCallback(() => {
    setView("new");
    setActiveId(null);
    setError(null);
    setSidebarOpen(false);
  }, [setActiveId, setSidebarOpen, setView]);

  const handleCreateCase = useCallback((vehicle) => {
    const id = createCase(vehicle);
    setView("session");
    return id;
  }, [createCase, setView]);

  const runDiag = useCallback(async (caseId, inputData) => {
    setLoading(true);
    setError(null);

    const currentCase = casesRef.current.find((item) => item.id === caseId) ?? {};

    try {
      const result = await executeDiagnosis({
        currentCase,
        inputData,
        callAI: storage.callAI,
        searchCases: storage.searchCases,
        tr,
        lang,
      });

      setCloudStatus(result.cloudStatus);

      // Add input message first, then diagnosis
      updateCase(caseId, (storedCase) => ({
        messages: [...storedCase.messages, result.inputMsg, result.diagnosisMsg],
        name: result.caseName ?? storedCase.name,
        tokenCount: (storedCase.tokenCount ?? 0) + result.usedTokens,
      }));
    } catch (cause) {
      setError(tr("app.errorPrefix") + cause.message);
    } finally {
      setLoading(false);
    }
  }, [casesRef, lang, tr, updateCase]);

  const closeCase = useCallback(async (resolutionText) => {
    const trimmedResolution = resolutionText.trim();
    if (!trimmedResolution || !activeId) return { ok: false };

    const validation = validateResolution(trimmedResolution, lang);
    if (!validation.ok) {
      setCloseError(validation.reason);
      return { ok: false };
    }

    const currentCase = casesRef.current.find((item) => item.id === activeId);
    const closedAt = new Date().toISOString();

    updateCase(activeId, () => ({
      status: CASE_STATUS.CLOSED,
      closedAt,
      resolution: trimmedResolution,
    }));

    if (currentCase && hasConsent()) {
      const fullCase = {
        ...currentCase,
        status: CASE_STATUS.CLOSED,
        closedAt,
        resolution: trimmedResolution,
      };
      storage.pushClosedCase(fullCase)
        .then((result) => {
          if (!result.ok) console.warn("[rag push]", result.error);
        })
        .catch((cause) => {
          console.warn("[rag push]", cause.message);
        });
    }

    setCloseError(null);
    return { ok: true };
  }, [activeId, casesRef, lang, updateCase]);

  const handleDeleteCase = useCallback((id) => {
    deleteCase(id);
    if (activeId === id) setView("welcome");
  }, [activeId, deleteCase, setView]);

  const openCase = useCallback((id) => {
    setActiveId(id);
    setView("session");
    setError(null);
    setSidebarOpen(false);
  }, [setActiveId, setSidebarOpen, setView]);

  return {
    clearCloseError,
    clearError,
    closeCase,
    closeError,
    cloudStatus,
    error,
    handleCreateCase,
    handleDeleteCase,
    loading,
    openCase,
    runDiag,
    setCloudStatus,
    startNewCase,
  };
}
