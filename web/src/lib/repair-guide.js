/**
 * Průvodce opravou — čistá logika (bez React, bez sítě). Verze 2.
 *
 * Model vychází ze zpětné vazby panelu mechaniků: opravy z pole `řešení`
 * jsou ALTERNATIVY, ne sekvence. Průvodce proto vede mechanika ve třech
 * fázích v řemeslně správném pořadí:
 *
 *   1. OVĚŘENÍ PŘÍČINY  — doporučené testy diagnózy (nejdřív měřit!)
 *   2. MOŽNÉ OPRAVY     — mechanik VYBERE jednu akci, provede ji a odpoví
 *                         „pomohlo/nepomohlo"; zbylé akce se při úspěchu
 *                         označí jako nepotřebné, při neúspěchu zkouší dál
 *   3. ZÁVĚREČNÁ KONTROLA — zkušební jízda; výsledek „vyřešeno" NEBO
 *                         „závada přetrvává" (neúspěch je platný konec!)
 *
 * Každý krok jde vrátit, dokud případ není uzavřen. Nahrazený nebo
 * neúspěšný pokus se NEMAŽE — archivuje se do case.repairGuideHistory.
 * Díly nejsou krok č. 1, jen informace u oprav (neobjednávat předem).
 *
 * Stav žije na případu (case.repairGuide) a ukládá se spolu s ním.
 * startedAt/completedAt/doneAt slouží i jako metrika používání.
 */

import { uid } from "./utils.js";

export const GUIDE_VERSION = 2;

/** DOM id karty průvodce — pro scroll z tlačítka „Pokračovat v opravě". */
export const REPAIR_GUIDE_CARD_ID = "repair-guide-card";

export const TEST_STATUS = {
  PENDING: "pending",
  DONE: "done",
  SKIPPED: "skipped",
};

export const ACTION_STATUS = {
  PENDING: "pending",       // zatím nevyzkoušená možnost
  CHOSEN: "chosen",         // mechanik ji právě provádí
  HELPED: "helped",         // provedena a závada zmizela
  FAILED: "failed",         // provedena, ale nepomohla
  NOT_NEEDED: "not_needed", // nebylo potřeba (jiná akce pomohla)
};

export const GUIDE_OUTCOME = {
  SOLVED: "solved",
  PERSISTS: "persists",
};

export const GUIDE_PHASE = {
  TESTS: "tests",
  ACTIONS: "actions",
  FINAL: "final",
  DONE: "done",
};

const now = () => new Date().toISOString();
const isV2 = (guide) => guide?.version === GUIDE_VERSION;

/**
 * Sestaví nový průvodce pro jednu závadu z diagnózy.
 * Vrací null, když závada nemá žádné opravné akce (není z čeho stavět).
 */
export function buildRepairGuide({ fault, result, diagnosisMsgId, faultIndex }) {
  const actionTitles = Array.isArray(fault?.řešení)
    ? fault.řešení.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
  if (actionTitles.length === 0) return null;

  const tests = (Array.isArray(result?.doporučené_testy) ? result.doporučené_testy : [])
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .map((title) => ({ id: uid(), title: title.trim(), status: TEST_STATUS.PENDING }));

  const actions = actionTitles.map((title) => ({
    id: uid(),
    title: title.trim(),
    status: ACTION_STATUS.PENDING,
  }));

  const varování = typeof result?.varování === "string" && result.varování.trim()
    ? result.varování.trim()
    : null;

  return {
    version: GUIDE_VERSION,
    faultName: fault.název ?? "",
    zdroj: fault.zdroj === "databáze" ? "databáze" : "ai",
    početShod: fault.početShod ?? 0,
    diagnosisMsgId: diagnosisMsgId ?? null,
    faultIndex: typeof faultIndex === "number" ? faultIndex : null,
    varování,
    díly: Array.isArray(fault.díly) ? fault.díly.filter(Boolean) : [],
    startedAt: now(),
    completedAt: null,
    outcome: null,
    tests,
    actions,
    finalCheck: { id: uid(), status: TEST_STATUS.PENDING, doneAt: null },
  };
}

/** Aktuální fáze průvodce. */
export function getGuidePhase(guide) {
  if (!isV2(guide)) return null;
  if (guide.outcome) return GUIDE_PHASE.DONE;
  if (guide.tests.some((t) => t.status === TEST_STATUS.PENDING)) return GUIDE_PHASE.TESTS;
  if (guide.actions.some((a) => a.status === ACTION_STATUS.HELPED)) return GUIDE_PHASE.FINAL;
  return GUIDE_PHASE.ACTIONS;
}

