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

export const VEHICLE_CATALOG_AUTO = [
  {
    "brand": "Lexus",
    "market": "US",
    "added": "2026-06-24",
    "sources": [
      "pressroom.lexus.com",
      "en.wikipedia.org",
      "automobile-catalog.com"
    ],
    "model": {
      "label": "LS Hybrid XF40 (2007–2017)",
      "powers": [
        "438 hp – 5.0 V8 Hybrid"
      ]
    }
  },
  {
    "brand": "Lexus",
    "market": "US",
    "added": "2026-06-24",
    "sources": [
      "pressroom.lexus.com",
      "en.wikipedia.org",
      "autoevolution.com"
    ],
    "model": {
      "label": "Lexus RZ (2023–present)",
      "powers": [
        "201 hp – RZ 300e (electric FWD)",
        "308 hp – RZ 450e (electric AWD)"
      ]
    }
  },
  {
    "brand": "Lexus",
    "market": "US",
    "added": "2026-06-24",
    "sources": [
      "pressroom.lexus.com",
      "en.wikipedia.org",
      "automobile-catalog.com"
    ],
    "model": {
      "label": "GS 450h IV (2012–2020)",
      "powers": [
        "338 hp – 3.5 V6 Atkinson hybrid"
      ]
    }
  },
  {
    "brand": "Škoda",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "en.wikipedia.org",
      "automobile-catalog.com"
    ],
    "model": {
      "label": "Favorit (1988–1994)",
      "powers": [
        "43 kW – 1.3 135",
        "46 kW – 1.3 136"
      ]
    }
  },
  {
    "brand": "Cadillac",
    "market": "US",
    "added": "2026-06-24",
    "sources": [
      "en.wikipedia.org",
      "cadillac.com",
      "autoevolution.com"
    ],
    "model": {
      "label": "Celestiq (2024–present)",
      "powers": [
        "488 kW – Dual-motor electric AWD"
      ]
    }
  },
  {
    "brand": "Kia",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "ultimatespecs.com",
      "automobile-catalog.com"
    ],
    "model": {
      "label": "ProCeed GT (2019–2024)",
      "powers": [
        "150 kW – 1.6 T-GDi"
      ]
    }
  },
  {
    "brand": "BMW",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "en.wikipedia.org",
      "autoevolution.com",
      "ultimatespecs.com",
      "automobile-catalog.com"
    ],
    "model": {
      "label": "3 Series Coupe E92 (2006–2013)",
      "powers": [
        "125 kW – 2.0 petrol (320i)",
        "140 kW – 2.5 petrol (323i)",
        "160 kW – 3.0 petrol (325i)",
        "172 kW – 3.0 petrol (328i)",
        "200 kW – 3.0 petrol (330i)",
        "225 kW – 3.0T petrol (335i)",
        "130 kW – 2.0 diesel (320d)",
        "145 kW – 3.0 diesel (325d)",
        "170 kW – 3.0 diesel (330d)",
        "210 kW – 3.0 diesel (335d)",
        "309 kW – 4.0 V8 (M3)"
      ]
    }
  },
  {
    "brand": "BMW",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "automobile-catalog.com",
      "ultimatespecs.com",
      "en.wikipedia.org"
    ],
    "model": {
      "label": "323ti E36 Compact (1997–2000)",
      "powers": [
        "125 kW – 2.5 inline-6 petrol"
      ]
    }
  },
  {
    "brand": "Chrysler",
    "market": "US",
    "added": "2026-06-24",
    "sources": [
      "en.wikipedia.org",
      "automobile-catalog.com",
      "ultimatespecs.com",
      "autoevolution.com"
    ],
    "model": {
      "label": "PT Cruiser (2001–2010)",
      "powers": [
        "89 kW – 2.2 CRD",
        "110 kW – 2.2 CRD"
      ]
    }
  },
  {
    "brand": "Peugeot",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "ultimatespecs.com",
      "ev-database.org"
    ],
    "model": {
      "label": "e-208 II GT (2019–present)",
      "powers": [
        "100 kW – Electric 50 kWh",
        "115 kW – Electric 51 kWh"
      ]
    }
  },
  {
    "brand": "Smart",
    "market": "US",
    "added": "2026-06-24",
    "sources": [
      "en.wikipedia.org",
      "autoevolution.com"
    ],
    "model": {
      "label": "forfour W454 (2003–2006)",
      "powers": [
        "55 kW – 1.1 petrol",
        "70 kW – 1.3 petrol",
        "80 kW – 1.5 petrol",
        "50 kW – 1.5 CDI diesel"
      ]
    }
  },
  {
    "brand": "Volvo",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "en.wikipedia.org",
      "autoevolution.com"
    ],
    "model": {
      "label": "145 (1967–1974)",
      "powers": [
        "63 kW – B18 1.8 carburettor",
        "91 kW – B20E 2.0 injection"
      ]
    }
  },
  {
    "brand": "BMW",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "en.wikipedia.org",
      "ultimatespecs.com",
      "automobile-catalog.com"
    ],
    "model": {
      "label": "5 Series E39 (1995–2003)",
      "powers": [
        "135 kW – 3.0d (M57, 530d)",
        "142 kW – 3.0d (M57, 530d Touring)"
      ]
    }
  },
  {
    "brand": "BMW",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "en.wikipedia.org",
      "automobile-catalog.com",
      "ultimatespecs.com"
    ],
    "model": {
      "label": "3 Series Cabriolet E93 (2007–2013)",
      "powers": [
        "160 kW – 325i 2.5 petrol",
        "225 kW – 335i 3.0T petrol",
        "130 kW – 320d 2.0 diesel",
        "145 kW – 325d 3.0 diesel",
        "170 kW – 330d 3.0 diesel",
        "309 kW – M3 4.0 V8 petrol"
      ]
    }
  },
  {
    "brand": "Volkswagen",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "en.wikipedia.org",
      "autoevolution.com",
      "ultimatespecs.com"
    ],
    "model": {
      "label": "Vento A3 (1992–1998)",
      "powers": [
        "44 kW – 1.4",
        "66 kW – 1.8 90",
        "85 kW – 2.0",
        "66 kW – 1.9 TDI 90",
        "128 kW – 2.8 VR6"
      ]
    }
  },
  {
    "brand": "BMW",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "en.wikipedia.org",
      "ultimatespecs.com",
      "automobile-catalog.com"
    ],
    "model": {
      "label": "BMW 3 Series E36 (1990–2000)",
      "powers": [
        "85 kW – 1.8 inline-4 petrol (318i)"
      ]
    }
  },
  {
    "brand": "Volvo",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "en.wikipedia.org",
      "autoevolution.com"
    ],
    "model": {
      "label": "142 (1967–1974)",
      "powers": [
        "65 kW – B20A 2.0"
      ]
    }
  },
  {
    "brand": "Renault",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "en.wikipedia.org",
      "ultimatespecs.com",
      "automobile-catalog.com"
    ],
    "model": {
      "label": "5 – Super 5 (1984–1996)",
      "powers": [
        "44 kW – 1.4",
        "50 kW – 1.4 (injection)"
      ]
    }
  },
  {
    "brand": "Renault",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "en.wikipedia.org",
      "automobile-catalog.com",
      "autoevolution.com"
    ],
    "model": {
      "label": "Renault 11 Phase I (1983–1986)",
      "powers": [
        "44 kW – 1.4 Cléon-Fonte"
      ]
    }
  },
  {
    "brand": "SEAT",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "ultimatespecs.com",
      "en.wikipedia.org"
    ],
    "model": {
      "label": "Ibiza Cupra 6L (2002–2008)",
      "powers": [
        "132 kW – 1.8 20VT"
      ]
    }
  },
  {
    "brand": "Citroën",
    "market": "EU",
    "added": "2026-06-24",
    "sources": [
      "en.wikipedia.org",
      "automobile-catalog.com",
      "autoevolution.com"
    ],
    "model": {
      "label": "Xsara Picasso (1999–2012)",
      "powers": [
        "70 kW – 1.6i",
        "66 kW – 1.6 HDi 90",
        "66 kW – 2.0 HDi 90"
      ]
    }
  }
];
