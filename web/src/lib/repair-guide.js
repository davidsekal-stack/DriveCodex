/**
 * Průvodce opravou — čistá logika (bez React, bez sítě).
 *
 * Z dokončené diagnózy složí krokový checklist pro mechanika:
 *   1. příprava dílů (fault.díly)
 *   2. jedna opravná akce na každou položku fault.řešení
 *   3. závěrečná kontrola (doporučené_testy)
 *
 * Stav průvodce žije na případu (case.repairGuide) a ukládá se spolu s ním
 * do gearbrain_web_sessions. startedAt/completedAt slouží i jako metrika
 * používání funkce.
 */

import { uid } from "./utils.js";

export const GUIDE_STEP = {
  PARTS: "parts",
  ACTION: "action",
  VERIFY: "verify",
};

/** DOM id karty průvodce — pro scroll z tlačítka „Pokračovat v opravě". */
export const REPAIR_GUIDE_CARD_ID = "repair-guide-card";

export const GUIDE_STEP_STATUS = {
  PENDING: "pending",
  DONE: "done",
  SKIPPED: "skipped",
};

const MAX_VERIFY_TESTS = 3;

/**
 * Sestaví nový průvodce pro jednu závadu z diagnózy.
 * Vrací null, když závada nemá žádné opravné akce (není z čeho stavět).
 */
export function buildRepairGuide({ fault, result, diagnosisMsgId, faultIndex }) {
  const actions = Array.isArray(fault?.řešení)
    ? fault.řešení.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
  if (actions.length === 0) return null;

  const steps = [];

  const parts = Array.isArray(fault.díly) ? fault.díly.filter(Boolean) : [];
  if (parts.length > 0) {
    steps.push({ id: uid(), kind: GUIDE_STEP.PARTS, detail: parts, status: GUIDE_STEP_STATUS.PENDING });
  }

  for (const action of actions) {
    steps.push({ id: uid(), kind: GUIDE_STEP.ACTION, title: action.trim(), status: GUIDE_STEP_STATUS.PENDING });
  }

  const tests = Array.isArray(result?.doporučené_testy)
    ? result.doporučené_testy.filter((item) => typeof item === "string" && item.trim().length > 0).slice(0, MAX_VERIFY_TESTS)
    : [];
  steps.push({ id: uid(), kind: GUIDE_STEP.VERIFY, detail: tests, status: GUIDE_STEP_STATUS.PENDING });

  return {
    faultName: fault.název ?? "",
    zdroj: fault.zdroj === "databáze" ? "databáze" : "ai",
    početShod: fault.početShod ?? 0,
    diagnosisMsgId: diagnosisMsgId ?? null,
    faultIndex: typeof faultIndex === "number" ? faultIndex : null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    steps,
  };
}

/**
 * Nastaví stav kroku (done/skipped). Mění jen kroky ve stavu pending —
 * dokončený krok nelze omylem přepsat. Když nezbývá žádný pending krok,
 * průvodce dostane completedAt.
 */
export function setGuideStepStatus(guide, stepId, status) {
  if (!guide || !Array.isArray(guide.steps)) return guide;
  if (status !== GUIDE_STEP_STATUS.DONE && status !== GUIDE_STEP_STATUS.SKIPPED) return guide;

  const steps = guide.steps.map((step) =>
    step.id === stepId && step.status === GUIDE_STEP_STATUS.PENDING
      ? { ...step, status, doneAt: new Date().toISOString() }
      : step,
  );

  const allResolved = steps.every((step) => step.status !== GUIDE_STEP_STATUS.PENDING);

  return {
    ...guide,
    steps,
    completedAt: allResolved ? (guide.completedAt ?? new Date().toISOString()) : null,
  };
}

/** První nevyřízený krok — ten, na kterém mechanik právě je. */
export function getActiveGuideStep(guide) {
  return guide?.steps?.find((step) => step.status === GUIDE_STEP_STATUS.PENDING) ?? null;
}

/** Postup průvodce: { done, total } — done zahrnuje i přeskočené kroky. */
export function getGuideProgress(guide) {
  const steps = Array.isArray(guide?.steps) ? guide.steps : [];
  const done = steps.filter((step) => step.status !== GUIDE_STEP_STATUS.PENDING).length;
  return { done, total: steps.length };
}

/** True, když mechanik už nějaký krok odbavil (chrání rozdělanou práci). */
export function hasGuideProgress(guide) {
  return Boolean(guide?.steps?.some((step) => step.status !== GUIDE_STEP_STATUS.PENDING));
}

/** True, když průvodce patří k dané závadě dané diagnózy. */
export function isGuideForFault(guide, diagnosisMsgId, faultIndex) {
  return Boolean(
    guide
    && guide.diagnosisMsgId === diagnosisMsgId
    && guide.faultIndex === faultIndex,
  );
}
