import { useCallback, useState } from "react";

import {
  GUIDE_OUTCOME,
  TEST_STATUS,
  archiveGuide,
  buildRepairGuide,
  chooseAction,
  hasGuideProgress,
  resolveAction,
  setGuideOutcome,
  setTestStatus,
  unchooseAction,
  undoAction,
  undoGuideOutcome,
  undoTest,
} from "../lib/repair-guide.js";

/**
 * useRepairGuide — akce průvodce opravou nad aktivním případem.
 *
 * Průvodce se ukládá jako case.repairGuide přes updateCase (debounced save).
 * Pokusy se NIKDY nemažou: nahrazení i ukončení neúspěšného pokusu
 * archivuje průvodce do case.repairGuideHistory. Rozdělaný pokus se
 * nenahrazuje mlčky — startRepairGuide si vyžádá potvrzení přes
 * pendingGuideStart (App renderuje ConfirmModal).
 */
export default function useRepairGuide({ activeId, casesRef, updateCase }) {
  const [pendingGuideStart, setPendingGuideStart] = useState(null);
  const [pendingEndAttempt, setPendingEndAttempt] = useState(null);

  const updateGuide = useCallback((transform) => {
    if (!activeId) return;
    updateCase(activeId, (storedCase) => ({
      repairGuide: transform(storedCase.repairGuide),
    }));
  }, [activeId, updateCase]);

  const applyGuide = useCallback((message, faultIndex) => {
    if (!activeId) return;
    const fault = message?.result?.závady?.[faultIndex];
    const guide = buildRepairGuide({
      fault,
      result: message?.result,
      diagnosisMsgId: message?.id,
      faultIndex,
    });
    if (!guide) return;
    updateCase(activeId, (storedCase) => {
      const existing = storedCase.repairGuide;
      const history = storedCase.repairGuideHistory ?? [];
      return {
        repairGuide: guide,
        repairGuideHistory: existing && hasGuideProgress(existing)
          ? [...history, archiveGuide(existing)]
          : history,
      };
    });
  }, [activeId, updateCase]);

  const startRepairGuide = useCallback((message, faultIndex) => {
    if (!activeId) return;
    const currentCase = casesRef.current.find((item) => item.id === activeId);
    const existing = currentCase?.repairGuide;

    if (existing && hasGuideProgress(existing)) {
      setPendingGuideStart({ message, faultIndex, faultName: existing.faultName });
      return;
    }
    applyGuide(message, faultIndex);
  }, [activeId, applyGuide, casesRef]);

  const confirmStartRepairGuide = useCallback(() => {
    if (!pendingGuideStart) return;
    applyGuide(pendingGuideStart.message, pendingGuideStart.faultIndex);
    setPendingGuideStart(null);
  }, [applyGuide, pendingGuideStart]);

  const cancelStartRepairGuide = useCallback(() => {
    setPendingGuideStart(null);
  }, []);

  // ── Testy (ověření příčiny) ────────────────────────────────────────────────
  const completeTest = useCallback((testId) => {
    updateGuide((guide) => setTestStatus(guide, testId, TEST_STATUS.DONE));
  }, [updateGuide]);

  const skipTest = useCallback((testId) => {
    updateGuide((guide) => setTestStatus(guide, testId, TEST_STATUS.SKIPPED));
  }, [updateGuide]);

  const revertTest = useCallback((testId) => {
    updateGuide((guide) => undoTest(guide, testId));
  }, [updateGuide]);

  // ── Opravy (volba + výsledek) ──────────────────────────────────────────────
  const startAction = useCallback((actionId) => {
    updateGuide((guide) => chooseAction(guide, actionId));
  }, [updateGuide]);

  const cancelAction = useCallback((actionId) => {
    updateGuide((guide) => unchooseAction(guide, actionId));
  }, [updateGuide]);

  const actionHelped = useCallback((actionId) => {
    updateGuide((guide) => resolveAction(guide, actionId, true));
  }, [updateGuide]);

  const actionFailed = useCallback((actionId) => {
    updateGuide((guide) => resolveAction(guide, actionId, false));
  }, [updateGuide]);

  const revertAction = useCallback((actionId) => {
    updateGuide((guide) => undoAction(guide, actionId));
  }, [updateGuide]);

  // ── Závěr pokusu ───────────────────────────────────────────────────────────
  const finalSolved = useCallback(() => {
    updateGuide((guide) => setGuideOutcome(guide, GUIDE_OUTCOME.SOLVED));
  }, [updateGuide]);

  const finalPersists = useCallback(() => {
    updateGuide((guide) => setGuideOutcome(guide, GUIDE_OUTCOME.PERSISTS));
  }, [updateGuide]);

  const revertOutcome = useCallback(() => {
    updateGuide((guide) => undoGuideOutcome(guide));
  }, [updateGuide]);

  /**
   * Ukončení neúspěšného pokusu je jediný nevratný krok průvodce —
   * proto jde přes potvrzovací dialog (pendingEndAttempt → ConfirmModal).
   */
  const endAttempt = useCallback(() => {
    if (!activeId) return;
    const currentCase = casesRef.current.find((item) => item.id === activeId);
    const guide = currentCase?.repairGuide;
    if (!guide) return;
    setPendingEndAttempt({ faultName: guide.faultName });
  }, [activeId, casesRef]);

  const confirmEndAttempt = useCallback(() => {
    setPendingEndAttempt(null);
    if (!activeId) return;
    updateCase(activeId, (storedCase) => {
      const existing = storedCase.repairGuide;
      if (!existing) return {};
      return {
        repairGuide: null,
        repairGuideHistory: [...(storedCase.repairGuideHistory ?? []), archiveGuide(existing)],
      };
    });
  }, [activeId, updateCase]);

  const cancelEndAttempt = useCallback(() => {
    setPendingEndAttempt(null);
  }, []);

  return {
    actionFailed,
    actionHelped,
    cancelAction,
    cancelEndAttempt,
    cancelStartRepairGuide,
    completeTest,
    confirmEndAttempt,
    confirmStartRepairGuide,
    endAttempt,
    finalPersists,
    finalSolved,
    pendingEndAttempt,
    pendingGuideStart,
    revertAction,
    revertOutcome,
    revertTest,
    skipTest,
    startAction,
    startRepairGuide,
  };
}
