import { useEffect, useRef } from "react";

import SessionComposer from "./SessionComposer.jsx";
import SessionHeader from "./SessionHeader.jsx";
import SessionTimeline from "./SessionTimeline.jsx";

export default function SessionView({
  activeCase,
  activeId,
  cases,
  diagCount,
  error,
  guideActions,
  lang,
  loading,
  mobile,
  onRequestCloseCase,
  onRequestDelete,
  onOpenManual,
  onRunDiag,
  onStartRepair,
  tr,
}) {
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeCase?.messages?.length, loading]);

  if (!activeCase) return null;

  const runActiveDiag = (inputData) => {
    if (!activeId) return;
    void onRunDiag(activeId, inputData);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <SessionHeader
        activeCase={activeCase}
        lang={lang}
        mobile={mobile}
        onRequestCloseCase={onRequestCloseCase}
        onRequestDelete={onRequestDelete}
        tr={tr}
      />

      <SessionTimeline
        activeCase={activeCase}
        cases={cases}
        chatEndRef={chatEndRef}
        error={error}
        guideActions={guideActions}
        lang={lang}
        loading={loading}
        mobile={mobile}
        onOpenManual={onOpenManual}
        onRequestCloseCase={onRequestCloseCase}
        onStartRepair={onStartRepair}
        tr={tr}
      />

      <SessionComposer
        activeCase={activeCase}
        diagCount={diagCount}
        loading={loading}
        mobile={mobile}
        onRunDiag={runActiveDiag}
        tr={tr}
      />
    </div>
  );
}
