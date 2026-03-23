/**
 * OBD-II Bluetooth Low Energy Reader
 *
 * Communicates with ELM327-compatible BLE adapters (KONNWEI, Vgate, OBDLink etc.)
 * via Web Bluetooth API. Reads stored (Mode 03) and pending (Mode 07) DTCs.
 *
 * Usage:
 *   import { readObdCodes, isWebBluetoothSupported } from "./obd-reader.js";
 *   const { codes, error } = await readObdCodes();
 *
 * Supported adapters: Any ELM327/STN11xx BLE adapter exposing a serial-like
 * GATT service (typically FFE0/FFE1 or FFF0/FFF1 or 18F0).
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
];

const KNOWN_CHARACTERISTICS = [
  0xFFE1,
  0xFFF1,
  "0000ffe1-0000-1000-8000-00805f9b34fb",
  "0000fff1-0000-1000-8000-00805f9b34fb",
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
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
    return { codes: [], error: "Web Bluetooth není v tomto prohlížeči podporován." };
  }

  let device = null;
  let server = null;

  try {
    // ── 1. Request device ────────────────────────────────────────────────
    device = await navigator.bluetooth.requestDevice({
      filters: [
        { namePrefix: "OBD" },
        { namePrefix: "KONNWEI" },
        { namePrefix: "KW" },
        { namePrefix: "Vgate" },
        { namePrefix: "iCar" },
        { namePrefix: "ELM" },
        { namePrefix: "V-LINK" },
        { namePrefix: "OBDLink" },
        { namePrefix: "OBDII" },
        { namePrefix: "Car" },
      ],
      optionalServices: KNOWN_SERVICES,
    });

    // ── 2. Connect GATT ──────────────────────────────────────────────────
    server = await device.gatt.connect();

    // ── 3. Find the serial TX/RX characteristic ─────────────────────────
    const { characteristic, notify } = await findSerialCharacteristic(server);

    // ── 4. Set up response listener ──────────────────────────────────────
    const send = buildSender(characteristic);
    const waitFor = buildResponseWaiter(notify ?? characteristic);

    // ── 5. Initialize ELM327 ─────────────────────────────────────────────
    await send("ATZ\r");      // Reset
    await delay(1500);        // Wait for reset
    await send("ATE0\r");     // Echo off
    await delay(300);
    await send("ATL0\r");     // Linefeeds off
    await delay(300);
    await send("ATS0\r");     // Spaces off (compact hex)
    await delay(300);
    await send("ATSP0\r");    // Auto-detect protocol
    await delay(500);

    // ── 6. Read stored DTCs (Mode 03) ───────────────────────────────────
    const storedRaw = await waitFor("03\r", 5000);
    const storedCodes = parseDtcResponse(storedRaw);

    // ── 7. Read pending DTCs (Mode 07) ──────────────────────────────────
    const pendingRaw = await waitFor("07\r", 5000);
    const pendingCodes = parseDtcResponse(pendingRaw);

    // ── 8. Combine & deduplicate ─────────────────────────────────────────
    const allCodes = [...new Set([...storedCodes, ...pendingCodes])];

    return { codes: allCodes, error: null };

  } catch (err) {
    // User cancelled the Bluetooth picker
    if (err.name === "NotFoundError") {
      return { codes: [], error: null };
    }
    return { codes: [], error: err.message || "Nepodařilo se připojit k OBD adaptéru." };
  } finally {
    // Always disconnect
    try { if (server?.connected) server.disconnect(); } catch (_) {}
  }
}

// ── BLE internals ───────────────────────────────────────────────────────────

/**
 * Try known service/characteristic UUID combos until one works.
 */
async function findSerialCharacteristic(server) {
  for (const svcUuid of KNOWN_SERVICES) {
    try {
      const service = await server.getPrimaryService(svcUuid);
      for (const charUuid of KNOWN_CHARACTERISTICS) {
        try {
          const char = await service.getCharacteristic(charUuid);
          const props = char.properties;

          // We need write. Notify is optional (some adapters use read polling).
          if (props.write || props.writeWithoutResponse) {
            let notify = null;
            if (props.notify) {
              await char.startNotifications();
              notify = char;
            }
            return { characteristic: char, notify };
          }
        } catch (_) { /* try next characteristic */ }
      }
    } catch (_) { /* try next service */ }
  }
  throw new Error("Nenalezena kompatibilní BLE služba. Zkontrolujte adaptér.");
}

/**
 * Build a write function for the characteristic.
 */
function buildSender(characteristic) {
  const encoder = new TextEncoder();
  return async (cmd) => {
    const data = encoder.encode(cmd);
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(data);
    } else {
      await characteristic.writeValueWithResponse(data);
    }
  };
}

/**
 * Build a function that sends a command and waits for a complete response.
 * ELM327 terminates responses with ">".
 */
function buildResponseWaiter(characteristic) {
  const decoder = new TextDecoder();
  let buffer = "";
  let resolver = null;

  // If characteristic supports notifications, listen for data chunks
  if (characteristic.properties?.notify) {
    characteristic.addEventListener("characteristicvaluechanged", (event) => {
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
    const encoder = new TextEncoder();
    const data = encoder.encode(cmd);

    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(data);
    } else {
      await characteristic.writeValueWithResponse(data);
    }

    // If notifications are active, wait for ">" prompt
    if (characteristic.properties?.notify) {
      return new Promise((resolve, reject) => {
        resolver = resolve;
        setTimeout(() => {
          if (resolver) {
            resolver = null;
            resolve(buffer); // Return whatever we got
          }
        }, timeoutMs);
      });
    }

    // Fallback: poll by reading characteristic value
    return pollResponse(characteristic, decoder, timeoutMs);
  };
}

/**
 * Fallback polling for adapters without notify support.
 */
async function pollResponse(characteristic, decoder, timeoutMs) {
  const start = Date.now();
  let result = "";

  while (Date.now() - start < timeoutMs) {
    await delay(200);
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

  // Strip whitespace and non-hex, but keep the response prefix (43/47)
  const clean = raw
    .replace(/\r|\n|>/g, "")
    .replace(/\s/g, "")
    .toUpperCase();

  // Find mode response markers: 43 = stored DTCs, 47 = pending DTCs
  const codes = [];
  const markers = ["43", "47"];

  for (const marker of markers) {
    let idx = clean.indexOf(marker);
    while (idx !== -1) {
      // Skip the 2-char marker
      let pos = idx + 2;

      // Parse DTC pairs (each DTC = 4 hex chars)
      while (pos + 4 <= clean.length) {
        const dtcHex = clean.slice(pos, pos + 4);

        // Validate it's hex
        if (!/^[0-9A-F]{4}$/.test(dtcHex)) break;

        // 0000 = no more codes
        if (dtcHex === "0000") {
          pos += 4;
          continue;
        }

        const dtc = decodeDtc(dtcHex);
        if (dtc) codes.push(dtc);
        pos += 4;
      }

      // Find next occurrence of marker
      idx = clean.indexOf(marker, pos);
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
