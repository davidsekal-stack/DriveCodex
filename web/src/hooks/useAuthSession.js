import { useEffect, useState } from "react";

import { loadInitialSession } from "../lib/auth-session.js";
import { supabase } from "../lib/supabase.js";

export default function useAuthSession() {
  const [session, setSession] = useState(null);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    loadInitialSession(() => supabase.auth.getSession()).then(({ appReady: nextAppReady, session: currentSession }) => {
      if (!mounted) return;
      setSession(currentSession);
      setAppReady(nextAppReady);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    appReady,
    session,
    setSession,
  };
}
