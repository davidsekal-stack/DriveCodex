/** Timing constants — centralized to avoid magic numbers in hooks */

/** Debounce interval for auto-saving case data to Supabase (ms) */
export const DEBOUNCE_SAVE_MS = 500;

/** Delay before sync status resets from "synced" back to "idle" (ms) */
export const SYNC_IDLE_RESET_MS = 2500;

/** Delay before feedback status resets from "sent"/"error" back to "idle" (ms) */
export const FEEDBACK_RESET_MS = 3000;
