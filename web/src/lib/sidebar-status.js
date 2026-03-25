/** Sidebar status helpers — pure functions for testable status mapping */

export function getGlobalCaseCountLabel(count, tr) {
  if (count === null || count === undefined) return tr("app.ragConnecting");
  if (count === 0) return tr("app.cloudEmpty");
  return tr("app.cloudCount", { count });
}

export function getCloudStatusMeta(status, tr) {
  switch (status) {
    case "ok":
      return { icon: "●", label: tr("app.ragActive"), tone: "success" };
    case "error":
      return { icon: "✕", label: tr("app.ragUnavailable"), tone: "danger" };
    default:
      return { icon: "○", label: tr("app.ragConnecting"), tone: "muted" };
  }
}

export function getSyncStatusMeta(status, tr) {
  switch (status) {
    case "syncing":
      return { icon: "↻", label: tr("app.syncSyncing"), tone: "muted", showWarning: false };
    case "synced":
      return { icon: "✓", label: tr("app.syncSynced"), tone: "success", showWarning: false };
    case "error":
      return { icon: "⚠", label: tr("app.syncError"), tone: "danger", showWarning: true };
    default:
      return { icon: "○", label: tr("app.syncIdle"), tone: "muted", showWarning: false };
  }
}
