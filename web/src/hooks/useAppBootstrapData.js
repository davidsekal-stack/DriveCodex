import { useEffect, useState } from "react";

import {
  loadCasesCloudStatus,
  loadGlobalCaseCount,
} from "../lib/app-bootstrap.js";
import * as storage from "../lib/storage.js";

export default function useAppBootstrapData({
  loadCases,
  session,
  setCloudStatus,
}) {
  const [globalCaseCount, setGlobalCaseCount] = useState(null);

  useEffect(() => {
    if (!session) return undefined;

    let active = true;

    loadCasesCloudStatus(loadCases).then((nextCloudStatus) => {
      if (!active) return;
      setCloudStatus(nextCloudStatus);
    });

    loadGlobalCaseCount(storage.getGlobalCaseCount).then((result) => {
      if (!active || !result.hasGlobalCaseCount) return;
      setGlobalCaseCount(result.globalCaseCount);
    });

    return () => {
      active = false;
    };
  }, [loadCases, session, setCloudStatus]);

  return globalCaseCount;
}
