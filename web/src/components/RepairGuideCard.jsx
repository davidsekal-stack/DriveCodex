import { useTheme } from "../contexts/ThemeContext.jsx";
import {
  GUIDE_STEP,
  GUIDE_STEP_STATUS,
  REPAIR_GUIDE_CARD_ID,
  getActiveGuideStep,
  getGuideProgress,
} from "../lib/repair-guide.js";
import { SourceBadge } from "./DiagCard.jsx";

// ── Kolečko se stavem kroku ──────────────────────────────────────────────────

function StepMarker({ step, isActive, order }) {
  const { t } = useTheme();
  const base = {
    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: "0.66rem", fontWeight: 700,
  };

  if (step.status === GUIDE_STEP_STATUS.DONE) {
    return <span style={{ ...base, background: t.doneStatusColor, color: "#fff" }}>✓</span>;
  }
  if (step.status === GUIDE_STEP_STATUS.SKIPPED) {
    return <span style={{ ...base, border: `2px solid ${t.border}`, color: t.textFaint }}>–</span>;
  }
  return (
    <span style={{
      ...base,
      border: `2px solid ${isActive ? t.accent : t.border}`,
      color: isActive ? t.accentText : t.textFaint,
    }}>
      {order}
    </span>
  );
}

// ── Jeden krok ───────────────────────────────────────────────────────────────

