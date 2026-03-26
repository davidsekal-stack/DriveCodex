import { MSG, CASE_STATUS } from "../constants/enums.js";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { fmtDate } from "../lib/utils.js";
import { getInputRoundNumber } from "../lib/session-view.js";
import { SymptomChip, ObdChip } from "./Chip.jsx";
import DiagCard from "./DiagCard.jsx";

export default function SessionTimeline({
  activeCase,
  cases,
  chatEndRef,
  error,
  lang,
  loading,
  mobile,
  tr,
}) {
  const { t } = useTheme();
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: mobile ? "10px" : "20px", background: t.bg }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: mobile ? 8 : 12 }}>
        {activeCase.messages.length === 0 && !loading && (
          <div style={{ textAlign: "center", color: t.textVeryFaint, fontSize: "0.78rem", letterSpacing: "0.08em", padding: "40px 0" }}>
            {tr("app.caseReady")}
          </div>
        )}

        {activeCase.messages.map((message, index) => {
          if (message.type === MSG.INPUT) {
            const roundNo = getInputRoundNumber(activeCase.messages, index);
            const hasChips = (message.symptoms?.length > 0) || (message.obdCodes?.length > 0);

            return (
              <div key={message.id} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ maxWidth: mobile ? "88%" : "72%", minWidth: mobile ? 0 : 120 }}>
                  <div style={{ fontSize: "0.65rem", color: t.textFaint, textAlign: "right", marginBottom: 4, letterSpacing: "0.06em" }}>
                    {tr("app.inputRound", { num: roundNo, date: fmtDate(message.timestamp, lang) })}
                  </div>
                  <div style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRight: `3px solid ${t.accent}`, borderRadius: "8px 2px 8px 8px", padding: "10px 14px" }}>
                    {hasChips && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: message.text ? 8 : 0 }}>
                        {(message.symptoms ?? []).map((symptom) => (
                          <SymptomChip key={symptom} label={tr(symptom)} />
                        ))}
                        {(message.obdCodes ?? []).map((code) => (
                          <ObdChip key={code} code={code} />
                        ))}
                      </div>
                    )}
                    {message.text && (
                      <div style={{ fontSize: "0.85rem", color: t.text, lineHeight: 1.6 }}>{message.text}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          if (message.type === MSG.DIAGNOSIS) {
            const matchIds = message.ragMatchIds ?? [];
            const ragSessions = cases.filter((kase) => matchIds.includes(kase.id));

            return (
              <div key={message.id} style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ maxWidth: "92%" }}>
                  <div style={{ fontSize: "0.65rem", color: t.accentText, marginBottom: 4, letterSpacing: "0.06em" }}>
                    ◈ GearBrain · {fmtDate(message.timestamp, lang)}
                  </div>
                  <DiagCard result={message.result} ragMatches={ragSessions} />
                </div>
              </div>
            );
          }

          return null;
        })}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "16px 20px", background: t.bgMuted, border: `1px solid ${t.border}`, borderLeft: `3px solid ${t.accent}`, borderRadius: "2px 8px 8px 8px" }}>
              <div style={{ animation: "pulse 1.5s ease infinite", fontSize: "0.78rem", color: t.accent, letterSpacing: "0.15em" }}>{tr("app.aiProcessing")}</div>
              <div style={{ fontSize: "0.7rem", color: t.textVeryFaint, marginTop: 4 }}>{tr("app.aiProcessingSub")}</div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: "10px 14px", background: "rgba(220,38,38,0.08)", border: "1px solid #dc2626", color: "#dc2626", fontSize: "0.82rem", borderRadius: 2 }}>
            ⚠ {error}
          </div>
        )}

        {activeCase.status === CASE_STATUS.CLOSED && activeCase.resolution && (
          <div style={{ padding: "14px 16px", background: t.closedBg, border: `1px solid ${t.closedBorder}`, borderLeft: `4px solid ${t.doneStatusColor}`, borderRadius: 2, marginTop: 4 }}>
            <div style={{ fontSize: "0.68rem", color: t.doneStatusColor, letterSpacing: "0.1em", marginBottom: 6 }}>
              {tr("app.caseClosed", { date: activeCase.closedAt ? fmtDate(activeCase.closedAt, lang) : "" })}
            </div>
            <div style={{ fontSize: "0.9rem", color: t.doneStatusColor, lineHeight: 1.6 }}>{activeCase.resolution}</div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
