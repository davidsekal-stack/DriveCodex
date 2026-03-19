import { useState, useCallback } from "react";

export default function useCaseDialogs({
  clearCloseError,
  closeCase,
  deleteCaseAction,
}) {
  const [closeModal, setCloseModal] = useState(false);
  const [resolution, setResolution] = useState("");
  const [deleteId, setDeleteId] = useState(null);

  const openCloseModal = useCallback(() => {
    setCloseModal(true);
  }, []);

  const cancelCloseModal = useCallback(() => {
    setCloseModal(false);
    clearCloseError();
  }, [clearCloseError]);

  const changeResolution = useCallback((value) => {
    setResolution(value);
    clearCloseError();
  }, [clearCloseError]);

  const confirmCloseCase = useCallback(async () => {
    const result = await closeCase(resolution);
    if (!result.ok) return false;

    setCloseModal(false);
    clearCloseError();
    setResolution("");
    return true;
  }, [clearCloseError, closeCase, resolution]);

  const requestDeleteCase = useCallback((id) => {
    setDeleteId(id);
  }, []);

  const cancelDeleteCase = useCallback(() => {
    setDeleteId(null);
  }, []);

  const confirmDeleteCase = useCallback(() => {
    if (!deleteId) return;

    deleteCaseAction(deleteId);
    setDeleteId(null);
  }, [deleteCaseAction, deleteId]);

  return {
    cancelCloseModal,
    cancelDeleteCase,
    changeResolution,
    closeModal,
    confirmCloseCase,
    confirmDeleteCase,
    deleteId,
    openCloseModal,
    requestDeleteCase,
    resolution,
  };
}
