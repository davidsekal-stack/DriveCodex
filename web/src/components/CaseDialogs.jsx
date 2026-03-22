import ConfirmModal from "./ConfirmModal.jsx";
import CloseCaseModal from "./CloseCaseModal.jsx";
import { getDeleteCaseMessage } from "../lib/case-dialogs.js";

export default function CaseDialogs({
  cases,
  closeError,
  closeModal,
  deleteId,
  faults,
  mobile,
  onCancelCloseCase,
  onCancelDeleteCase,
  onChangeResolution,
  onConfirmCloseCase,
  onConfirmDeleteCase,
  resolution,
  t,
  tr,
}) {
  return (
    <>
      {closeModal && (
        <CloseCaseModal
          closeError={closeError}
          faults={faults}
          mobile={mobile}
          onCancel={onCancelCloseCase}
          onChangeResolution={onChangeResolution}
          onConfirm={onConfirmCloseCase}
          resolution={resolution}
          t={t}
          tr={tr}
        />
      )}

      {deleteId && (
        <ConfirmModal
          t={t}
          title={tr("app.deleteCaseTitle")}
          message={getDeleteCaseMessage(cases, deleteId, tr)}
          confirmLabel={tr("app.deleteBtn")}
          danger
          onConfirm={onConfirmDeleteCase}
          onCancel={onCancelDeleteCase}
        />
      )}
    </>
  );
}
