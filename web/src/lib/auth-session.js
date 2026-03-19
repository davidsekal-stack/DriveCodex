export async function loadInitialSession(getSession) {
  try {
    const { data: { session } } = await getSession();
    return {
      appReady: true,
      session: session ?? null,
    };
  } catch {
    return {
      appReady: true,
      session: null,
    };
  }
}
