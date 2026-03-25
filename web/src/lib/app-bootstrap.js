import { isOk } from "./result.js";

export async function loadCasesCloudStatus(loadCases) {
  const result = await loadCases();
  return isOk(result) ? "ok" : "error";
}

export async function loadGlobalCaseCount(getGlobalCaseCount) {
  const result = await getGlobalCaseCount();
  return isOk(result)
    ? { globalCaseCount: result.data, hasGlobalCaseCount: true }
    : { globalCaseCount: null, hasGlobalCaseCount: false };
}
