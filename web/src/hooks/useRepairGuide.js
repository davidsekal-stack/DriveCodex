import { useCallback, useState } from "react";

import {
  GUIDE_STEP_STATUS,
  buildRepairGuide,
  hasGuideProgress,
  setGuideStepStatus,
} from "../lib/repair-guide.js";

/**
 * useRepairGuide — akce průvodce opravou nad aktivním případem.
 *
 * Průvodce se ukládá jako case.repairGuide přes updateCase (debounced save).
 * Rozdělaný průvodce se nenahrazuje mlčky — startRepairGuide si vyžádá
 * potvrzení přes pendingGuideStart (App renderuje ConfirmModal).
 */
export default function useRepairGuide({ activeId, casesRef, updateCase }) {
  const [pendingGuideStart, setPendingGuideStart] = useState(null);

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
    updateCase(activeId, () => ({ repairGuide: guide }));
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

  const completeGuideStep = useCallback((stepId) => {
    if (!activeId) return;
    updateCase(activeId, (storedCase) => ({
      repairGuide: setGuideStepStatus(storedCase.repairGuide, stepId, GUIDE_STEP_STATUS.DONE),
    }));
  }, [activeId, updateCase]);

  const skipGuideStep = useCallback((stepId) => {
    if (!activeId) return;
    updateCase(activeId, (storedCase) => ({
      repairGuide: setGuideStepStatus(storedCase.repairGuide, stepId, GUIDE_STEP_STATUS.SKIPPED),
    }));
  }, [activeId, updateCase]);

  return {
    cancelStartRepairGuide,
    completeGuideStep,
    confirmStartRepairGuide,
    pendingGuideStart,
    skipGuideStep,
    startRepairGuide,
  };
}
