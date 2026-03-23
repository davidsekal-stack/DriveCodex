export async function loadCasesCloudStatus(loadCases) {
  try {
    await loadCases();
    return "ok";
  } catch {
    return "error";
  }
}

export async function loadGlobalCaseCount(getGlobalCaseCount) {
  try {
    return {
      globalCaseCount: await getGlobalCaseCount(),
      hasGlobalCaseCount: true,
    };
  } catch {
    return {
      globalCaseCount: null,
      hasGlobalCaseCount: false,
    };
  }
}
