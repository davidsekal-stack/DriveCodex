import { CASE_STATUS } from "../constants/enums.js";

export function getDeleteCaseMessage(cases, deleteId, tr) {
  return cases.find((kase) => kase.id === deleteId)?.status === CASE_STATUS.CLOSED
    ? tr("app.deleteClosedMsg")
    : tr("app.deleteOpenMsg");
}