/** První nevyřízený test — ten, na kterém mechanik právě je. */
export function getActiveTest(guide) {
  if (getGuidePhase(guide) !== GUIDE_PHASE.TESTS) return null;
  return guide.tests.find((t) => t.status === TEST_STATUS.PENDING) ?? null;
}

/** Právě prováděná oprava (chosen), pokud nějaká je. */
export function getChosenAction(guide) {
  if (!isV2(guide)) return null;
  return guide.actions.find((a) => a.status === ACTION_STATUS.CHOSEN) ?? null;
}

/** True, když všechny opravy byly vyzkoušeny a žádná nepomohla. */
export function allActionsFailed(guide) {
  if (!isV2(guide)) return false;
  return guide.actions.length > 0
    && guide.actions.every((a) => a.status === ACTION_STATUS.FAILED);
}

// ── Přechody: testy ──────────────────────────────────────────────────────────

export function setTestStatus(guide, testId, status) {
  if (!isV2(guide) || guide.outcome) return guide;
  if (status !== TEST_STATUS.DONE && status !== TEST_STATUS.SKIPPED) return guide;
  return {
    ...guide,
    tests: guide.tests.map((t) =>
      t.id === testId && t.status === TEST_STATUS.PENDING
        ? { ...t, status, doneAt: now() }
        : t,
    ),
  };
}

export function undoTest(guide, testId) {
  if (!isV2(guide) || guide.outcome) return guide;
  return {
    ...guide,
    tests: guide.tests.map((t) =>
      t.id === testId && t.status !== TEST_STATUS.PENDING
        ? { ...t, status: TEST_STATUS.PENDING, doneAt: null }
        : t,
    ),
  };
}

// ── Přechody: opravy ─────────────────────────────────────────────────────────

/**
 * Mechanik si vybral opravu, kterou provede. Jen jedna může být rozpracovaná
 * a jen ve fázi oprav — dokud nejsou odbavené testy, opravy se nevybírají
 * (nejdřív měřit, pak měnit).
 */
export function chooseAction(guide, actionId) {
  if (!isV2(guide) || guide.outcome) return guide;
  if (getGuidePhase(guide) !== GUIDE_PHASE.ACTIONS) return guide;
  if (getChosenAction(guide)) return guide;
  return {
    ...guide,
    actions: guide.actions.map((a) =>
      a.id === actionId && a.status === ACTION_STATUS.PENDING
        ? { ...a, status: ACTION_STATUS.CHOSEN, chosenAt: now() }
        : a,
    ),
  };
}

/** Vrátí rozpracovanou opravu zpět mezi možnosti (špatný výběr / omyl). */
export function unchooseAction(guide, actionId) {
  if (!isV2(guide) || guide.outcome) return guide;
  return {
    ...guide,
    actions: guide.actions.map((a) =>
      a.id === actionId && a.status === ACTION_STATUS.CHOSEN
        ? { ...a, status: ACTION_STATUS.PENDING, chosenAt: null }
        : a,
    ),
  };
}

/**
 * Výsledek provedené opravy: pomohla → zbylé možnosti označí jako
 * nepotřebné a jde se na závěrečnou kontrolu; nepomohla → zkouší se dál.
 */
export function resolveAction(guide, actionId, helped) {
  if (!isV2(guide) || guide.outcome) return guide;
  const chosen = guide.actions.find((a) => a.id === actionId);
  if (!chosen || chosen.status !== ACTION_STATUS.CHOSEN) return guide;

  return {
    ...guide,
    actions: guide.actions.map((a) => {
      if (a.id === actionId) {
        return { ...a, status: helped ? ACTION_STATUS.HELPED : ACTION_STATUS.FAILED, resolvedAt: now() };
      }
      if (helped && a.status === ACTION_STATUS.PENDING) {
        return { ...a, status: ACTION_STATUS.NOT_NEEDED };
      }
      return a;
    }),
  };
}

/**
 * Vrátí vyřízenou opravu zpět. U opravy „pomohla" se vrací i nepotřebné
 * možnosti a závěrečná kontrola (celá větev za ní pozbyla platnosti).
 */
