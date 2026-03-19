import { useState, useCallback } from "react";

import {
  getStoredDefaultBrand,
  makeEmptyVehicle,
  saveIdent,
} from "../constants/index.js";
import { buildCaseIdentLabel } from "../lib/case-draft.js";

export default function useCaseDraft({
  handleCreateCase,
  runDiag,
  tr,
}) {
  const [newVehicle, setNewVehicle] = useState(makeEmptyVehicle);
  const [defaultBrand, setDefaultBrandState] = useState(getStoredDefaultBrand);
  const [identHistory, setIdentHistory] = useState([]);

  const submitNewCase = useCallback((inputData) => {
    const vehicleToSave = newVehicle;
    const id = handleCreateCase(vehicleToSave);
    void runDiag(id, inputData);

    if (vehicleToSave.identValue?.trim()) {
      saveIdent(
        vehicleToSave.identValue,
        id,
        buildCaseIdentLabel(vehicleToSave, tr("app.defaultVehicle")),
      );
    }

    setNewVehicle(makeEmptyVehicle());
    setIdentHistory([]);
  }, [handleCreateCase, newVehicle, runDiag, tr]);

  return {
    defaultBrand,
    identHistory,
    newVehicle,
    setDefaultBrandState,
    setIdentHistory,
    setNewVehicle,
    submitNewCase,
  };
}
