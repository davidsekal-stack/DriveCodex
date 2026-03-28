import { useCallback, useState } from "react";

import { uid } from "../lib/utils.js";
import { smartRepair, buildSystemPrompt, checkTopicRelevance, CASE_TOKEN_LIMIT } from "../lib/ai.js";
import { validateResolution } from "../lib/validation.js";
import {
  buildDiagnosedCaseName,
  buildDiagnosisUserPrompt,
  buildRagInput,
  collectCaseInputs,
  normalizeDiagnosisResult,
  removeMessageById,
  searchSimilarCases,
} from "../lib/diagnosis.js";
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

  const rollbackInputMessage = useCallback((caseId, inputMsgId) => {
    updateCase(caseId, (currentCase) => ({
      messages: removeMessageById(currentCase.messages, inputMsgId),
    }));
  }, [updateCase]);

  const runDiag = useCallback(async (caseId, inputData) => {
    setLoading(true);
    setError(null);

    const inputMsg = {
      id: uid(),
      type: "input",
      ...inputData,
      timestamp: new Date().toISOString(),
    };
    updateCase(caseId, (currentCase) => ({ messages: [...currentCase.messages, inputMsg] }));

    const currentCase = casesRef.current.find((item) => item.id === caseId) ?? {};
    const vehicle = currentCase.vehicle ?? {};
    const { allSymptoms, allObdCodes, allTexts } = collectCaseInputs(currentCase.messages ?? [], inputMsg);
    const ragInput = buildRagInput(vehicle, allSymptoms, allObdCodes, allTexts);
    const userPrompt = buildDiagnosisUserPrompt({ vehicle, allSymptoms, allObdCodes, allTexts, tr });

    const currentTokens = currentCase.tokenCount ?? 0;
    if (currentTokens >= CASE_TOKEN_LIMIT) {
      setError(tr("app.tokenLimit", { limit: CASE_TOKEN_LIMIT.toLocaleString() }));
      rollbackInputMessage(caseId, inputMsg.id);
      setLoading(false);
      return;
    }

    const freeText = inputData.text?.trim() ?? "";
    if (freeText && !inputData.symptoms?.length && !inputData.obdCodes?.length) {
      const topicCheck = checkTopicRelevance(freeText, lang);
      if (!topicCheck.ok) {
        setError(topicCheck.reason);
        rollbackInputMessage(caseId, inputMsg.id);
        setLoading(false);
        return;
      }
    }

    const { cases: similarCases = [], ok: searchOk } = await searchSimilarCases(storage.searchCases, ragInput);
    setCloudStatus(searchOk ? "ok" : "error");

    try {
      const data = await storage.callAI({
        systemPrompt: buildSystemPrompt(similarCases, vehicle, lang),
        userMessage: userPrompt,
        maxTokens: 4000,
      });

      if (data.error) throw new Error(data.error.message || tr("app.aiError"));
      if (!data.content) throw new Error(tr("app.aiNoResponse"));

      const raw = data.content.map((block) => block.text ?? "").join("");
      const parsed = smartRepair(raw);
      if (!parsed) throw new Error(tr("app.aiUnreadable"));
      if (!parsed.závady?.length) throw new Error(tr("app.noFaults"));

      const normalized = normalizeDiagnosisResult(parsed, tr, similarCases.length);
      const usedTokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
      const diagnosisMsg = {
        id: uid(),
        type: "diagnosis",
        result: normalized,
        ragMatchIds: similarCases.map((item) => item.id),
        ragMatches: similarCases.map((item) => ({
          id: item.id,
          localId: item.localId ?? null,
          threadUrl: item.threadUrl ?? null,
          sourceRef: item.sourceRef ?? null,
          ragScore: item.ragScore ?? null,
          vehicle: item.vehicle ?? null,
          resolution: item.resolution ?? "",
        })),
        tokensUsed: usedTokens,
        timestamp: new Date().toISOString(),
      };

      updateCase(caseId, (storedCase) => {
        const isFirstDiagnosis = storedCase.messages.filter((message) => message.type === "diagnosis").length === 0;
        return {
          messages: [...storedCase.messages, diagnosisMsg],
          name: isFirstDiagnosis
            ? buildDiagnosedCaseName(vehicle, normalized.závady?.[0]?.název, tr("app.defaultVehicle"))
            : storedCase.name,
          tokenCount: (storedCase.tokenCount ?? 0) + usedTokens,
        };
      });
    } catch (cause) {
      setError(tr("app.errorPrefix") + cause.message);
      rollbackInputMessage(caseId, inputMsg.id);
    } finally {
      setLoading(false);
    }
  }, [casesRef, lang, rollbackInputMessage, tr, updateCase]);

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
      status: "uzavřený",
      closedAt,
      resolution: trimmedResolution,
    }));

    if (currentCase && hasConsent()) {
      const fullCase = {
        ...currentCase,
        status: "uzavřený",
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
