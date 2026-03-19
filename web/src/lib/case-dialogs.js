export function getDeleteCaseMessage(cases, deleteId, tr) {
  return cases.find((kase) => kase.id === deleteId)?.status === "uzavřený"
    ? tr("app.deleteClosedMsg")
    : tr("app.deleteOpenMsg");
}
