import { useTheme } from "../contexts/ThemeContext.jsx";
import {
  ACTION_STATUS,
  GUIDE_OUTCOME,
  GUIDE_PHASE,
  GUIDE_VERSION,
  REPAIR_GUIDE_CARD_ID,
  TEST_STATUS,
  allActionsFailed,
  getActiveTest,
  getAttemptSummary,
  getChosenAction,
  getGuidePhase,
  getGuideProgress,
} from "../lib/repair-guide.js";
import { SourceBadge } from "./DiagCard.jsx";
import { fmtDate } from "../lib/utils.js";

// ── Sdílené drobnosti ────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  const { t } = useTheme();
  return (
    <div style={{ fontSize: "0.62rem", color: t.textFaint, letterSpacing: "0.12em", margin: "14px 0 8px" }}>
      {children}
    </div>
  );
}

function UndoLink({ onClick, tr, testId }) {
  const { t } = useTheme();
  return (
    <button
      data-testid={testId ?? "guide-undo"}
      onClick={onClick}
      style={{
        background: "transparent", border: "none", color: t.textFaint,
        fontSize: "0.72rem", textDecoration: "underline", cursor: "pointer",
        fontFamily: "inherit", padding: "4px 6px", flexShrink: 0,
      }}>
      ↺ {tr("guide.undo")}
    </button>
  );
}

function Marker({ kind, label }) {
  const { t } = useTheme();
  const base = {
    width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: "0.74rem", fontWeight: 700,
  };
  if (kind === "done") return <span style={{ ...base, background: t.doneStatusColor, color: "#fff" }}>✓</span>;
  if (kind === "failed") return <span style={{ ...base, background: "rgba(220,38,38,0.12)", border: "2px solid #dc2626", color: "#dc2626" }}>✗</span>;
  if (kind === "muted") return <span style={{ ...base, border: `2px solid ${t.border}`, color: t.textFaint }}>–</span>;
  if (kind === "active") return <span style={{ ...base, border: `2px solid ${t.accent}`, color: t.accentText }}>{label}</span>;
  return <span style={{ ...base, border: `2px solid ${t.border}`, color: t.textFaint }}>{label}</span>;
}

function PrimaryButton({ children, onClick, color, outlined, testId }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        background: outlined ? "transparent" : color,
        border: `1px solid ${color}`,
        color: outlined ? color : "#fff",
        padding: "10px 20px", fontSize: "0.82rem", fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit", borderRadius: 2,
        letterSpacing: "0.04em", minHeight: 40,
      }}>
      {children}
    </button>
  );
}

// ── Předchozí pokusy ─────────────────────────────────────────────────────────

