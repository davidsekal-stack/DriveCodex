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
          tr={tr}
        />
      )}

      {deleteId && (
        <ConfirmModal
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
