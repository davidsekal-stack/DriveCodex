// ── Auto-rozšířený katalog vozidel (spravuje CRAWLER, ne člověk) ───────────────
//
// Sem přidává vozy AUTOMATICKY crawler po ověření z VÍCE NEZÁVISLÝCH, ideálně
// OFICIÁLNÍCH zdrojů (scripts/agent/vehicle-web-verify.mjs). Je to SCHVÁLNĚ
// oddělené od ručně udržovaného catalog.js / catalog-us.js:
//   • na první pohled vidíš, co přidal stroj (každá položka má razítko + zdroje),
//   • revert = smazat položku nebo celý seznam (jeden commit zpět),
//   • testy ručního katalogu zůstávají stabilní.
//
// catalog-helpers.js tyto modely PŘIPOJÍ k odpovídající (existující, aktivní)
// značce. Nové ZNAČKY se sem nikdy automaticky nepřidávají.
//
// Tvar položky:
//   { brand: "BMW", market: "EU", added: "2026-06-23",
//     sources: ["en.wikipedia.org", "ultimatespecs.com"],
//     model: { label: "5 Series E39 (1995–2003)", powers: ["110 kW – 520i 2.0", …] } }

export const VEHICLE_CATALOG_AUTO = [];
