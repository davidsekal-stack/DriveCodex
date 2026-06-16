/**
 * Orchestrace diagnostiky — jeden run od vstupu po AI odpověď.
 * Čistá async funkce bez React hooků, testovatelná izolovaně.
 *
 * Vrací { inputMsg, diagnosisMsg|replyMsg, caseName, usedTokens, cloudStatus }
 * nebo throws Error. U follow-upu může místo diagnosisMsg vrátit replyMsg
 * (konverzační odpověď "mechanika" na doplňující dotaz).
 */

import { MSG } from "../constants/enums.js";
import { uid } from "./utils.js";
import { smartRepair, buildSystemPrompt, buildFollowupSystemPrompt, checkTopicRelevance } from "./ai.js";
import { CASE_TOKEN_LIMIT, AI_MAX_TOKENS, REPLY_MAX_LENGTH } from "../constants/limits.js";
import {
  buildDiagnosedCaseName,
  buildDiagnosisUserPrompt,
  buildPriorDiagnosisContext,
  buildRagInput,
  collectCaseInputs,
  getLatestDiagnosis,
  isReplyResult,
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

  // Follow-up? Pokud už existuje předchozí diagnóza, navazujeme na ni (hybrid:
  // doplňující dotaz → konverzační odpověď, nové zjištění → aktualizovaná diagnóza).
  const priorDiagnosis = getLatestDiagnosis(messages);
  const isFollowup = !!priorDiagnosis;

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

  // AI call — enrich system prompt with DTC descriptions; follow-up varianta
  // navíc dostane shrnutí předchozí diagnózy a pravidla režimu odpověď/diagnóza.
  const dtcBlock = formatDtcBlock(dtcMap, lang);
  const systemPrompt = isFollowup
    ? buildFollowupSystemPrompt(similarCases, vehicle, lang, buildPriorDiagnosisContext(priorDiagnosis, tr)) + dtcBlock
    : buildSystemPrompt(similarCases, vehicle, lang) + dtcBlock;
  const data = await callAI({
    systemPrompt,
    userMessage: userPrompt,
    maxTokens: AI_MAX_TOKENS,
  });

  if (data.error) throw new Error(data.error.message || tr("app.aiError"));
  if (!data.content) throw new Error(tr("app.aiNoResponse"));

  // Parse
  const raw = data.content.map((block) => block.text ?? "").join("");
  const parsed = smartRepair(raw);
  if (!parsed) throw new Error(tr("app.aiUnreadable"));

  const usedTokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

  // Konverzační odpověď (jen u follow-upu) — vrať textovou zprávu, ne karty.
  if (isFollowup && isReplyResult(parsed)) {
    const replyText = (parsed.odpověď ?? "").trim().slice(0, REPLY_MAX_LENGTH);
    if (!replyText) throw new Error(tr("app.aiUnreadable"));
    const replyMsg = {
      id: uid(),
      type: MSG.REPLY,
      text: replyText,
      tokensUsed: usedTokens,
      timestamp: new Date().toISOString(),
    };
    // Otázka mechanika (inputMsg) se zobrazí v timeline, ale označíme ji fromReply,
    // aby se NEvmísila do pozdějších diagnóz (collectCaseInputs) ani do RAG
    // korpusu při uzavření případu (buildPushClosedCasePayload).
    return { inputMsg: { ...inputMsg, fromReply: true }, replyMsg, caseName: null, usedTokens, cloudStatus: searchOk ? "ok" : "error" };
  }

  // Diagnóza (první i aktualizovaná)
  if (!parsed.závady?.length) throw new Error(tr("app.noFaults"));

  const normalized = normalizeDiagnosisResult(parsed, tr, similarCases.length);

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
