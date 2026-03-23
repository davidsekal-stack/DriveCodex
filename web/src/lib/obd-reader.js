/**
 * OBD-II Bluetooth Low Energy Reader
 *
 * Communicates with ELM327-compatible BLE adapters (KONNWEI, Vgate, OBDLink etc.)
 * via Web Bluetooth API. Reads stored (Mode 03) and pending (Mode 07) DTCs.
 *
 * IMPORTANT: Only works with BLE (Bluetooth Low Energy / Bluetooth 4.0+) adapters.
 * Classic Bluetooth (SPP) adapters are NOT supported by the Web Bluetooth API.
 *
 * Usage:
 *   import { readObdCodes, isWebBluetoothSupported } from "./obd-reader.js";
 *   const { codes, error } = await readObdCodes();
 */

// ── Known BLE Service/Characteristic UUIDs for ELM327 adapters ──────────────

const KNOWN_SERVICES = [
  // Most common ELM327 BLE adapters (KONNWEI, Vgate iCar, cheap clones)
  0xFFE0,
  0xFFF0,
  // Some adapters use full 128-bit UUIDs
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
  // OBDLink, some higher-end adapters
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  // Additional services found on various adapters
  0x18F0,
  "0000ab00-0000-1000-8000-00805f9b34fb",
];

const KNOWN_CHARACTERISTICS = [
  0xFFE1,
  0xFFF1,
  "0000ffe1-0000-1000-8000-00805f9b34fb",
  "0000fff1-0000-1000-8000-00805f9b34fb",
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
  "0000ab01-0000-1000-8000-00805f9b34fb",
  "0000ab02-0000-1000-8000-00805f9b34fb",
];

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if Web Bluetooth is available in this browser.
 */
export function isWebBluetoothSupported() {
  return !!(navigator?.bluetooth?.requestDevice);
}

/**
 * Connect to an OBD-II BLE adapter, read stored + pending DTCs, disconnect.
 *
 * @returns {{ codes: string[], error: string|null }}
 *   codes = array of DTC strings like ["P0401", "C1234"]
 *   error = human-readable error message, or null on success
 */
export async function readObdCodes() {
  if (!isWebBluetoothSupported()) {
    return { codes: [], error: "Web Bluetooth is not supported in this browser." };
  }

  let device = null;
  let server = null;

  try {
    // ── 1. Request device ────────────────────────────────────────────────
    // Use acceptAllDevices because cheap ELM327 clones advertise under
    // unpredictable names ("MINI", "BT_OBD", "HC-05", "Android-Vlink", …).
    // The user picks the right device from the browser's Bluetooth picker.
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_SERVICES,
    });

    // ── 2. Connect GATT ──────────────────────────────────────────────────
    server = await device.gatt.connect();

    // ── 3. Find the serial TX/RX characteristic(s) ───────────────────────
    const { tx, rx } = await findSerialCharacteristics(server);

    // ── 4. Set up communication ──────────────────────────────────────────
    const waitFor = buildCommandRunner(tx, rx);

    // ── 5. Initialize ELM327 — wait for ">" after each command ──────────
    await waitFor("ATZ\r", 3000);     // Reset — some adapters are slow
    await waitFor("ATE0\r", 2000);    // Echo off
    await waitFor("ATL0\r", 1000);    // Linefeeds off
    await waitFor("ATS0\r", 1000);    // Spaces off (compact hex)
    await waitFor("ATSP0\r", 2000);   // Auto-detect protocol

    // ── 6. Read stored DTCs (Mode 03) ───────────────────────────────────
    const storedRaw = await waitFor("03\r", 8000);
    const storedCodes = parseDtcResponse(storedRaw);

    // ── 7. Read pending DTCs (Mode 07) ──────────────────────────────────
    const pendingRaw = await waitFor("07\r", 8000);
    const pendingCodes = parseDtcResponse(pendingRaw);

    // ── 8. Combine & deduplicate ─────────────────────────────────────────
    const allCodes = [...new Set([...storedCodes, ...pendingCodes])];

    return { codes: allCodes, error: null };

  } catch (err) {
    // User cancelled the Bluetooth picker
    if (err.name === "NotFoundError") {
      return { codes: [], error: null };
    }
    // GATT connect failed — likely a Classic BT adapter, not BLE
    if (err.message?.includes("GATT") || err.message?.includes("connect")) {
      return {
        codes: [],
        error: "Cannot connect — your adapter may use Classic Bluetooth (not BLE). Web Bluetooth requires a BLE (Bluetooth 4.0+) adapter.",
      };
    }
    return { codes: [], error: err.message || "Failed to connect to OBD adapter." };
  } finally {
    // Always disconnect
    try { if (server?.connected) server.disconnect(); } catch (_) {}
  }
}

// ── BLE internals ───────────────────────────────────────────────────────────

/**
 * Find TX (write) and RX (notify/read) characteristics.
 * Many adapters use a single characteristic for both; some have separate ones.
 */
async function findSerialCharacteristics(server) {
  for (const svcUuid of KNOWN_SERVICES) {
    let service;
    try {
      service = await server.getPrimaryService(svcUuid);
    } catch (_) {
      continue; // Service not available
    }

    let txChar = null;
    let rxChar = null;

    // Enumerate all known characteristics on this service
    for (const charUuid of KNOWN_CHARACTERISTICS) {
      let char;
      try {
        char = await service.getCharacteristic(charUuid);
      } catch (_) {
        continue;
      }

      const props = char.properties;

      // Found a writable characteristic → candidate for TX
      if (!txChar && (props.write || props.writeWithoutResponse)) {
        txChar = char;
      }

      // Found a notifiable characteristic → candidate for RX
      if (!rxChar && props.notify) {
        rxChar = char;
      }

      // Single characteristic does both → use it for TX and RX
      if ((props.write || props.writeWithoutResponse) && props.notify) {
        txChar = char;
        rxChar = char;
        break;
      }
    }

    if (txChar) {
      // Start notifications on RX if we have one
      if (rxChar) {
        try {
          await rxChar.startNotifications();
        } catch (_) {
          rxChar = null; // Fall back to polling
        }
      }
      return { tx: txChar, rx: rxChar ?? txChar };
    }
  }

  throw new Error("No compatible BLE service found. Make sure your adapter supports BLE (not Classic Bluetooth).");
}

