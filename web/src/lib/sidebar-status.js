export function getGlobalCaseCountLabel(globalCaseCount, tr) {
  if (globalCaseCount > 0) {
    return tr("app.cloudCount", { count: globalCaseCount });
  }

  if (globalCaseCount === 0) {
    return tr("app.cloudEmpty");
  }

  return tr("app.ragConnecting");
}

export function getCloudStatusMeta(cloudStatus, tr) {
  if (cloudStatus === "ok") {
    return {
      icon: "●",
      label: tr("app.ragActive"),
      tone: "success",
    };
  }

  if (cloudStatus === "error") {
    return {
      icon: "✕",
      label: tr("app.ragUnavailable"),
      tone: "danger",
    };
  }

  return {
    icon: "○",
    label: tr("app.ragConnecting"),
    tone: "muted",
  };
}

export function getSyncStatusMeta(syncStatus, tr) {
  if (syncStatus === "syncing") {
    return {
      icon: "↻",
      label: tr("app.syncSyncing"),
      tone: "muted",
      showWarning: false,
    };
  }

  if (syncStatus === "synced") {
    return {
      icon: "✓",
      label: tr("app.syncSynced"),
      tone: "success",
      showWarning: false,
    };
  }

  if (syncStatus === "error") {
    return {
      icon: "⚠",
      label: tr("app.syncError"),
      tone: "danger",
      showWarning: true,
    };
  }

  return {
    icon: "○",
    label: tr("app.syncIdle"),
    tone: "muted",
    showWarning: false,
  };
}
