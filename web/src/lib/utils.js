/** Generuje unikátní ID (crypto-safe UUID v4, zkrácený na 8 znaků) */
export const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 8);

/** Formátuje ISO timestamp do lokalizovaného formátu: "DD.MM. HH:MM" */
const LOCALE_MAP = { cs: "cs-CZ", en: "en-GB", de: "de-DE" };
export const fmtDate = (iso, lang) => {
  const locale = LOCALE_MAP[lang] || "cs-CZ";
  const d = new Date(iso);
  return (
    d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" }) +
    " " +
    d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  );
};

/** Barva levého pruhu / progress baru závady podle naléhavosti */
export const urgColor = (u) =>
  ({ kritická: "#dc2626", vysoká: "#1a3c6e", střední: "#d97706" }[u] ?? "#16a34a");

/** Formátuje nájezd jako lokalizované číslo s jednotkou */
export const fmtMileage = (km, lang) =>
  km ? `${Number(km).toLocaleString(LOCALE_MAP[lang] || "cs-CZ")} km` : "";
