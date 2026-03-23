import { CASE_STATUS } from "../constants/enums.js";

export default function StatusBadge({ status, t, tr }) {
  const closed = status === CASE_STATUS.CLOSED;

  return (
    <span style={{ padding: "2px 8px", fontSize: "0.65rem", fontWeight: 600, background: closed ? t.doneStatusBg : t.openStatusBg, color: closed ? t.doneStatusColor : t.openStatusColor, border: `1px solid ${closed ? t.doneStatusBorder : t.openStatusBorder}`, borderRadius: 2, whiteSpace: "nowrap" }}>
      {closed ? tr("status.closed") : tr("status.active")}
    </span>
  );
}
