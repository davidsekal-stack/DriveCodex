/** Centralized enum constants — prevents typo bugs from scattered string literals */

/** Message types (case.messages[].type) */
export const MSG = {
  INPUT: "input",
  DIAGNOSIS: "diagnosis",
}

/** Case status (case.status) */
export const CASE_STATUS = {
  OPEN: "rozpracovaný",
  CLOSED: "uzavřený",
}

/** Review status (gearbrain_cases.status) */
export const REVIEW_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
}
