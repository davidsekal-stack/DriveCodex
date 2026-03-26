import { useState } from "react";
import { isWebBluetoothSupported, readObdCodes } from "../lib/obd-reader.js";

/**
 * Hook pro čtení OBD kódů přes Web Bluetooth (BLE).
 * Vrací stav připojení, nalezené kódy a handler pro spuštění.
 */
export default function useBleReader(onCodesRead) {
  const [status, setStatus] = useState("idle"); // idle | connecting | error
  const [error, setError]   = useState(null);
  const supported = isWebBluetoothSupported();

  const read = async () => {
    setStatus("connecting");
    setError(null);
    const result = await readObdCodes();
    if (result.error) {
      setStatus("error");
      setError(result.error);
    } else {
      if (result.codes.length > 0) onCodesRead(result.codes);
      setStatus("idle");
    }
  };

  return { supported, status, error, read };
}
