import { useState, useCallback, useRef, useEffect } from "react";
import { CASE_STATUS } from "../constants/enums.js";
import { DEBOUNCE_SAVE_MS, SYNC_IDLE_RESET_MS } from "../constants/timing.js";
import { isOk } from "../lib/result.js";
import { uid } from "../lib/utils.js";
import * as storage from "../lib/storage.js";

/**
 * useCases hook — web verze (Supabase-backed)
 *
 * Všechny případy se ukládají do Supabase tabulky gearbrain_web_sessions.
 * Async persistence přes Supabase.
 */
export default function useCases() {
  const [cases, setCases]     = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error
  const [syncError, setSyncError] = useState(null);
  const casesRef = useRef(cases);
  useEffect(() => { casesRef.current = cases; }, [cases]);

  const activeCase = cases.find((c) => c.id === activeId) ?? null;

  // ── debounced save — ukládá případ do Supabase s 500ms debounce ────────────
  const saveTimers = useRef({});
  const syncResetTimer = useRef(null);
  const inFlightSyncs = useRef(0);
  const hasStickySyncError = useRef(false);

  const clearSyncResetTimer = useCallback(() => {
    if (syncResetTimer.current) {
      clearTimeout(syncResetTimer.current);
      syncResetTimer.current = null;
    }
  }, []);

  const markSyncStarted = useCallback(() => {
    inFlightSyncs.current += 1;
    if (!hasStickySyncError.current) {
      clearSyncResetTimer();
      setSyncStatus("syncing");
      setSyncError(null);
    }
  }, [clearSyncResetTimer]);

  const scheduleIdleReset = useCallback(() => {
    clearSyncResetTimer();
    syncResetTimer.current = setTimeout(() => {
      setSyncStatus("idle");
    }, SYNC_IDLE_RESET_MS);
  }, [clearSyncResetTimer]);

  const markSyncSuccess = useCallback((options = {}) => {
    inFlightSyncs.current = Math.max(0, inFlightSyncs.current - 1);
    if (inFlightSyncs.current === 0) {
      if (options.resetError) {
        hasStickySyncError.current = false;
        setSyncError(null);
      }
      if (hasStickySyncError.current) {
        return;
      }
      setSyncStatus("synced");
      setSyncError(null);
      scheduleIdleReset();
    }
  }, [scheduleIdleReset]);

  const markSyncError = useCallback((error) => {
    inFlightSyncs.current = Math.max(0, inFlightSyncs.current - 1);
    hasStickySyncError.current = true;
    clearSyncResetTimer();
    setSyncStatus("error");
    setSyncError(error?.message || "Unknown sync error");
  }, [clearSyncResetTimer]);

  useEffect(() => () => {
    Object.values(saveTimers.current).forEach((timer) => clearTimeout(timer));
    clearSyncResetTimer();
  }, [clearSyncResetTimer]);

  const debouncedSave = useCallback((caseData) => {
    const id = caseData.id;
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => {
      const status = caseData.status === CASE_STATUS.CLOSED ? "closed" : "open";
      markSyncStarted();
      storage.updateCase(id, caseData, status)
        .then((result) => {
          if (isOk(result)) { markSyncSuccess(); }
          else { console.warn('[save]', result.error); markSyncError({ message: result.error }); }
        });
    }, DEBOUNCE_SAVE_MS);
  }, [markSyncError, markSyncStarted, markSyncSuccess]);

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  const updateCase = useCallback((id, fn) => {
    setCases((prev) => {
      const next = prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, ...fn(c) };
        debouncedSave(updated);
        return updated;
      });
      return next;
    });
  }, [debouncedSave]);

  const updateCases = useCallback((updater) => {
    setCases((prev) => typeof updater === "function" ? updater(prev) : updater);
  }, []);

  const createCase = useCallback((vehicle) => {
    const id = uid();
    const name = vehicle.model
      ? vehicle.model.split(" ").slice(0, 3).join(" ")
        + (vehicle.enginePower ? ` · ${vehicle.enginePower.split(" ")[0]} kW` : "")
        + (vehicle.mileage ? ` · ${Number(vehicle.mileage).toLocaleString("cs-CZ")} km` : "")
      : "Nový případ";

    const newCase = {
      id, name, status: CASE_STATUS.OPEN,
      createdAt: new Date().toISOString(), closedAt: null,
      vehicle, messages: [], resolution: null, tokenCount: 0,
    };

    setCases((prev) => [newCase, ...prev]);
    setActiveId(id);

    // Async save to Supabase
    markSyncStarted();
    storage.createCase(newCase)
      .then((result) => {
        if (isOk(result)) { markSyncSuccess(); }
        else { console.warn('[create]', result.error); markSyncError({ message: result.error }); }
      });

    return id;
  }, [markSyncError, markSyncStarted, markSyncSuccess]);

  const deleteCase = useCallback((id) => {
    setCases((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
    markSyncStarted();
    storage.deleteCase(id)
      .then((result) => {
        if (isOk(result)) { markSyncSuccess(); }
        else { console.warn('[delete]', result.error); markSyncError({ message: result.error }); }
      });
  }, [activeId, markSyncError, markSyncStarted, markSyncSuccess]);

  // ── Load from Supabase ────────────────────────────────────────────────────────

  const loadCases = useCallback(async () => {
    markSyncStarted();
    const result = await storage.loadCases();
    if (isOk(result)) {
      setCases(result.data);
      markSyncSuccess({ resetError: true });
      return result;
    }
    console.warn('[loadCases]', result.error);
    markSyncError({ message: result.error });
    return result;
  }, [markSyncError, markSyncStarted, markSyncSuccess]);

  return {
    cases, setCases, activeCase, activeId, setActiveId,
    casesRef, createCase, deleteCase, loadCases, syncError, syncStatus, updateCase, updateCases,
  };
}