function PreviousAttempts({ history, lang, tr }) {
  const { t } = useTheme();
  if (!history?.length) return null;
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 3, padding: "10px 14px", marginBottom: 10 }}>
      <div style={{ fontSize: "0.62rem", color: t.textFaint, letterSpacing: "0.12em", marginBottom: 6 }}>
        {tr("guide.attemptsTitle")}
      </div>
      {history.map((attempt, index) => {
        const summary = getAttemptSummary(attempt);
        const wasSolved = attempt.outcome === GUIDE_OUTCOME.SOLVED && summary.helpedAction;
        // Oprava, která „pomohla", ale závada se pak vrátila, patří mezi provedené
        // neúspěšné akce — nesmí ze záznamu zmizet (zpětná vazba panelu mechaniků).
        const performed = [
          ...(!wasSolved && summary.helpedAction ? [summary.helpedAction] : []),
          ...summary.failedActions,
        ];
        const line = wasSolved
          ? tr("guide.attemptSolved", { fault: summary.faultName, action: summary.helpedAction })
          : performed.length > 0
            ? tr("guide.attemptFailed", { fault: summary.faultName, actions: performed.join(", ") })
            : tr("guide.attemptNone", { fault: summary.faultName });
        return (
          <div key={attempt.archivedAt ?? index} style={{ fontSize: "0.78rem", color: t.textMuted, padding: "3px 0", display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ color: wasSolved ? t.doneStatusColor : "#dc2626", flexShrink: 0 }}>{wasSolved ? "✓" : "✗"}</span>
            <span style={{ flex: 1 }}>{line}</span>
            {attempt.archivedAt && (
              <span style={{ fontSize: "0.66rem", color: t.textFaint, flexShrink: 0 }}>{fmtDate(attempt.archivedAt, lang)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Fáze 1: testy ────────────────────────────────────────────────────────────

function TestRow({ test, order, isActive, interactive, onDone, onSkip, onUndo, tr }) {
  const { t } = useTheme();
  const resolved = test.status !== TEST_STATUS.PENDING;
  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px",
      background: isActive ? t.bgCardAlt : "transparent",
      border: `1px solid ${isActive ? t.borderAccent : t.border}`,
      borderLeft: `3px solid ${isActive ? t.accent : test.status === TEST_STATUS.DONE ? t.doneStatusColor : t.border}`,
      borderRadius: 2, opacity: resolved ? 0.78 : 1,
    }}>
      <Marker kind={test.status === TEST_STATUS.DONE ? "done" : test.status === TEST_STATUS.SKIPPED ? "muted" : isActive ? "active" : "pending"} label={order} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            fontSize: "0.9rem", fontWeight: isActive ? 700 : 600,
            color: resolved ? t.textMuted : t.text,
            textDecoration: test.status === TEST_STATUS.SKIPPED ? "line-through" : "none",
          }}>
            {test.title}
          </span>
          {test.status === TEST_STATUS.SKIPPED && (
            <span style={{ fontSize: "0.66rem", color: t.textFaint }}>{tr("guide.skipped")}</span>
          )}
          {resolved && interactive && <UndoLink onClick={() => onUndo(test.id)} tr={tr} />}
        </div>
        {isActive && interactive && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <PrimaryButton testId="guide-test-done" onClick={() => onDone(test.id)} color={t.accent}>
              ✓ {tr("guide.stepDone")}
            </PrimaryButton>
            <button
              data-testid="guide-test-skip"
              onClick={() => onSkip(test.id)}
              style={{
                background: "transparent", border: `1px solid ${t.border}`, color: t.textFaint,
                padding: "10px 16px", fontSize: "0.8rem", cursor: "pointer",
                fontFamily: "inherit", borderRadius: 2, minHeight: 40,
              }}>
              {tr("guide.stepSkip")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fáze 2: možné opravy ─────────────────────────────────────────────────────

function ActionRow({ action, canChoose, interactive, outcomeSet, onChoose, onCancel, onHelped, onFailed, onUndo, tr }) {
  const { t } = useTheme();
  const isChosen = action.status === ACTION_STATUS.CHOSEN;

  const marker = action.status === ACTION_STATUS.HELPED ? "done"
    : action.status === ACTION_STATUS.FAILED ? "failed"
    : action.status === ACTION_STATUS.NOT_NEEDED ? "muted"
    : isChosen ? "active" : "pending";

  const dimmed = action.status === ACTION_STATUS.NOT_NEEDED
    || (action.status === ACTION_STATUS.PENDING && !canChoose && !isChosen);

  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px",
      background: isChosen ? t.bgCardAlt : "transparent",
      border: `1px solid ${isChosen ? t.borderAccent : t.border}`,
      borderLeft: `3px solid ${isChosen ? t.accent
        : action.status === ACTION_STATUS.HELPED ? t.doneStatusColor
        : action.status === ACTION_STATUS.FAILED ? "#dc2626" : t.border}`,
      borderRadius: 2, opacity: dimmed ? 0.55 : 1,
    }}>
      <Marker kind={marker} label="○" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            fontSize: "0.9rem", fontWeight: isChosen || action.status === ACTION_STATUS.HELPED ? 700 : 600,
            color: action.status === ACTION_STATUS.FAILED || action.status === ACTION_STATUS.NOT_NEEDED ? t.textMuted : t.text,
          }}>
            {action.title}
          </span>
          {action.status === ACTION_STATUS.FAILED && (
            <span style={{ fontSize: "0.7rem", color: "#dc2626", fontWeight: 700 }}>{tr("guide.failedLabel")}</span>
          )}
          {action.status === ACTION_STATUS.NOT_NEEDED && (
            <span style={{ fontSize: "0.7rem", color: t.textFaint }}>{tr("guide.notNeeded")}</span>
          )}
          {(action.status === ACTION_STATUS.FAILED || action.status === ACTION_STATUS.HELPED) && interactive && !outcomeSet && (
            <UndoLink onClick={() => onUndo(action.id)} tr={tr} />
          )}
        </div>

        {action.status === ACTION_STATUS.PENDING && canChoose && interactive && (
          <div style={{ marginTop: 8 }}>
            <PrimaryButton testId="guide-action-choose" onClick={() => onChoose(action.id)} color={t.accent} outlined>
              ▸ {tr("guide.choose")}
            </PrimaryButton>
          </div>
        )}

        {isChosen && interactive && (
          <div style={{ marginTop: 8 }}>
            <div style={{
              fontSize: "0.76rem", color: t.openStatusColor, background: t.openStatusBg,
              border: `1px solid ${t.openStatusBorder}`, padding: "6px 10px", borderRadius: 2, marginBottom: 10,
            }}>
              ⚠ {tr("guide.checkValues")}
            </div>
            <div style={{ fontSize: "0.74rem", color: t.textMuted, marginBottom: 8 }}>{tr("guide.didItHelp")}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <PrimaryButton testId="guide-action-helped" onClick={() => onHelped(action.id)} color={t.doneStatusColor}>
                ✓ {tr("guide.helpedBtn")}
              </PrimaryButton>
              <PrimaryButton testId="guide-action-failed" onClick={() => onFailed(action.id)} color="#dc2626" outlined>
                ✗ {tr("guide.failedBtn")}
              </PrimaryButton>
              <UndoLink onClick={() => onCancel(action.id)} tr={tr} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Hlavní karta průvodce ────────────────────────────────────────────────────

export default function RepairGuideCard({
  guide,
  history,
  caseClosed,
  lang,
  mobile,
  onCompleteTest,
  onSkipTest,
  onRevertTest,
  onStartAction,
  onCancelAction,
  onActionHelped,
  onActionFailed,
  onRevertAction,
  onFinalSolved,
  onFinalPersists,
  onRevertOutcome,
  onEndAttempt,
  onRequestCloseCase,
  tr,
}) {
  const { t } = useTheme();
  const validGuide = guide?.version === GUIDE_VERSION ? guide : null;
  if (!validGuide && !history?.length) return null;

  const phase = validGuide ? getGuidePhase(validGuide) : null;
  const { done, total } = getGuideProgress(validGuide);
  const interactive = !caseClosed;
  const outcomeSet = Boolean(validGuide?.outcome);
  const solved = validGuide?.outcome === GUIDE_OUTCOME.SOLVED;
  const persists = validGuide?.outcome === GUIDE_OUTCOME.PERSISTS;
  const activeTest = validGuide ? getActiveTest(validGuide) : null;
  const chosen = validGuide ? getChosenAction(validGuide) : null;
  const everythingFailed = validGuide ? allActionsFailed(validGuide) : false;
  const edgeColor = solved ? t.doneStatusColor : persists ? "#dc2626" : t.accent;

  return (
    <div data-testid="repair-guide-block">
      <PreviousAttempts history={history} lang={lang} tr={tr} />

      {validGuide && (
        <div
          id={REPAIR_GUIDE_CARD_ID}
          data-testid="repair-guide"
          className="fade-in"
          style={{
            background: t.bgCard, border: `1px solid ${t.borderAccent}`,
            borderLeft: `4px solid ${edgeColor}`, borderRadius: 3,
            padding: mobile ? "12px" : "16px",
          }}
        >
          {/* Hlavička */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: "0.62rem", color: t.textFaint, letterSpacing: "0.15em", marginBottom: 5 }}>
                {tr("guide.title")}
              </div>
              <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: mobile ? "1.05rem" : "1.2rem", fontWeight: 700, color: t.text }}>
                {validGuide.faultName}
              </div>
              <div style={{ marginTop: 4 }}>
                <SourceBadge fault={{ zdroj: validGuide.zdroj, početShod: validGuide.početShod }} tr={tr} />
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: 100 }}>
              <div style={{ fontSize: "0.76rem", color: solved ? t.doneStatusColor : t.textMuted, fontWeight: 600 }}>
                {tr("guide.progress", { done, total })}
              </div>
              <div style={{ height: 4, background: t.probBarBg, borderRadius: 2, marginTop: 5 }}>
                <div style={{ height: "100%", width: `${total > 0 ? Math.round((done / total) * 100) : 0}%`, background: edgeColor, borderRadius: 2, transition: "width 0.4s ease" }} />
              </div>
            </div>
          </div>

          {/* Varování z diagnózy */}
          {validGuide.varování && (
            <div style={{ marginTop: 10, fontSize: "0.8rem", color: "#dc2626", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.3)", padding: "8px 12px", borderRadius: 2 }}>
              ⚠ {validGuide.varování}
            </div>
          )}

          {/* Fáze 1: ověření příčiny */}
          {validGuide.tests.length > 0 && (
            <>
              <SectionLabel>{tr("guide.phaseTests")}</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {validGuide.tests.map((test, index) => (
                  <TestRow
                    key={test.id}
                    test={test}
                    order={index + 1}
                    isActive={activeTest?.id === test.id}
                    interactive={interactive && !outcomeSet}
                    onDone={onCompleteTest}
                    onSkip={onSkipTest}
                    onUndo={onRevertTest}
                    tr={tr}
                  />
                ))}
              </div>
            </>
          )}

          {/* Fáze 2: možné opravy (alternativy!) */}
          <SectionLabel>{tr("guide.phaseActions")}</SectionLabel>
          {validGuide.díly.length > 0 && (
            <div style={{ fontSize: "0.74rem", color: t.textMuted, marginBottom: 8 }}>
              {tr("guide.partsHint", { parts: validGuide.díly.join(" · ") })}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: phase === GUIDE_PHASE.TESTS ? 0.55 : 1 }}>
            {validGuide.actions.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                canChoose={phase === GUIDE_PHASE.ACTIONS && !chosen}
                interactive={interactive && !outcomeSet}
                outcomeSet={outcomeSet}
                onChoose={onStartAction}
                onCancel={onCancelAction}
                onHelped={onActionHelped}
                onFailed={onActionFailed}
                onUndo={onRevertAction}
                tr={tr}
              />
            ))}
          </div>

          {/* Všechny opravy selhaly */}
          {everythingFailed && !outcomeSet && interactive && (
            <div style={{ marginTop: 10, padding: "12px 14px", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 2 }}>
              <div style={{ fontSize: "0.84rem", color: "#dc2626", fontWeight: 700, marginBottom: 8 }}>
                {tr("guide.allFailed")}
              </div>
              <PrimaryButton testId="guide-final-persists" onClick={onFinalPersists} color="#dc2626" outlined>
                {tr("guide.persistsBtn")}
              </PrimaryButton>
            </div>
          )}

          {/* Fáze 3: závěrečná kontrola */}
          <SectionLabel>{tr("guide.phaseFinal")}</SectionLabel>
          <div style={{
            display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px",
            background: phase === GUIDE_PHASE.FINAL ? t.bgCardAlt : "transparent",
            border: `1px solid ${phase === GUIDE_PHASE.FINAL ? t.borderAccent : t.border}`,
            borderLeft: `3px solid ${solved ? t.doneStatusColor : persists ? "#dc2626" : phase === GUIDE_PHASE.FINAL ? t.accent : t.border}`,
            borderRadius: 2,
            opacity: phase === GUIDE_PHASE.FINAL || outcomeSet ? 1 : 0.55,
          }}>
            <Marker kind={solved ? "done" : persists ? "failed" : phase === GUIDE_PHASE.FINAL ? "active" : "pending"} label="✓" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: "0.9rem", fontWeight: phase === GUIDE_PHASE.FINAL ? 700 : 600, color: t.text }}>
                {tr("guide.stepVerifyDefault")}
              </span>
              {phase === GUIDE_PHASE.FINAL && !outcomeSet && interactive && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <PrimaryButton testId="guide-final-solved" onClick={onFinalSolved} color={t.doneStatusColor}>
                    ✓ {tr("guide.finalSolvedBtn")}
                  </PrimaryButton>
                  <PrimaryButton testId="guide-final-persists-check" onClick={onFinalPersists} color="#dc2626" outlined>
                    ✗ {tr("guide.persistsBtn")}
                  </PrimaryButton>
                </div>
              )}
            </div>
          </div>

          {/* Výsledek: vyřešeno */}
          {solved && !caseClosed && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: t.closedBg, border: `1px solid ${t.closedBorder}`, borderRadius: 2 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: t.doneStatusColor }}>
                  ✓ {tr("guide.completed")}
                </div>
                <UndoLink onClick={onRevertOutcome} tr={tr} testId="guide-undo-outcome" />
              </div>
              <div style={{ fontSize: "0.76rem", color: t.textMuted, marginTop: 4, lineHeight: 1.6 }}>
                {tr("guide.completedHint")}
              </div>
              <div style={{ marginTop: 10 }}>
                <PrimaryButton testId="guide-close-case" onClick={onRequestCloseCase} color={t.doneStatusColor}>
                  {tr("guide.closeCase")}
                </PrimaryButton>
              </div>
            </div>
          )}

          {/* Výsledek: závada přetrvává */}
          {persists && !caseClosed && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 2 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#dc2626" }}>
                  ✗ {tr("guide.persistsTitle")}
                </div>
                <UndoLink onClick={onRevertOutcome} tr={tr} testId="guide-undo-outcome" />
              </div>
              <div style={{ fontSize: "0.76rem", color: t.textMuted, marginTop: 4, lineHeight: 1.6 }}>
                {tr("guide.persistsHint")}
              </div>
              <div style={{ marginTop: 10 }}>
                <PrimaryButton testId="guide-end-attempt" onClick={onEndAttempt} color="#dc2626" outlined>
                  {tr("guide.endAttempt")}
                </PrimaryButton>
              </div>
            </div>
          )}

          {/* Poznámka o hodnotách z příruček */}
          {!outcomeSet && (
            <div style={{ marginTop: 12, fontSize: "0.72rem", color: t.textFaint, fontStyle: "italic", lineHeight: 1.5 }}>
              {tr("guide.valuesNote")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
