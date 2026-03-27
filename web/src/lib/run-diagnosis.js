/**
 * Orchestrace diagnostiky — jeden run od vstupu po AI odpověď.
 * Čistá async funkce bez React hooků, testovatelná izolovaně.
 *
 * Vrací { diagnosisMsg, caseName, usedTokens } nebo throws Error.
 */

import { MSG } from "../constants/enums.js";
import { uid } from "./utils.js";
import { smartRepair, buildSystemPrompt, checkTopicRelevance } from "./ai.js";
import { CASE_TOKEN_LIMIT, AI_MAX_TOKENS } from "../constants/limits.js";
import {
  buildDiagnosedCaseName,
  buildDiagnosisUserPrompt,
  buildRagInput,
  collectCaseInputs,
  normalizeDiagnosisResult,
  searchSimilarCases,
} from "./diagnosis.js";
import { lookupDtcCodes, formatDtcBlock, getBrandGroup } from "./dtc-lookup.js";

/**
 * @param {Object} params
 * @param {Object} params.currentCase   — aktuální případ (vehicle, messages, tokenCount)
 * @param {Object} params.inputData     — { symptoms, obdCodes, text }
 * @param {Function} params.callAI      — storage.callAI
 * @param {Function} params.searchCases — storage.searchCases
 * @param {Function} params.tr          — i18n translate
 * @param {string} params.lang          — current language code
 * @returns {{ diagnosisMsg, caseName, usedTokens, cloudStatus }}
 */
export async function executeDiagnosis({ currentCase, inputData, callAI, searchCases, tr, lang }) {
  const vehicle = currentCase.vehicle ?? {};
  const messages = currentCase.messages ?? [];

  // Token limit check
  const currentTokens = currentCase.tokenCount ?? 0;
  if (currentTokens >= CASE_TOKEN_LIMIT) {
    throw new Error(tr("app.tokenLimit", { limit: CASE_TOKEN_LIMIT.toLocaleString() }));
  }

  // Topic relevance check (only for free text without symptoms/OBD)
  const freeText = inputData.text?.trim() ?? "";
  if (freeText && !inputData.symptoms?.length && !inputData.obdCodes?.length) {
    const topicCheck = checkTopicRelevance(freeText, lang);
    if (!topicCheck.ok) throw new Error(topicCheck.reason);
  }

  // Collect all inputs across conversation
  const inputMsg = {
    id: uid(),
    type: MSG.INPUT,
    ...inputData,
    timestamp: new Date().toISOString(),
  };
  const { allSymptoms, allObdCodes, allTexts } = collectCaseInputs(messages, inputMsg);
  const ragInput = buildRagInput(vehicle, allSymptoms, allObdCodes, allTexts);
  const userPrompt = buildDiagnosisUserPrompt({ vehicle, allSymptoms, allObdCodes, allTexts, tr });

  // RAG search + DTC lookup (parallel)
  const brandGroup = getBrandGroup(vehicle.brand);
  const [{ cases: similarCases = [], ok: searchOk }, dtcMap] = await Promise.all([
    searchSimilarCases(searchCases, ragInput),
    lookupDtcCodes(allObdCodes, brandGroup),
  ]);

  // AI call — enrich system prompt with DTC descriptions
  const dtcBlock = formatDtcBlock(dtcMap, lang);
  const data = await callAI({
    systemPrompt: buildSystemPrompt(similarCases, vehicle, lang) + dtcBlock,
    userMessage: userPrompt,
    maxTokens: AI_MAX_TOKENS,
  });

  if (data.error) throw new Error(data.error.message || tr("app.aiError"));
  if (!data.content) throw new Error(tr("app.aiNoResponse"));

  // Parse + normalize
  const raw = data.content.map((block) => block.text ?? "").join("");
  const parsed = smartRepair(raw);
  if (!parsed) throw new Error(tr("app.aiUnreadable"));
  if (!parsed.závady?.length) throw new Error(tr("app.noFaults"));

  const normalized = normalizeDiagnosisResult(parsed, tr, similarCases.length);
  const usedTokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

  const diagnosisMsg = {
    id: uid(),
    type: MSG.DIAGNOSIS,
    result: normalized,
    ragMatchIds: similarCases.map((item) => item.id),
    tokensUsed: usedTokens,
    timestamp: new Date().toISOString(),
  };

  const isFirstDiagnosis = messages.filter((m) => m.type === MSG.DIAGNOSIS).length === 0;
  const caseName = isFirstDiagnosis
    ? buildDiagnosedCaseName(vehicle, normalized.závady?.[0]?.název, tr("app.defaultVehicle"))
    : null;

  return { inputMsg, diagnosisMsg, caseName, usedTokens, cloudStatus: searchOk ? "ok" : "error" };
}
