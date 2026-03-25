import { err } from "./result.js";

export function getStorageErrorMessage(error, fallbackMessage = "Unknown storage error") {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return fallbackMessage;
}

export function makeStorageSuccessResult(data = {}) {
  return {
    ok: true,
    error: null,
    ...data,
  };
}

export function makeStorageErrorResult(error, fallbackMessage = "Unknown storage error", data = {}) {
  const normalized = err(getStorageErrorMessage(error, fallbackMessage));
  return {
    ...normalized,
    ...data,
  };
}

export function normalizeSearchCasesResult(result) {
  const cases = Array.isArray(result?.cases) ? result.cases : [];

  return makeStorageSuccessResult({
    ...result,
    cases,
    count: Number.isFinite(result?.count) ? result.count : cases.length,
  });
}
