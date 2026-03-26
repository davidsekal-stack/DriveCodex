import { useState, useEffect, useCallback } from "react";
import { fetchReviewCases } from "../lib/storage-edge.js";

/**
 * Hook pro admin data — pending review count.
 * Volá se jen pokud je uživatel admin.
 */
export default function useAdminData(session, isAdmin) {
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  const refreshPendingCount = useCallback(() => {
    if (!session || !isAdmin) return Promise.resolve();
    return fetchReviewCases("pending")
      .then((data) => setPendingReviewCount(data.cases?.length ?? 0))
      .catch(() => {});
  }, [session, isAdmin]);

  useEffect(() => { refreshPendingCount(); }, [refreshPendingCount]);

  return { pendingReviewCount, refreshPendingCount };
}