function GuideStep({ step, order, isActive, interactive, mobile, onComplete, onSkip, tr }) {
  const { t } = useTheme();
  const isResolved = step.status !== GUIDE_STEP_STATUS.PENDING;

  const title = step.kind === GUIDE_STEP.PARTS
    ? tr("guide.stepParts")
    : step.kind === GUIDE_STEP.VERIFY
      ? tr("guide.stepVerify")
      : step.title;

  const detailItems = Array.isArray(step.detail) ? step.detail.filter(Boolean) : [];

  return (
    <div style={{
      display: "flex", gap: 10, padding: mobile ? "8px 10px" : "10px 12px",
      background: isActive ? t.bgCardAlt : "transparent",
      border: `1px solid ${isActive ? t.borderAccent : t.border}`,
      borderLeft: `3px solid ${isActive ? t.accent : step.status === GUIDE_STEP_STATUS.DONE ? t.doneStatusColor : t.border}`,
      borderRadius: 2,
      opacity: isResolved ? 0.72 : 1,
    }}>
      <StepMarker step={step} isActive={isActive} order={order} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            fontSize: "0.84rem", fontWeight: isActive ? 700 : 600,
            color: isResolved ? t.textMuted : t.text,
            textDecoration: step.status === GUIDE_STEP_STATUS.SKIPPED ? "line-through" : "none",
          }}>
            {title}
          </span>
          {step.status === GUIDE_STEP_STATUS.SKIPPED && (
            <span style={{ fontSize: "0.62rem", color: t.textFaint, letterSpacing: "0.06em" }}>
              {tr("guide.skipped")}
            </span>
          )}
        </div>

        {step.kind === GUIDE_STEP.PARTS && detailItems.length > 0 && (
          <div style={{ fontSize: "0.72rem", color: t.textMuted, marginTop: 3 }}>
            {detailItems.join(" · ")}
          </div>
        )}

        {step.kind === GUIDE_STEP.VERIFY && (
          <div style={{ marginTop: 3 }}>
            {detailItems.length > 0
              ? detailItems.map((item, index) => (
                  <div key={index} style={{ fontSize: "0.72rem", color: t.textMuted, padding: "1px 0" }}>
                    {String(index + 1).padStart(2, "0")}. {item}
                  </div>
                ))
              : (
                  <div style={{ fontSize: "0.72rem", color: t.textMuted }}>
                    {tr("guide.stepVerifyDefault")}
                  </div>
                )}
          </div>
        )}

        {isActive && interactive && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button
              data-testid="guide-step-done"
              onClick={() => onComplete(step.id)}
              style={{
                background: t.accent, border: `1px solid ${t.accent}`, color: "#fff",
                padding: "7px 18px", fontSize: "0.76rem", fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", borderRadius: 2, letterSpacing: "0.04em",
              }}>
              ✓ {tr("guide.stepDone")}
            </button>
            <button
              data-testid="guide-step-skip"
              onClick={() => onSkip(step.id)}
              style={{
                background: "transparent", border: `1px solid ${t.border}`, color: t.textFaint,
                padding: "7px 14px", fontSize: "0.76rem",
                cursor: "pointer", fontFamily: "inherit", borderRadius: 2,
              }}>
              {tr("guide.stepSkip")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Hlavní karta průvodce ────────────────────────────────────────────────────

export default function RepairGuideCard({
  guide,
  caseClosed,
  mobile,
  onCompleteStep,
  onSkipStep,
  onRequestCloseCase,
  tr,
}) {
  const { t } = useTheme();
  if (!guide?.steps?.length) return null;

  const activeStep = getActiveGuideStep(guide);
  const { done, total } = getGuideProgress(guide);
  const completed = Boolean(guide.completedAt);
  const interactive = !caseClosed && !completed;
  const edgeColor = completed ? t.doneStatusColor : t.accent;

  return (
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: "0.62rem", color: t.textFaint, letterSpacing: "0.15em", marginBottom: 5 }}>
            {tr("guide.title")}
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: mobile ? "1rem" : "1.15rem", fontWeight: 700, color: t.text }}>
            {guide.faultName}
          </div>
          <div style={{ marginTop: 4 }}>
            <SourceBadge fault={{ zdroj: guide.zdroj, početShod: guide.početShod }} tr={tr} />
          </div>
        </div>
        <div style={{ textAlign: "right", minWidth: 90 }}>
          <div style={{ fontSize: "0.72rem", color: completed ? t.doneStatusColor : t.textMuted, fontWeight: 600 }}>
            {tr("guide.progress", { done, total })}
          </div>
          <div style={{ height: 4, background: t.probBarBg, borderRadius: 2, marginTop: 5 }}>
            <div style={{ height: "100%", width: `${total > 0 ? Math.round((done / total) * 100) : 0}%`, background: edgeColor, borderRadius: 2, transition: "width 0.4s ease" }} />
          </div>
        </div>
      </div>

      {/* Kroky */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {guide.steps.map((step, index) => (
          <GuideStep
            key={step.id}
            step={step}
            order={index + 1}
            isActive={activeStep?.id === step.id}
            interactive={interactive}
            mobile={mobile}
            onComplete={onCompleteStep}
            onSkip={onSkipStep}
            tr={tr}
          />
        ))}
      </div>

      {/* Dokončeno → výzva k uzavření případu */}
      {completed && !caseClosed && (
        <div style={{ marginTop: 12, padding: "12px 14px", background: t.closedBg, border: `1px solid ${t.closedBorder}`, borderRadius: 2 }}>
          <div style={{ fontSize: "0.84rem", fontWeight: 700, color: t.doneStatusColor }}>
            ✓ {tr("guide.completed")}
          </div>
          <div style={{ fontSize: "0.74rem", color: t.textMuted, marginTop: 4, lineHeight: 1.6 }}>
            {tr("guide.completedHint")}
          </div>
          <button
            data-testid="guide-close-case"
            onClick={onRequestCloseCase}
            style={{
              marginTop: 10, background: t.doneStatusColor, border: `1px solid ${t.doneStatusColor}`,
              color: "#fff", padding: "8px 20px", fontSize: "0.78rem", fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", borderRadius: 2,
            }}>
            {tr("guide.closeCase")}
          </button>
        </div>
      )}

      {/* Poznámka o hodnotách z příruček */}
      {!completed && (
        <div style={{ marginTop: 10, fontSize: "0.66rem", color: t.textFaint, fontStyle: "italic", lineHeight: 1.5 }}>
          {tr("guide.valuesNote")}
        </div>
      )}
    </div>
  );
}
