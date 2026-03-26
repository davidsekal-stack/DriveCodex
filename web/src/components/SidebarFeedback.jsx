import { useTheme } from "../contexts/ThemeContext.jsx";

export default function SidebarFeedback({
  feedbackStatus,
  feedbackText,
  onChangeText,
  onSubmit,
  tr,
}) {
  const { t } = useTheme();
  const canSubmit = Boolean(feedbackText.trim()) && feedbackStatus !== "sending";

  return (
    <div style={{ padding: "7px 12px" }}>
      {feedbackStatus === "sent" ? (
        <div style={{ fontSize: "0.67rem", color: t.doneStatusColor, letterSpacing: "0.04em" }}>
          ✓ {tr("app.feedbackSent")}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            type="text"
            value={feedbackText}
            onChange={(event) => onChangeText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void onSubmit();
            }}
            placeholder={tr("app.feedbackPlaceholder")}
            disabled={feedbackStatus === "sending"}
            style={{ flex: 1, background: t.bgInput, border: `1px solid ${feedbackStatus === "error" ? "#dc2626" : t.borderInput}`, color: t.text, padding: "5px 8px", fontSize: "0.67rem", fontFamily: "inherit", borderRadius: 2, outline: "none", minWidth: 0 }}
          />
          <button
            disabled={!canSubmit}
            onClick={() => void onSubmit()}
            style={{ background: canSubmit ? t.accent : "transparent", border: `1px solid ${canSubmit ? t.accent : t.borderInput}`, color: canSubmit ? "#fff" : t.textVeryFaint, padding: "5px 8px", fontSize: "0.67rem", cursor: canSubmit ? "pointer" : "not-allowed", fontFamily: "inherit", borderRadius: 2, flexShrink: 0, whiteSpace: "nowrap" }}
          >
            {feedbackStatus === "sending" ? "..." : tr("app.feedbackSend")}
          </button>
        </div>
      )}
      {feedbackStatus === "error" && (
        <div style={{ fontSize: "0.62rem", color: "#dc2626", marginTop: 3 }}>
          ⚠ {tr("app.feedbackError")}
        </div>
      )}
    </div>
  );
}
