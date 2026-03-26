/**
 * Pokusí se opravit zkrácený nebo mírně poškozený JSON z API odpovědi.
 * 1) Zkusí přímý JSON.parse
 * 2) Heuristická oprava — najde poslední kompletní závadu a doplní zbytek struktury
 * @param {string} raw - surový text z API
 * @returns {Object|null}
 */
export function smartRepair(raw) {
  const start = raw.indexOf("{");
  if (start === -1) return null;

  const str = raw.slice(start);
  try { return JSON.parse(str); } catch (_) {}

  let depth = 0, inStr = false, esc = false, lastFaultEnd = -1;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (esc)               { esc = false; continue; }
    if (c === "\\" && inStr) { esc = true;  continue; }
    if (c === '"')           { inStr = !inStr; continue; }
    if (inStr)               continue;
    if (c === "{" || c === "[")      depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 2 && c === "}") lastFaultEnd = i;
    }
  }

  if (lastFaultEnd > 0) {
    try {
      return JSON.parse(
        str.slice(0, lastFaultEnd + 1) +
        '\n],\n"doporučené_testy":[],\n"varování":null,\n"další_info":null\n}'
      );
    } catch (_) {}
  }

  return null;
}
