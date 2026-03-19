import { useEffect } from "react";

export default function useGlobalShortcuts({ onStartNewCase }) {
  useEffect(() => {
    const handler = (event) => {
      if (event.ctrlKey && event.key === "n") {
        event.preventDefault();
        onStartNewCase();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onStartNewCase]);
}