export function undoAction(guide, actionId) {
  if (!isV2(guide) || guide.outcome) return guide;
  const target = guide.actions.find((a) => a.id === actionId);
  if (!target) return guide;

  if (target.status === ACTION_STATUS.FAILED) {
    return {
      ...guide,
      actions: guide.actions.map((a) =>
        a.id === actionId ? { ...a, status: ACTION_STATUS.PENDING, resolvedAt: null } : a,
      ),
    };
  }

  if (target.status === ACTION_STATUS.HELPED) {
    return {
      ...guide,
      actions: guide.actions.map((a) => {
        if (a.id === actionId) return { ...a, status: ACTION_STATUS.PENDING, resolvedAt: null };
        if (a.status === ACTION_STATUS.NOT_NEEDED) return { ...a, status: ACTION_STATUS.PENDING };
        return a;
      }),
      finalCheck: { ...guide.finalCheck, status: TEST_STATUS.PENDING, doneAt: null },
    };
  }

  return guide;
}

// ── Přechody: závěr ──────────────────────────────────────────────────────────

/**
 * Výsledek pokusu. „solved" jen po závěrečné kontrole (fáze final);
 * „persists" jde i z fáze oprav, když žádná možnost nepomohla.
 */
export function setGuideOutcome(guide, outcome) {
  if (!isV2(guide) || guide.outcome) return guide;
  const phase = getGuidePhase(guide);

  if (outcome === GUIDE_OUTCOME.SOLVED) {
    if (phase !== GUIDE_PHASE.FINAL) return guide;
    return {
      ...guide,
      finalCheck: { ...guide.finalCheck, status: TEST_STATUS.DONE, doneAt: now() },
      outcome,
      completedAt: now(),
    };
  }

  if (outcome === GUIDE_OUTCOME.PERSISTS) {
    if (phase !== GUIDE_PHASE.FINAL && !allActionsFailed(guide)) return guide;
    return {
      ...guide,
      finalCheck: phase === GUIDE_PHASE.FINAL
        ? { ...guide.finalCheck, status: TEST_STATUS.DONE, doneAt: now() }
        : guide.finalCheck,
      outcome,
      completedAt: now(),
    };
  }

  return guide;
}

/** Vrátí výsledek pokusu (omyl) — dokud případ není uzavřen / pokus archivován. */
export function undoGuideOutcome(guide) {
  if (!isV2(guide) || !guide.outcome) return guide;
  return {
    ...guide,
    finalCheck: { ...guide.finalCheck, status: TEST_STATUS.PENDING, doneAt: null },
    outcome: null,
    completedAt: null,
  };
}

// ── Archivace pokusů ─────────────────────────────────────────────────────────

/** Uzavře pokus pro archiv (case.repairGuideHistory). Nikdy nemazat! */
export function archiveGuide(guide) {
  if (!guide) return null;
  return { ...guide, archivedAt: now() };
}

/** Souhrn archivovaného pokusu pro zobrazení v historii. */
export function getAttemptSummary(guide) {
  if (!isV2(guide)) return { faultName: guide?.faultName ?? "", failedActions: [], helpedAction: null };
  return {
    faultName: guide.faultName,
    failedActions: guide.actions.filter((a) => a.status === ACTION_STATUS.FAILED).map((a) => a.title),
    helpedAction: guide.actions.find((a) => a.status === ACTION_STATUS.HELPED)?.title ?? null,
  };
}

// ── Dotazy pro UI ────────────────────────────────────────────────────────────

/** Postup: testy + jedna „oprava" + jedna „kontrola". */
export function getGuideProgress(guide) {
  if (!isV2(guide)) return { done: 0, total: 0 };
  const testsDone = guide.tests.filter((t) => t.status !== TEST_STATUS.PENDING).length;
  const actionsDone = guide.actions.some((a) => a.status === ACTION_STATUS.HELPED) || allActionsFailed(guide) ? 1 : 0;
  const finalDone = guide.outcome ? 1 : 0;
  return {
    done: testsDone + actionsDone + finalDone,
    total: guide.tests.length + 2,
  };
}

/** True, když mechanik už něco odbavil (chrání rozdělanou práci). */
export function hasGuideProgress(guide) {
  if (!isV2(guide)) return false;
  return guide.outcome !== null
    || guide.tests.some((t) => t.status !== TEST_STATUS.PENDING)
    || guide.actions.some((a) => a.status !== ACTION_STATUS.PENDING);
}

/** True, když průvodce patří k dané závadě dané diagnózy. */
export function isGuideForFault(guide, diagnosisMsgId, faultIndex) {
  return Boolean(
    guide
    && guide.diagnosisMsgId === diagnosisMsgId
    && guide.faultIndex === faultIndex,
  );
}