/**
 * Build a function that sends a command via TX and reads the response via RX.
 * ELM327 terminates responses with ">".
 */
function buildCommandRunner(tx, rx) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let resolver = null;

  // If RX supports notifications, listen for data chunks
  if (rx.properties?.notify) {
    rx.addEventListener("characteristicvaluechanged", (event) => {
      buffer += decoder.decode(event.target.value);
      if (buffer.includes(">") && resolver) {
        const response = buffer;
        buffer = "";
        resolver(response);
        resolver = null;
      }
    });
  }

  return async (cmd, timeoutMs = 5000) => {
    buffer = "";

    // Send command via TX characteristic
    const data = encoder.encode(cmd);
    if (tx.properties.writeWithoutResponse) {
      await tx.writeValueWithoutResponse(data);
    } else {
      await tx.writeValueWithResponse(data);
    }

    // Wait for response via RX
    if (rx.properties?.notify) {
      return new Promise((resolve) => {
        resolver = resolve;
        setTimeout(() => {
          if (resolver) {
            resolver = null;
            resolve(buffer); // Return whatever we got so far
          }
        }, timeoutMs);
      });
    }

    // Fallback: poll by reading characteristic value
    return pollResponse(rx, decoder, timeoutMs);
  };
}

/**
 * Fallback polling for adapters without notify support.
 */
async function pollResponse(characteristic, decoder, timeoutMs) {
  const start = Date.now();
  let result = "";

  while (Date.now() - start < timeoutMs) {
    await delay(250);
    try {
      const value = await characteristic.readValue();
      const chunk = decoder.decode(value);
      result += chunk;
      if (result.includes(">")) break;
    } catch (_) { break; }
  }

  return result;
}

// ── DTC Parsing ─────────────────────────────────────────────────────────────

/**
 * Parse ELM327 Mode 03/07 response into an array of DTC strings.
 *
 * Response format (spaces may or may not be present):
 *   "43 01 03 01 04 00 00\r\n>"   → 2 DTCs
 *   Each DTC = 2 bytes (4 hex chars)
 *
 *   Byte 1 high nibble → type + first digit:
 *     00=P0, 01=P1, 02=P2, 03=P3
 *     04=C0, 05=C1, 06=C2, 07=C3
 *     08=B0, 09=B1, 0A=B2, 0B=B3
 *     0C=U0, 0D=U1, 0E=U2, 0F=U3
 *   Remaining 3 nibbles → digits 2-4
 *
 * @param {string} raw - raw ELM327 response
 * @returns {string[]} - e.g. ["P0103", "P0104"]
 */
export function parseDtcResponse(raw) {
  if (!raw) return [];

  // Strip whitespace, control chars and ELM prompt
  const clean = raw
    .replace(/\r|\n|>/g, "")
    .replace(/\s/g, "")
    .toUpperCase();

  // Remove known ELM327 noise: "NODATA", "SEARCHING...", "UNABLE TO CONNECT", "ERROR"
  if (/NODATA|UNABLETOCONNECT|ERROR|STOPPED|\?/.test(clean)) {
    return [];
  }

  // Find mode response markers: 43 = stored DTCs, 47 = pending DTCs
  const codes = [];
  const markers = ["43", "47"];

  for (const marker of markers) {
    let idx = 0;
    while (true) {
      idx = clean.indexOf(marker, idx);
      if (idx === -1) break;

      // Validate marker position — should be at start or after non-hex boundary
      // to avoid false matches inside DTC data
      if (idx > 0 && /[0-9A-F]/.test(clean[idx - 1])) {
        idx += 2;
        continue;
      }

      // Skip the 2-char marker
      let pos = idx + 2;

      // Parse DTC pairs (each DTC = 4 hex chars)
      while (pos + 4 <= clean.length) {
        const dtcHex = clean.slice(pos, pos + 4);

        // Validate it's hex
        if (!/^[0-9A-F]{4}$/.test(dtcHex)) break;

        // 0000 = padding / no more codes
        if (dtcHex === "0000") {
          pos += 4;
          continue;
        }

        const dtc = decodeDtc(dtcHex);
        if (dtc) codes.push(dtc);
        pos += 4;
      }

      idx = pos;
    }
  }

  return [...new Set(codes)];
}

/**
 * Decode 4 hex chars into a DTC string like "P0401".
 */
function decodeDtc(hex) {
  const firstNibble = parseInt(hex[0], 16);
  const typeMap = ["P", "P", "P", "P", "C", "C", "C", "C", "B", "B", "B", "B", "U", "U", "U", "U"];
  const digitMap = ["0", "1", "2", "3", "0", "1", "2", "3", "0", "1", "2", "3", "0", "1", "2", "3"];

  if (firstNibble > 15) return null;

  const type = typeMap[firstNibble];
  const firstDigit = digitMap[firstNibble];
  const rest = hex.slice(1); // 3 hex chars = digits 2,3,4

  return `${type}${firstDigit}${rest}`;
}

// ── Util ────────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
