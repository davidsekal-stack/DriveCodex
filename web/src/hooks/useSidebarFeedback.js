import { useCallback, useEffect, useRef, useState } from "react";
import { FEEDBACK_RESET_MS } from "../constants/timing.js";
import * as storage from "../lib/storage.js";

export default function useSidebarFeedback({ lang }) {
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("idle");
  const resetTimerRef = useRef(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const scheduleStatusReset = useCallback(() => {
    clearResetTimer();
    resetTimerRef.current = setTimeout(() => setFeedbackStatus("idle"), FEEDBACK_RESET_MS);
  }, [clearResetTimer]);

  useEffect(() => () => {
    clearResetTimer();
  }, [clearResetTimer]);

  const submitFeedback = useCallback(async () => {
    const trimmed = feedbackText.trim();
    if (!trimmed || feedbackStatus === "sending") return;

    setFeedbackStatus("sending");
    try {
      const result = await storage.sendFeedback(trimmed, lang);
      if (!result.ok) {
        setFeedbackStatus("error");
        scheduleStatusReset();
        return;
      }

      setFeedbackText("");
      setFeedbackStatus("sent");
      scheduleStatusReset();
    } catch {
      setFeedbackStatus("error");
      scheduleStatusReset();
    }
  }, [feedbackStatus, feedbackText, lang, scheduleStatusReset]);

  return {
    feedbackStatus,
    feedbackText,
    setFeedbackText,
    submitFeedback,
  };
}
