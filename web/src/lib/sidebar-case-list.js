import { fmtDate } from "../lib/utils.js";

export function buildSidebarCaseSubtitle(kase, lang) {
  const parts = [fmtDate(kase.createdAt, lang)];

  if (kase.vehicle?.model) {
    parts.push(kase.vehicle.model.split(" ").slice(0, 2).join(" "));
  }

  return parts.filter(Boolean).join(" · ");
}
