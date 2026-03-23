import { useEffect } from "react";

export default function ModalShell({ onClose, children, width = 480 }) {
  useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div onClick={(event) => event.stopPropagation()} style={{ width, maxWidth: "92vw" }}>
        {children}
      </div>
    </div>
  );
}
