import { CASE_STATUS } from "../constants/enums.js";
import { useTheme } from "../contexts/ThemeContext.jsx";
import InputForm, { FollowUpPrompt } from "./InputForm.jsx";

export default function SessionComposer({
  activeCase,
  diagCount,
  loading,
  mobile,
  onRunDiag,
  tr,
}) {
  const { t } = useTheme();
  if (activeCase.status !== CASE_STATUS.OPEN) return null;

  return (
    <div style={{ borderTop: `1px solid ${t.border}`, padding: mobile ? "10px" : "14px 20px", background: t.bgFollowup, flexShrink: 0 }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {diagCount === 0 ? (
          <>
            <div style={{ fontSize: "0.68rem", color: t.textVeryFaint, letterSpacing: "0.08em", marginBottom: 10 }}>{tr("app.firstDiag")}</div>
            <InputForm onSubmit={onRunDiag} loading={loading} label={tr("app.runDiag")} vehicle={activeCase.vehicle} />
          </>
        ) : (
          <>
            <div style={{ fontSize: "0.68rem", color: t.textVeryFaint, letterSpacing: "0.08em", marginBottom: 10 }}>{tr("app.addInfo")}</div>
            <FollowUpPrompt onSubmit={onRunDiag} loading={loading} />
          </>
        )}
      </div>
    </div>
  );
}
