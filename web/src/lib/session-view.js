import { MSG } from "../constants/enums.js";

export function getTokenUsageMeta(tokenCount, tokenLimit) {
  const usagePercent = Math.min(100, Math.round((tokenCount ?? 0) / tokenLimit * 100));

  return {
    label: usagePercent >= 5 ? `▓ ${usagePercent}%` : "▓ <1%",
    tone: usagePercent >= 90 ? "danger" : usagePercent >= 70 ? "warning" : "muted",
    usagePercent,
  };
}

export function getInputRoundNumber(messages, index) {
  return messages.slice(0, index + 1).filter((message) => message.type === MSG.INPUT).length;
}

export function hasDiagnoses(messages) {
  return messages.some((message) => message.type === MSG.DIAGNOSIS);
}
