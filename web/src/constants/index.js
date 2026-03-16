// ── Katalog vozidel ───────────────────────────────────────────────────────────
//
// Centrální datová struktura pro všechny podporované značky.
//
// active: true  → zobrazuje se v GUI (výběr modelu, system prompt...)
// active: false → data připravena v katalogu, GUI je zatím nezobrazuje
//
// expertise → odborný kontext vložený do AI system promptu pro tuto značku

export const VEHICLE_CATALOG = [
  {
    brand:     "Ford",
    active:    true,
    expertise: "Ford Transit všech generací a variant (TDCi, EcoBlue, EcoBoost, Elektro) od roku 2006 do současnosti, EU spec (AdBlue, DPF Euro 5/6, SCR systémy)",
    models: [
      // ── 1. Transit (velká dodávka) ──────────────────────────────────────────
      { group: "Transit (velká dodávka)" },
      { label: "Transit MK7 2.2 TDCi (2006–2011)",        powers: ["63 kW (85 k)", "81 kW (110 k)", "85 kW (115 k)", "96 kW (130 k)", "103 kW (140 k)"] },
      { label: "Transit MK7 2.4 TDCi (2006–2011)",        powers: ["74 kW (100 k)", "85 kW (115 k)", "103 kW (140 k)"] },
      { label: "Transit MK7 3.2 TDCi (2006–2011)",        powers: ["147 kW (200 k)"] },
      { label: "Transit MK7 2.3 Duratec (2006–2011)",     powers: ["107 kW (145 k)"] },
      { label: "Transit MK7 FL 2.2 TDCi (2011–2014)",     powers: ["74 kW (100 k)", "92 kW (125 k)", "114 kW (155 k)"] },
      { label: "Transit MK8 2.2 TDCi (2014–2016)",        powers: ["74 kW (100 k)", "92 kW (125 k)", "114 kW (155 k)"] },
      { label: "Transit MK8 2.0 EcoBlue (2016–současnost)", powers: ["77 kW (105 k)", "96 kW (130 k)", "125 kW (170 k)", "136 kW (185 k)"] },
      { label: "E-Transit Elektro (2022–současnost)",      powers: ["135 kW (184 k)", "198 kW (269 k)"] },

      // ── 2. Transit Custom (střední dodávka) ────────────────────────────────
      { group: "Transit Custom" },
      { label: "Transit Custom I 2.2 TDCi (2012–2016)",          powers: ["74 kW (100 k)", "92 kW (125 k)", "113 kW (154 k)"] },
      { label: "Transit Custom I FL 2.0 EcoBlue (2016–2023)",    powers: ["77 kW (105 k)", "96 kW (130 k)", "125 kW (170 k)", "136 kW (185 k)"] },
      { label: "Transit Custom I 1.0 EcoBoost PHEV (2019–2023)", powers: ["93 kW (126 k)"] },
      { label: "Transit Custom II 2.0 EcoBlue (2023–současnost)", powers: ["81 kW (110 k)", "100 kW (136 k)", "110 kW (150 k)", "125 kW (170 k)"] },
      { label: "Transit Custom II 2.5 Duratec PHEV (2023–současnost)", powers: ["171 kW (232 k)"] },
      { label: "E-Transit Custom Elektro (2024–současnost)",     powers: ["100 kW (136 k)", "160 kW (218 k)", "210 kW (285 k)"] },

      // ── 3. Transit Connect (kompaktní dodávka) ─────────────────────────────
      { group: "Transit Connect" },
      { label: "Transit Connect I 1.8 TDCi (2006–2013)",         powers: ["55 kW (75 k)", "66 kW (90 k)", "81 kW (110 k)"] },
      { label: "Transit Connect II 1.6 TDCi (2013–2015)",        powers: ["55 kW (75 k)", "70 kW (95 k)", "85 kW (115 k)"] },
      { label: "Transit Connect II 1.0 EcoBoost (2013–2018)",    powers: ["74 kW (100 k)"] },
      { label: "Transit Connect II 1.5 TDCi (2015–2018)",        powers: ["55 kW (75 k)", "74 kW (100 k)", "88 kW (120 k)"] },
      { label: "Transit Connect II FL 1.5 EcoBlue (2018–2024)",  powers: ["55 kW (75 k)", "74 kW (100 k)", "88 kW (120 k)"] },
      { label: "Transit Connect III 2.0 EcoBlue (2024–současnost)", powers: ["75 kW (102 k)", "90 kW (122 k)"] },
      { label: "Transit Connect III 1.5 EcoBoost PHEV (2024–současnost)", powers: ["110 kW (150 k)"] },

      // ── 4. Transit Courier (nejmenší dodávka) ──────────────────────────────
      { group: "Transit Courier" },
      { label: "Transit Courier I 1.5/1.6 TDCi (2014–2023)",    powers: ["55 kW (75 k)", "70 kW (95 k)", "74 kW (100 k)"] },
      { label: "Transit Courier I 1.0 EcoBoost (2014–2023)",    powers: ["74 kW (100 k)"] },
      { label: "Transit Courier II 1.0 EcoBoost (2023–současnost)", powers: ["74 kW (100 k)", "92 kW (125 k)"] },
      { label: "Transit Courier II 1.5 EcoBlue (2023–současnost)", powers: ["74 kW (100 k)"] },
      { label: "E-Transit Courier Elektro (2025–současnost)",    powers: ["100 kW (136 k)"] },
    ],
  },

  {
    brand:     "Volkswagen",
    active:    true,
    expertise: "Volkswagen osobní a užitková vozidla všech modelových řad (Polo, Golf, Jetta, Passat, Arteon, Tiguan, T-Roc, Touareg, Touran, Sharan, Caddy, Transporter, Crafter, ID série) — motory TSI, TDI, MPI, FSI, TFSI a elektrické pohony od roku 2006 do současnosti, EU spec (AdBlue, DPF Euro 5/6, SCR systémy)",
    models: [
      // ── Polo ──────────────────────────────────────────────────────────────────
      { group: "Polo" },
      { label: "Polo IV (2006–2009)", powers: ["44 kW – 1.2", "47 kW – 1.2", "59 kW – 1.4", "63 kW – 1.4", "51 kW – 1.4 TDI", "59 kW – 1.4 TDI", "74 kW – 1.9 TDI"] },
      { label: "Polo V (2009–2017)", powers: ["44 kW – 1.0 MPI", "55 kW – 1.0 MPI", "66 kW – 1.2", "77 kW – 1.2 TSI", "81 kW – 1.2 TSI", "90 kW – 1.4 TSI", "55 kW – 1.4 TDI", "66 kW – 1.6 TDI", "77 kW – 1.6 TDI", "141 kW – 1.8 TSI GTI"] },
      { label: "Polo VI (2017–dosud)", powers: ["48 kW – 1.0 MPI", "59 kW – 1.0 MPI", "70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "147 kW – 2.0 TSI GTI", "59 kW – 1.6 TDI", "70 kW – 1.6 TDI"] },

      // ── Golf ──────────────────────────────────────────────────────────────────
      { group: "Golf" },
      { label: "Golf V (2006–2008)", powers: ["55 kW – 1.4", "75 kW – 1.6", "66 kW – 1.9 TDI", "77 kW – 1.9 TDI", "103 kW – 2.0 TDI", "147 kW – 2.0 TFSI GTI", "184 kW – 3.2 VR6 R32"] },
      { label: "Golf VI (2008–2012)", powers: ["77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "118 kW – 1.4 TSI", "66 kW – 1.6 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "155 kW – 2.0 TSI GTI"] },
      { label: "Golf VII (2012–2020)", powers: ["63 kW – 1.0 TSI", "85 kW – 1.0 TSI", "63 kW – 1.2 TSI", "77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "103 kW – 1.4 TSI", "96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "66 kW – 1.6 TDI", "81 kW – 1.6 TDI", "110 kW – 2.0 TDI", "135 kW – 2.0 TDI GTD", "162 kW – 2.0 TSI GTI", "169 kW – 2.0 TSI GTI", "221 kW – 2.0 TSI R", "228 kW – 2.0 TSI R"] },
      { label: "Golf VIII (2020–dosud)", powers: ["81 kW – 1.0 TSI", "96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "85 kW – 2.0 TDI", "110 kW – 2.0 TDI", "180 kW – 2.0 TSI GTI", "235 kW – 2.0 TSI R"] },

      // ── Jetta ─────────────────────────────────────────────────────────────────
      { group: "Jetta" },
      { label: "Jetta V (2006–2010)", powers: ["75 kW – 1.6", "90 kW – 1.4 TSI", "103 kW – 1.4 TSI", "77 kW – 1.9 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "147 kW – 2.0 TFSI"] },
      { label: "Jetta VI (2010–2018)", powers: ["77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "110 kW – 1.4 TSI", "77 kW – 1.6 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "110 kW – 2.0 TDI"] },
      { label: "Jetta VII (2018–dosud)", powers: ["81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "110 kW – 2.0 TDI"] },

      // ── Passat ────────────────────────────────────────────────────────────────
      { group: "Passat" },
      { label: "Passat B6 (2006–2010)", powers: ["85 kW – 1.6 FSI", "118 kW – 1.8 TSI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "147 kW – 2.0 TFSI", "220 kW – 3.6 VR6"] },
      { label: "Passat B7 (2010–2014)", powers: ["90 kW – 1.4 TSI", "110 kW – 1.4 TSI", "118 kW – 1.8 TSI", "132 kW – 1.8 TSI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "130 kW – 2.0 TDI", "155 kW – 2.0 TSI", "220 kW – 3.6 VR6"] },
      { label: "Passat B8 (2014–2023)", powers: ["110 kW – 1.5 TSI", "140 kW – 2.0 TSI", "200 kW – 2.0 TSI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI", "176 kW – 2.0 TDI"] },
      { label: "Passat B9 (2023–dosud)", powers: ["110 kW – 1.5 TSI", "150 kW – 1.5 TSI eHybrid", "200 kW – 1.5 TSI eHybrid", "110 kW – 2.0 TDI", "142 kW – 2.0 TDI"] },

      // ── Arteon ────────────────────────────────────────────────────────────────
      { group: "Arteon" },
      { label: "Arteon I (2017–2023)", powers: ["110 kW – 1.5 TSI", "140 kW – 2.0 TSI", "206 kW – 2.0 TSI", "110 kW – 2.0 TDI", "147 kW – 2.0 TDI", "235 kW – 2.0 TSI R"] },
      { label: "Arteon II (2023–dosud)", powers: ["110 kW – 1.5 TSI", "150 kW – 2.0 TSI", "110 kW – 2.0 TDI", "142 kW – 2.0 TDI"] },

      // ── Tiguan ────────────────────────────────────────────────────────────────
      { group: "Tiguan" },
      { label: "Tiguan I (2007–2016)", powers: ["110 kW – 1.4 TSI", "118 kW – 1.4 TSI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "135 kW – 2.0 TDI", "125 kW – 2.0 TSI", "147 kW – 2.0 TSI", "155 kW – 2.0 TSI"] },
      { label: "Tiguan II (2016–2023)", powers: ["96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "132 kW – 2.0 TSI", "180 kW – 2.0 TSI", "110 kW – 2.0 TDI", "147 kW – 2.0 TDI", "235 kW – 2.0 TSI R"] },
      { label: "Tiguan III (2023–dosud)", powers: ["96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "150 kW – 1.5 TSI eHybrid", "200 kW – 1.5 TSI eHybrid", "110 kW – 2.0 TDI", "142 kW – 2.0 TDI"] },

      // ── T-Roc ─────────────────────────────────────────────────────────────────
      { group: "T-Roc" },
      { label: "T-Roc (2017–dosud)", powers: ["81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "140 kW – 2.0 TSI", "221 kW – 2.0 TSI R", "85 kW – 1.6 TDI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI"] },

      // ── Touareg ───────────────────────────────────────────────────────────────
      { group: "Touareg" },
      { label: "Touareg II (2010–2018)", powers: ["150 kW – 3.0 V6 TDI", "176 kW – 3.0 V6 TDI", "193 kW – 3.0 V6 TDI", "204 kW – 3.0 V6 TDI", "206 kW – 3.6 V6 FSI", "250 kW – 4.2 V8 TDI"] },
      { label: "Touareg III (2018–dosud)", powers: ["170 kW – 3.0 V6 TDI", "210 kW – 3.0 V6 TDI", "231 kW – 3.0 V6 TDI", "280 kW – 3.0 V6 TSI eHybrid", "340 kW – 3.0 V6 TSI eHybrid R"] },

      // ── Touran ────────────────────────────────────────────────────────────────
      { group: "Touran" },
      { label: "Touran II (2015–dosud)", powers: ["81 kW – 1.2 TSI", "110 kW – 1.4 TSI", "110 kW – 1.5 TSI", "81 kW – 1.6 TDI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI"] },

      // ── Sharan ────────────────────────────────────────────────────────────────
      { group: "Sharan" },
      { label: "Sharan II (2010–2022)", powers: ["110 kW – 1.4 TSI", "147 kW – 2.0 TSI", "85 kW – 2.0 TDI", "103 kW – 2.0 TDI", "130 kW – 2.0 TDI", "135 kW – 2.0 TDI"] },

      // ── Caddy ─────────────────────────────────────────────────────────────────
      { group: "Caddy" },
      { label: "Caddy III (2006–2015)", powers: ["55 kW – 1.4", "75 kW – 1.6", "63 kW – 1.2 TSI", "77 kW – 1.2 TSI", "55 kW – 1.6 TDI", "75 kW – 1.6 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI"] },
      { label: "Caddy IV (2015–2020)", powers: ["75 kW – 1.0 TSI", "62 kW – 1.2 TSI", "92 kW – 1.4 TSI", "55 kW – 2.0 TDI", "75 kW – 2.0 TDI", "103 kW – 2.0 TDI", "110 kW – 2.0 TDI"] },
      { label: "Caddy V (2020–dosud)", powers: ["84 kW – 1.5 TSI", "96 kW – 1.5 TSI", "55 kW – 2.0 TDI", "75 kW – 2.0 TDI", "90 kW – 2.0 TDI", "110 kW – 2.0 TDI"] },

      // ── Transporter ───────────────────────────────────────────────────────────
      { group: "Transporter" },
      { label: "Transporter T5 (2006–2015)", powers: ["85 kW – 2.0", "62 kW – 1.9 TDI", "75 kW – 1.9 TDI", "77 kW – 1.9 TDI", "96 kW – 2.5 TDI", "128 kW – 2.5 TDI", "62 kW – 2.0 TDI", "75 kW – 2.0 TDI", "103 kW – 2.0 TDI", "132 kW – 2.0 BiTDI"] },
      { label: "Transporter T6 (2015–2019)", powers: ["62 kW – 2.0 TDI", "75 kW – 2.0 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "110 kW – 2.0 TDI", "150 kW – 2.0 TDI", "132 kW – 2.0 BiTDI", "150 kW – 2.0 TSI"] },
      { label: "Transporter T6.1 (2019–dosud)", powers: ["66 kW – 2.0 TDI", "81 kW – 2.0 TDI", "110 kW – 2.0 TDI", "150 kW – 2.0 TDI", "146 kW – 2.0 BiTDI"] },

      // ── Crafter ───────────────────────────────────────────────────────────────
      { group: "Crafter" },
      { label: "Crafter I (2006–2016)", powers: ["65 kW – 2.5 TDI", "80 kW – 2.5 TDI", "100 kW – 2.5 TDI", "120 kW – 2.5 TDI", "80 kW – 2.0 TDI", "100 kW – 2.0 TDI", "120 kW – 2.0 TDI"] },
      { label: "Crafter II (2016–dosud)", powers: ["75 kW – 2.0 TDI", "90 kW – 2.0 TDI", "103 kW – 2.0 TDI", "130 kW – 2.0 TDI", "177 kW – 2.0 TDI", "100 kW – e-Crafter Electric"] },

      // ── ID (elektro) ─────────────────────────────────────────────────────────
      { group: "ID (elektro)" },
      { label: "ID.3 (2020–dosud)", powers: ["107 kW – Electric Pro", "125 kW – Electric Pro", "150 kW – Electric Pro S", "170 kW – Electric Pro S", "210 kW – Electric GTX"] },
      { label: "ID.4 (2020–dosud)", powers: ["109 kW – Electric Pure", "125 kW – Electric Pro", "150 kW – Electric Pro", "195 kW – Electric Pro S", "210 kW – Electric GTX", "220 kW – Electric GTX"] },
      { label: "ID.5 (2021–dosud)", powers: ["128 kW – Electric Pro", "150 kW – Electric Pro", "195 kW – Electric Pro S", "210 kW – Electric GTX", "220 kW – Electric GTX"] },
    ],
  },

  {
    brand:     "Škoda",
    active:    true,
    expertise: "Škoda osobní vozidla všech modelových řad (Fabia, Scala, Octavia, Superb, Kamiq, Karoq, Kodiaq, Yeti, Roomster, Citigo, Enyaq) — motory TSI, TDI, MPI, HTP a elektrické pohony od roku 2006 do současnosti, EU spec (AdBlue, DPF Euro 5/6)",
    models: [
      // ── Citigo ────────────────────────────────────────────────────────────────
      { group: "Citigo" },
      { label: "Citigo (2011–2020)", powers: ["44 kW – 1.0 MPI", "55 kW – 1.0 MPI", "61 kW – Electric"] },

      // ── Fabia ─────────────────────────────────────────────────────────────────
      { group: "Fabia" },
      { label: "Fabia II (2007–2014)", powers: ["44 kW – 1.2 HTP", "51 kW – 1.2 HTP", "63 kW – 1.2 TSI", "77 kW – 1.2 TSI", "132 kW – 1.4 TSI RS", "51 kW – 1.4 TDI", "59 kW – 1.4 TDI", "66 kW – 1.6 TDI", "77 kW – 1.6 TDI"] },
      { label: "Fabia III (2014–2021)", powers: ["44 kW – 1.0 MPI", "55 kW – 1.0 MPI", "70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "66 kW – 1.2 TSI", "81 kW – 1.2 TSI", "66 kW – 1.4 TDI", "77 kW – 1.4 TDI"] },
      { label: "Fabia IV (2021–dosud)", powers: ["48 kW – 1.0 MPI", "59 kW – 1.0 MPI", "70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI"] },

      // ── Rapid / Scala ─────────────────────────────────────────────────────────
      { group: "Rapid / Scala" },
      { label: "Rapid (2012–2019)", powers: ["55 kW – 1.0 MPI", "70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "77 kW – 1.2 TSI", "66 kW – 1.4 TDI", "66 kW – 1.6 TDI"] },
      { label: "Scala (2019–dosud)", powers: ["70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "85 kW – 1.6 TDI"] },

      // ── Octavia ───────────────────────────────────────────────────────────────
      { group: "Octavia" },
      { label: "Octavia II (2006–2013)", powers: ["59 kW – 1.4", "75 kW – 1.6", "77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "118 kW – 1.8 TSI", "147 kW – 2.0 TSI RS", "77 kW – 1.6 TDI", "77 kW – 1.9 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI"] },
      { label: "Octavia III (2013–2020)", powers: ["63 kW – 1.2 TSI", "77 kW – 1.2 TSI", "81 kW – 1.2 TSI", "85 kW – 1.0 TSI", "103 kW – 1.4 TSI", "110 kW – 1.4 TSI", "110 kW – 1.5 TSI", "162 kW – 2.0 TSI RS", "180 kW – 2.0 TSI RS", "66 kW – 1.6 TDI", "77 kW – 1.6 TDI", "85 kW – 1.6 TDI", "110 kW – 2.0 TDI", "135 kW – 2.0 TDI"] },
      { label: "Octavia IV (2020–dosud)", powers: ["81 kW – 1.0 TSI", "110 kW – 1.5 TSI", "140 kW – 2.0 TSI", "180 kW – 2.0 TSI RS", "195 kW – 2.0 TSI RS", "85 kW – 2.0 TDI", "110 kW – 2.0 TDI", "147 kW – 2.0 TDI"] },

      // ── Superb ────────────────────────────────────────────────────────────────
      { group: "Superb" },
      { label: "Superb II (2008–2015)", powers: ["92 kW – 1.4 TSI", "118 kW – 1.8 TSI", "132 kW – 1.8 TSI", "147 kW – 2.0 TSI", "206 kW – 2.0 TSI", "77 kW – 1.6 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "140 kW – 2.0 TDI"] },
      { label: "Superb III (2015–dosud)", powers: ["110 kW – 1.4 TSI", "110 kW – 1.5 TSI", "140 kW – 2.0 TSI", "200 kW – 2.0 TSI", "88 kW – 1.6 TDI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI", "176 kW – 2.0 TDI"] },

      // ── Yeti ──────────────────────────────────────────────────────────────────
      { group: "Yeti" },
      { label: "Yeti (2009–2017)", powers: ["77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "110 kW – 1.4 TSI", "118 kW – 1.8 TSI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "110 kW – 2.0 TDI", "125 kW – 2.0 TDI"] },

      // ── Roomster ──────────────────────────────────────────────────────────────
      { group: "Roomster" },
      { label: "Roomster (2006–2015)", powers: ["47 kW – 1.2 HTP", "51 kW – 1.2 HTP", "63 kW – 1.2 TSI", "77 kW – 1.2 TSI", "51 kW – 1.4 TDI", "59 kW – 1.4 TDI", "66 kW – 1.6 TDI"] },

      // ── Kamiq ─────────────────────────────────────────────────────────────────
      { group: "Kamiq" },
      { label: "Kamiq (2019–dosud)", powers: ["70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "85 kW – 1.6 TDI"] },

      // ── Karoq ─────────────────────────────────────────────────────────────────
      { group: "Karoq" },
      { label: "Karoq (2017–dosud)", powers: ["81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "140 kW – 2.0 TSI", "85 kW – 1.6 TDI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI"] },

      // ── Kodiaq ────────────────────────────────────────────────────────────────
      { group: "Kodiaq" },
      { label: "Kodiaq (2016–dosud)", powers: ["110 kW – 1.4 TSI", "110 kW – 1.5 TSI", "132 kW – 2.0 TSI", "180 kW – 2.0 TSI", "180 kW – 2.0 TSI RS", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI", "147 kW – 2.0 TDI"] },

      // ── Enyaq ─────────────────────────────────────────────────────────────────
      { group: "Enyaq" },
      { label: "Enyaq iV (2021–dosud)", powers: ["109 kW – Electric 50", "132 kW – Electric 60", "150 kW – Electric 80", "195 kW – Electric 80x", "220 kW – Electric RS"] },
    ],
  },

  {
    brand:     "Audi",
    active:    true,
    expertise: "Audi osobní vozidla všech modelových řad (A1–A8, Q2–Q8, TT, e-tron) — motory TFSI, TDI a elektrické pohony od roku 2006 do současnosti, EU spec (AdBlue, DPF Euro 5/6, SCR, quattro)",
    models: [
      // ── A1 ────────────────────────────────────────────────────────────────────
      { group: "A1" },
      { label: "A1 8X (2010–2018)", powers: ["63 kW – 1.0 TFSI", "70 kW – 1.0 TFSI", "66 kW – 1.2 TFSI", "77 kW – 1.2 TFSI", "90 kW – 1.4 TFSI", "103 kW – 1.4 TFSI", "66 kW – 1.6 TDI"] },
      { label: "A1 GB (2018–dosud)", powers: ["70 kW – 1.0 TFSI", "81 kW – 1.0 TFSI", "85 kW – 1.0 TFSI", "110 kW – 1.5 TFSI", "147 kW – 2.0 TFSI S line"] },

      // ── A3 ────────────────────────────────────────────────────────────────────
      { group: "A3" },
      { label: "A3 8P (2006–2012)", powers: ["75 kW – 1.6", "77 kW – 1.2 TFSI", "92 kW – 1.4 TFSI", "118 kW – 1.8 TFSI", "147 kW – 2.0 TFSI", "195 kW – 2.5 TFSI RS3", "77 kW – 1.6 TDI", "77 kW – 1.9 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI"] },
      { label: "A3 8V (2012–2020)", powers: ["77 kW – 1.2 TFSI", "81 kW – 1.2 TFSI", "90 kW – 1.4 TFSI", "103 kW – 1.4 TFSI", "110 kW – 1.5 TFSI", "132 kW – 1.8 TFSI", "169 kW – 2.0 TFSI S3", "228 kW – 2.5 TFSI RS3", "77 kW – 1.6 TDI", "81 kW – 1.6 TDI", "110 kW – 2.0 TDI", "135 kW – 2.0 TDI"] },
      { label: "A3 8Y (2020–dosud)", powers: ["81 kW – 1.0 TFSI", "110 kW – 1.5 TFSI", "140 kW – 2.0 TFSI", "228 kW – 2.0 TFSI S3", "294 kW – 2.5 TFSI RS3", "85 kW – 2.0 TDI", "110 kW – 2.0 TDI"] },

      // ── A4 ────────────────────────────────────────────────────────────────────
      { group: "A4" },
      { label: "A4 B7 (2006–2008)", powers: ["96 kW – 1.8 T", "118 kW – 2.0 TFSI", "147 kW – 2.0 TFSI", "188 kW – 3.2 FSI", "85 kW – 1.9 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "150 kW – 2.5 TDI", "171 kW – 3.0 TDI"] },
      { label: "A4 B8 (2008–2015)", powers: ["88 kW – 1.8 TFSI", "118 kW – 1.8 TFSI", "132 kW – 1.8 TFSI", "155 kW – 2.0 TFSI", "165 kW – 2.0 TFSI", "200 kW – 3.0 TFSI", "88 kW – 2.0 TDI", "100 kW – 2.0 TDI", "105 kW – 2.0 TDI", "130 kW – 2.0 TDI", "140 kW – 2.0 TDI", "150 kW – 3.0 TDI", "176 kW – 3.0 TDI"] },
      { label: "A4 B9 (2015–dosud)", powers: ["110 kW – 1.4 TFSI", "110 kW – 1.5 TFSI", "140 kW – 2.0 TFSI", "185 kW – 2.0 TFSI", "260 kW – 2.9 TFSI RS4", "90 kW – 2.0 TDI", "110 kW – 2.0 TDI", "120 kW – 2.0 TDI", "140 kW – 2.0 TDI", "150 kW – 3.0 TDI", "170 kW – 3.0 TDI", "210 kW – 3.0 TDI"] },

      // ── A5 ────────────────────────────────────────────────────────────────────
      { group: "A5" },
      { label: "A5 8T (2007–2016)", powers: ["118 kW – 1.8 TFSI", "155 kW – 2.0 TFSI", "200 kW – 3.0 TFSI", "245 kW – 3.0 TFSI S5", "120 kW – 2.0 TDI", "130 kW – 2.0 TDI", "150 kW – 3.0 TDI", "176 kW – 3.0 TDI"] },
      { label: "A5 F5 (2016–dosud)", powers: ["110 kW – 1.5 TFSI", "140 kW – 2.0 TFSI", "185 kW – 2.0 TFSI", "260 kW – 2.9 TFSI RS5", "110 kW – 2.0 TDI", "120 kW – 2.0 TDI", "140 kW – 2.0 TDI", "170 kW – 3.0 TDI", "210 kW – 3.0 TDI"] },

      // ── A6 ────────────────────────────────────────────────────────────────────
      { group: "A6" },
      { label: "A6 C6 (2006–2011)", powers: ["96 kW – 2.0", "125 kW – 2.0 TFSI", "147 kW – 2.0 TFSI", "162 kW – 2.8 FSI", "213 kW – 3.0 TFSI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "150 kW – 2.7 TDI", "171 kW – 3.0 TDI"] },
      { label: "A6 C7 (2011–2018)", powers: ["132 kW – 1.8 TFSI", "165 kW – 2.0 TFSI", "228 kW – 3.0 TFSI", "310 kW – 4.0 TFSI RS6", "100 kW – 2.0 TDI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI", "150 kW – 3.0 TDI", "160 kW – 3.0 TDI", "200 kW – 3.0 TDI", "235 kW – 3.0 BiTDI"] },
      { label: "A6 C8 (2018–dosud)", powers: ["110 kW – 2.0 TFSI", "150 kW – 2.0 TFSI", "195 kW – 2.0 TFSI", "250 kW – 3.0 TFSI", "441 kW – 4.0 TFSI RS6", "120 kW – 2.0 TDI", "140 kW – 2.0 TDI", "170 kW – 3.0 TDI", "210 kW – 3.0 TDI", "231 kW – 3.0 TDI"] },

      // ── Q2 ────────────────────────────────────────────────────────────────────
      { group: "Q2" },
      { label: "Q2 (2016–dosud)", powers: ["85 kW – 1.0 TFSI", "110 kW – 1.5 TFSI", "140 kW – 2.0 TFSI", "228 kW – 2.5 TFSI SQ2", "85 kW – 1.6 TDI", "110 kW – 2.0 TDI"] },

      // ── Q3 ────────────────────────────────────────────────────────────────────
      { group: "Q3" },
      { label: "Q3 8U (2011–2018)", powers: ["110 kW – 1.4 TFSI", "132 kW – 1.8 TFSI", "162 kW – 2.0 TFSI", "228 kW – 2.5 TFSI RS Q3", "103 kW – 2.0 TDI", "110 kW – 2.0 TDI", "130 kW – 2.0 TDI"] },
      { label: "Q3 F3 (2018–dosud)", powers: ["110 kW – 1.5 TFSI", "140 kW – 2.0 TFSI", "169 kW – 2.0 TFSI", "294 kW – 2.5 TFSI RS Q3", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI"] },

      // ── Q5 ────────────────────────────────────────────────────────────────────
      { group: "Q5" },
      { label: "Q5 8R (2008–2017)", powers: ["132 kW – 2.0 TFSI", "162 kW – 2.0 TFSI", "200 kW – 3.0 TFSI", "270 kW – 3.0 TFSI SQ5", "105 kW – 2.0 TDI", "120 kW – 2.0 TDI", "130 kW – 2.0 TDI", "140 kW – 2.0 TDI", "176 kW – 3.0 TDI", "230 kW – 3.0 BiTDI SQ5"] },
      { label: "Q5 FY (2017–dosud)", powers: ["110 kW – 2.0 TFSI", "140 kW – 2.0 TFSI", "195 kW – 2.0 TFSI", "260 kW – 2.9 TFSI SQ5", "110 kW – 2.0 TDI", "120 kW – 2.0 TDI", "140 kW – 2.0 TDI", "170 kW – 3.0 TDI", "251 kW – 3.0 TDI SQ5"] },

      // ── Q7 ────────────────────────────────────────────────────────────────────
      { group: "Q7" },
      { label: "Q7 4L (2006–2015)", powers: ["206 kW – 3.6 FSI", "245 kW – 4.2 FSI", "176 kW – 3.0 TDI", "180 kW – 3.0 TDI", "150 kW – 3.0 TDI", "240 kW – 4.2 TDI", "250 kW – 6.0 V12 TDI"] },
      { label: "Q7 4M (2015–dosud)", powers: ["185 kW – 2.0 TFSI", "250 kW – 3.0 TFSI", "110 kW – 2.0 TDI", "170 kW – 3.0 TDI", "200 kW – 3.0 TDI", "210 kW – 3.0 TDI", "270 kW – 4.0 TDI SQ7"] },

      // ── Q8 ────────────────────────────────────────────────────────────────────
      { group: "Q8" },
      { label: "Q8 (2018–dosud)", powers: ["250 kW – 3.0 TFSI", "373 kW – 4.0 TFSI SQ8", "441 kW – 4.0 TFSI RS Q8", "170 kW – 3.0 TDI", "210 kW – 3.0 TDI", "270 kW – 4.0 TDI SQ8"] },

      // ── TT ────────────────────────────────────────────────────────────────────
      { group: "TT" },
      { label: "TT 8J (2006–2014)", powers: ["118 kW – 1.8 TFSI", "147 kW – 2.0 TFSI", "155 kW – 2.0 TFSI", "200 kW – 2.0 TFSI TTS", "250 kW – 2.5 TFSI RS", "125 kW – 2.0 TDI"] },
      { label: "TT 8S (2014–dosud)", powers: ["132 kW – 1.8 TFSI", "169 kW – 2.0 TFSI", "228 kW – 2.0 TFSI TTS", "294 kW – 2.5 TFSI RS"] },

      // ── e-tron (elektro) ──────────────────────────────────────────────────────
      { group: "e-tron (elektro)" },
      { label: "e-tron 55 (2019–2023)", powers: ["230 kW – Electric 55", "300 kW – Electric S", "370 kW – Electric RS"] },
      { label: "Q4 e-tron (2021–dosud)", powers: ["125 kW – Electric 35", "150 kW – Electric 40", "195 kW – Electric 45", "220 kW – Electric 50", "250 kW – Electric SQ4"] },
      { label: "Q8 e-tron (2023–dosud)", powers: ["250 kW – Electric 55", "300 kW – Electric S", "370 kW – Electric SQ8"] },
    ],
  },

  {
    brand:     "Toyota",
    active:    true,
    expertise: "Toyota osobní a užitková vozidla všech modelových řad (Aygo, Yaris, Corolla, Auris, Avensis, Camry, C-HR, RAV4, Land Cruiser, Hilux, Proace, Supra) — motory VVT-i, D-4D, hybridní systémy a elektrické pohony od roku 2006 do současnosti, EU spec",
    models: [
      // ── Aygo ──────────────────────────────────────────────────────────────────
      { group: "Aygo" },
      { label: "Aygo I (2006–2014)", powers: ["50 kW – 1.0 VVT-i", "51 kW – 1.4 D-4D"] },
      { label: "Aygo X (2022–dosud)", powers: ["53 kW – 1.0 VVT-i"] },

      // ── Yaris ─────────────────────────────────────────────────────────────────
      { group: "Yaris" },
      { label: "Yaris II (2006–2011)", powers: ["51 kW – 1.0 VVT-i", "64 kW – 1.3 VVT-i", "97 kW – 1.8 VVT-i TS", "66 kW – 1.4 D-4D"] },
      { label: "Yaris III (2011–2020)", powers: ["51 kW – 1.0 VVT-i", "54 kW – 1.0 VVT-i", "73 kW – 1.33 VVT-i", "82 kW – 1.5 VVT-i", "74 kW – 1.5 Hybrid", "66 kW – 1.4 D-4D"] },
      { label: "Yaris IV (2020–dosud)", powers: ["92 kW – 1.5 Hybrid", "85 kW – 1.5 Hybrid", "200 kW – 1.6 Turbo GR"] },

      // ── Corolla ───────────────────────────────────────────────────────────────
      { group: "Corolla" },
      { label: "Corolla E150 (2006–2013)", powers: ["71 kW – 1.33 VVT-i", "97 kW – 1.6 VVT-i", "100 kW – 1.8 VVT-i", "66 kW – 1.4 D-4D", "93 kW – 2.0 D-4D", "91 kW – 2.2 D-CAT"] },
      { label: "Corolla E210 (2019–dosud)", powers: ["85 kW – 1.5 VVT-i", "90 kW – 1.8 Hybrid", "103 kW – 1.8 Hybrid", "140 kW – 2.0 Hybrid", "221 kW – 2.0 Turbo GR"] },

      // ── Auris ─────────────────────────────────────────────────────────────────
      { group: "Auris" },
      { label: "Auris I (2006–2012)", powers: ["73 kW – 1.33 VVT-i", "97 kW – 1.6 VVT-i", "100 kW – 1.8 VVT-i", "66 kW – 1.4 D-4D", "91 kW – 2.0 D-4D", "130 kW – 2.2 D-CAT"] },
      { label: "Auris II (2012–2018)", powers: ["73 kW – 1.33 VVT-i", "97 kW – 1.6 VVT-i", "100 kW – 1.8 Hybrid", "66 kW – 1.4 D-4D", "91 kW – 2.0 D-4D"] },

      // ── Avensis ───────────────────────────────────────────────────────────────
      { group: "Avensis" },
      { label: "Avensis T27 (2009–2018)", powers: ["97 kW – 1.6 VVT-i", "108 kW – 1.8 VVT-i", "112 kW – 2.0 VVT-i", "91 kW – 2.0 D-4D", "93 kW – 2.0 D-4D", "105 kW – 2.2 D-4D", "110 kW – 2.2 D-CAT"] },

      // ── Camry ─────────────────────────────────────────────────────────────────
      { group: "Camry" },
      { label: "Camry XV70 (2019–dosud)", powers: ["131 kW – 2.5 Hybrid", "160 kW – 2.5 Hybrid AWD"] },

      // ── C-HR ──────────────────────────────────────────────────────────────────
      { group: "C-HR" },
      { label: "C-HR I (2016–2023)", powers: ["85 kW – 1.2 Turbo", "90 kW – 1.8 Hybrid", "135 kW – 2.0 Hybrid"] },
      { label: "C-HR II (2023–dosud)", powers: ["103 kW – 1.8 Hybrid", "145 kW – 2.0 Hybrid", "152 kW – 2.0 Hybrid AWD"] },

      // ── RAV4 ──────────────────────────────────────────────────────────────────
      { group: "RAV4" },
      { label: "RAV4 IV (2013–2018)", powers: ["111 kW – 2.0 VVT-i", "107 kW – 2.5 Hybrid", "91 kW – 2.0 D-4D", "110 kW – 2.2 D-4D"] },
      { label: "RAV4 V (2019–dosud)", powers: ["130 kW – 2.0 VVT-i", "160 kW – 2.5 Hybrid", "163 kW – 2.5 Hybrid AWD", "225 kW – 2.5 Plug-in Hybrid"] },

      // ── Land Cruiser ──────────────────────────────────────────────────────────
      { group: "Land Cruiser" },
      { label: "Land Cruiser 150 (2009–dosud)", powers: ["120 kW – 2.8 D-4D", "140 kW – 2.8 D-4D", "145 kW – 2.8 D-4D", "127 kW – 3.0 D-4D"] },
      { label: "Land Cruiser 300 (2021–dosud)", powers: ["227 kW – 3.3 D-4D", "305 kW – 3.5 V6 Twin-Turbo"] },

      // ── Hilux ─────────────────────────────────────────────────────────────────
      { group: "Hilux" },
      { label: "Hilux VIII (2015–dosud)", powers: ["110 kW – 2.4 D-4D", "130 kW – 2.8 D-4D", "150 kW – 2.8 D-4D"] },

      // ── Proace ────────────────────────────────────────────────────────────────
      { group: "Proace" },
      { label: "Proace II (2016–dosud)", powers: ["70 kW – 1.5 D-4D", "88 kW – 1.5 D-4D", "110 kW – 2.0 D-4D", "130 kW – 2.0 D-4D", "100 kW – Electric"] },
      { label: "Proace City (2019–dosud)", powers: ["55 kW – 1.5 D-4D", "75 kW – 1.5 D-4D", "96 kW – 1.2 Turbo", "81 kW – 1.5 D-4D", "100 kW – Electric"] },

      // ── Supra ─────────────────────────────────────────────────────────────────
      { group: "Supra" },
      { label: "Supra GR (2019–dosud)", powers: ["145 kW – 2.0 Turbo", "190 kW – 2.0 Turbo", "250 kW – 3.0 Turbo", "285 kW – 3.0 Turbo"] },
    ],
  },

  {
    brand:     "Renault",
    active:    true,
    expertise: "Renault osobní a užitková vozidla všech modelových řad (Twingo, Clio, Megane, Scenic, Captur, Kadjar, Arkana, Austral, Kangoo, Trafic, Master) — motory TCe, dCi, Blue dCi a elektrické pohony od roku 2006 do současnosti, EU spec (AdBlue od Euro 6)",
    models: [
      // ── Twingo ────────────────────────────────────────────────────────────────
      { group: "Twingo" },
      { label: "Twingo III (2014–dosud)", powers: ["52 kW – 1.0 SCe", "54 kW – 1.0 SCe", "66 kW – 0.9 TCe", "68 kW – 0.9 TCe", "60 kW – Electric"] },

      // ── Clio ──────────────────────────────────────────────────────────────────
      { group: "Clio" },
      { label: "Clio III (2006–2012)", powers: ["55 kW – 1.2", "74 kW – 1.2 TCe", "72 kW – 1.4", "82 kW – 1.6", "145 kW – 2.0 RS", "48 kW – 1.5 dCi", "63 kW – 1.5 dCi", "78 kW – 1.5 dCi"] },
      { label: "Clio IV (2012–2019)", powers: ["54 kW – 1.2", "66 kW – 0.9 TCe", "87 kW – 1.2 TCe", "118 kW – 1.6 Turbo RS", "162 kW – 1.6 Turbo RS Trophy", "55 kW – 1.5 dCi", "66 kW – 1.5 dCi"] },
      { label: "Clio V (2019–dosud)", powers: ["49 kW – 1.0 SCe", "67 kW – 1.0 TCe", "74 kW – 1.0 TCe", "103 kW – 1.3 TCe", "104 kW – 1.6 E-Tech Hybrid", "63 kW – 1.5 Blue dCi", "85 kW – 1.5 Blue dCi"] },

      // ── Megane ────────────────────────────────────────────────────────────────
      { group: "Megane" },
      { label: "Megane III (2008–2016)", powers: ["74 kW – 1.2 TCe", "85 kW – 1.2 TCe", "97 kW – 1.2 TCe", "81 kW – 1.6", "96 kW – 2.0", "184 kW – 2.0 TCe RS", "201 kW – 2.0 TCe RS Trophy", "66 kW – 1.5 dCi", "81 kW – 1.5 dCi", "95 kW – 1.6 dCi", "110 kW – 1.6 dCi", "96 kW – 2.0 dCi"] },
      { label: "Megane IV (2016–2022)", powers: ["74 kW – 1.0 TCe", "85 kW – 1.0 TCe", "103 kW – 1.3 TCe", "117 kW – 1.3 TCe", "205 kW – 1.8 TCe RS", "221 kW – 1.8 TCe RS Trophy", "85 kW – 1.5 Blue dCi", "110 kW – 1.5 Blue dCi", "118 kW – 1.7 Blue dCi"] },
      { label: "Megane E-Tech Electric (2022–dosud)", powers: ["96 kW – Electric 40", "131 kW – Electric 60", "160 kW – Electric 60"] },

      // ── Scenic ────────────────────────────────────────────────────────────────
      { group: "Scenic" },
      { label: "Scenic III (2009–2016)", powers: ["85 kW – 1.2 TCe", "97 kW – 1.2 TCe", "81 kW – 1.6", "96 kW – 2.0", "66 kW – 1.5 dCi", "81 kW – 1.5 dCi", "95 kW – 1.6 dCi", "118 kW – 1.6 dCi", "96 kW – 2.0 dCi", "110 kW – 2.0 dCi"] },
      { label: "Scenic IV (2016–2022)", powers: ["85 kW – 1.2 TCe", "103 kW – 1.3 TCe", "117 kW – 1.3 TCe", "85 kW – 1.5 Blue dCi", "110 kW – 1.5 Blue dCi", "88 kW – 1.7 Blue dCi", "110 kW – 1.7 Blue dCi"] },

      // ── Captur ────────────────────────────────────────────────────────────────
      { group: "Captur" },
      { label: "Captur I (2013–2019)", powers: ["66 kW – 0.9 TCe", "87 kW – 1.2 TCe", "66 kW – 1.5 dCi", "81 kW – 1.5 dCi"] },
      { label: "Captur II (2019–dosud)", powers: ["74 kW – 1.0 TCe", "103 kW – 1.3 TCe", "117 kW – 1.3 TCe", "116 kW – 1.6 E-Tech Hybrid", "118 kW – 1.6 E-Tech PHEV", "85 kW – 1.5 Blue dCi"] },

      // ── Kadjar / Austral / Arkana ─────────────────────────────────────────────
      { group: "Kadjar / Austral / Arkana" },
      { label: "Kadjar (2015–2022)", powers: ["97 kW – 1.2 TCe", "117 kW – 1.3 TCe", "85 kW – 1.5 Blue dCi", "110 kW – 1.5 Blue dCi", "96 kW – 1.6 dCi"] },
      { label: "Arkana (2021–dosud)", powers: ["103 kW – 1.3 TCe", "117 kW – 1.3 TCe", "105 kW – 1.6 E-Tech Hybrid", "145 kW – 1.6 E-Tech Hybrid"] },
      { label: "Austral (2022–dosud)", powers: ["96 kW – 1.2 TCe", "110 kW – 1.2 TCe", "130 kW – 1.2 E-Tech Hybrid", "147 kW – 1.2 E-Tech Hybrid"] },

      // ── Koleos ────────────────────────────────────────────────────────────────
      { group: "Koleos" },
      { label: "Koleos II (2017–dosud)", powers: ["96 kW – 1.3 TCe", "117 kW – 1.3 TCe", "96 kW – 1.7 Blue dCi", "110 kW – 2.0 Blue dCi", "140 kW – 2.0 Blue dCi"] },

      // ── Kangoo ────────────────────────────────────────────────────────────────
      { group: "Kangoo" },
      { label: "Kangoo II (2008–2021)", powers: ["55 kW – 1.2 TCe", "85 kW – 1.2 TCe", "55 kW – 1.5 dCi", "66 kW – 1.5 dCi", "81 kW – 1.5 dCi", "44 kW – Electric"] },
      { label: "Kangoo III (2021–dosud)", powers: ["96 kW – 1.3 TCe", "75 kW – 1.5 Blue dCi", "85 kW – 1.5 Blue dCi", "90 kW – Electric"] },

      // ── Trafic ────────────────────────────────────────────────────────────────
      { group: "Trafic" },
      { label: "Trafic III (2014–dosud)", powers: ["70 kW – 1.6 dCi", "85 kW – 1.6 dCi", "88 kW – 1.6 dCi", "103 kW – 1.6 dCi", "107 kW – 2.0 dCi", "110 kW – 2.0 Blue dCi", "125 kW – 2.0 Blue dCi"] },

      // ── Master ────────────────────────────────────────────────────────────────
      { group: "Master" },
      { label: "Master III (2010–dosud)", powers: ["74 kW – 2.3 dCi", "81 kW – 2.3 dCi", "92 kW – 2.3 dCi", "100 kW – 2.3 dCi", "107 kW – 2.3 dCi", "110 kW – 2.3 Blue dCi", "120 kW – 2.3 Blue dCi"] },
    ],
  },

  {
    brand:     "Dacia",
    active:    true,
    expertise: "Dacia osobní vozidla všech modelových řad (Logan, Sandero, Duster, Jogger, Dokker, Lodgy, Spring) — motory SCe, TCe, dCi, Blue dCi, LPG a elektrický pohon od roku 2006 do současnosti, EU spec",
    models: [
      // ── Logan ─────────────────────────────────────────────────────────────────
      { group: "Logan" },
      { label: "Logan I (2006–2012)", powers: ["55 kW – 1.4", "64 kW – 1.4", "77 kW – 1.6", "62 kW – 1.5 dCi", "50 kW – 1.5 dCi"] },
      { label: "Logan II (2012–2020)", powers: ["54 kW – 1.0 SCe", "66 kW – 0.9 TCe", "73 kW – 1.0 TCe", "55 kW – 1.5 dCi", "66 kW – 1.5 dCi", "70 kW – 1.5 Blue dCi"] },
      { label: "Logan III (2021–dosud)", powers: ["48 kW – 1.0 SCe", "67 kW – 1.0 TCe", "74 kW – 1.0 TCe", "96 kW – 1.3 TCe", "74 kW – 1.0 TCe LPG", "63 kW – 1.5 Blue dCi"] },

      // ── Sandero ───────────────────────────────────────────────────────────────
      { group: "Sandero" },
      { label: "Sandero I (2008–2012)", powers: ["55 kW – 1.4", "64 kW – 1.4", "77 kW – 1.6", "50 kW – 1.5 dCi"] },
      { label: "Sandero II (2012–2020)", powers: ["54 kW – 1.0 SCe", "66 kW – 0.9 TCe", "73 kW – 1.0 TCe", "55 kW – 1.5 dCi", "66 kW – 1.5 dCi", "70 kW – 1.5 Blue dCi"] },
      { label: "Sandero III (2021–dosud)", powers: ["48 kW – 1.0 SCe", "67 kW – 1.0 TCe", "74 kW – 1.0 TCe", "96 kW – 1.3 TCe", "110 kW – 1.3 TCe Stepway", "74 kW – 1.0 TCe LPG"] },

      // ── Duster ────────────────────────────────────────────────────────────────
      { group: "Duster" },
      { label: "Duster I (2010–2017)", powers: ["77 kW – 1.6", "92 kW – 1.2 TCe", "79 kW – 1.5 dCi", "80 kW – 1.5 dCi"] },
      { label: "Duster II (2018–2024)", powers: ["96 kW – 1.0 TCe", "110 kW – 1.3 TCe", "96 kW – 1.0 TCe LPG", "84 kW – 1.5 Blue dCi", "85 kW – 1.5 Blue dCi"] },
      { label: "Duster III (2024–dosud)", powers: ["96 kW – 1.0 TCe", "103 kW – 1.2 TCe", "96 kW – 1.0 TCe LPG", "103 kW – 1.2 TCe Hybrid 48V"] },

      // ── Lodgy / Jogger ────────────────────────────────────────────────────────
      { group: "Lodgy / Jogger" },
      { label: "Lodgy (2012–2022)", powers: ["73 kW – 1.0 TCe", "75 kW – 1.6", "96 kW – 1.3 TCe", "55 kW – 1.5 dCi", "80 kW – 1.5 dCi"] },
      { label: "Jogger (2022–dosud)", powers: ["74 kW – 1.0 TCe", "96 kW – 1.0 TCe", "74 kW – 1.0 TCe LPG", "103 kW – 1.6 E-Tech Hybrid"] },

      // ── Dokker ────────────────────────────────────────────────────────────────
      { group: "Dokker" },
      { label: "Dokker (2012–2020)", powers: ["54 kW – 1.0 SCe", "73 kW – 1.0 TCe", "75 kW – 1.6", "55 kW – 1.5 dCi", "66 kW – 1.5 dCi"] },

      // ── Spring ────────────────────────────────────────────────────────────────
      { group: "Spring" },
      { label: "Spring (2021–dosud)", powers: ["33 kW – Electric", "48 kW – Electric Extreme"] },
    ],
  },

  {
    brand:     "Peugeot",
    active:    true,
    expertise: "Peugeot osobní a užitková vozidla všech modelových řad (208, 308, 508, 2008, 3008, 5008, Rifter, Expert, Boxer) — motory PureTech, BlueHDi, THP a elektrické pohony od roku 2006 do současnosti, EU spec (AdBlue, DPF Euro 5/6, SCR)",
    models: [
      // ── 207 / 208 ────────────────────────────────────────────────────────────
      { group: "207 / 208" },
      { label: "207 (2006–2012)", powers: ["54 kW – 1.4 VTi", "65 kW – 1.4 VTi", "88 kW – 1.6 VTi", "110 kW – 1.6 THP", "128 kW – 1.6 THP GTi", "150 kW – 1.6 THP RC", "50 kW – 1.4 HDi", "66 kW – 1.6 HDi", "80 kW – 1.6 HDi"] },
      { label: "208 I (2012–2019)", powers: ["50 kW – 1.0 VTi", "60 kW – 1.2 VTi", "81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "147 kW – 1.6 THP GTi", "153 kW – 1.6 THP GTi by PS", "50 kW – 1.4 HDi", "68 kW – 1.6 HDi", "55 kW – 1.5 BlueHDi", "75 kW – 1.5 BlueHDi"] },
      { label: "208 II (2019–dosud)", powers: ["55 kW – 1.2 PureTech", "75 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "100 kW – Electric e-208", "115 kW – Electric e-208"] },

      // ── 308 ───────────────────────────────────────────────────────────────────
      { group: "308" },
      { label: "308 I T7 (2007–2013)", powers: ["72 kW – 1.4 VTi", "88 kW – 1.6 VTi", "110 kW – 1.6 THP", "128 kW – 1.6 THP GTi", "66 kW – 1.6 HDi", "82 kW – 1.6 HDi", "100 kW – 2.0 HDi", "120 kW – 2.0 HDi"] },
      { label: "308 II T9 (2013–2021)", powers: ["60 kW – 1.2 PureTech", "81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "151 kW – 1.6 THP", "200 kW – 1.6 THP GTi", "73 kW – 1.5 BlueHDi", "96 kW – 1.5 BlueHDi", "110 kW – 2.0 BlueHDi", "133 kW – 2.0 BlueHDi"] },
      { label: "308 III P5 (2021–dosud)", powers: ["81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "132 kW – 1.2 PureTech", "165 kW – 1.6 PHEV", "132 kW – 1.5 BlueHDi", "96 kW – 1.5 BlueHDi"] },

      // ── 508 ───────────────────────────────────────────────────────────────────
      { group: "508" },
      { label: "508 I (2010–2018)", powers: ["110 kW – 1.6 THP", "121 kW – 1.6 THP", "147 kW – 1.6 THP", "100 kW – 2.0 HDi", "110 kW – 2.0 HDi", "120 kW – 2.0 HDi", "133 kW – 2.0 BlueHDi", "150 kW – 2.2 HDi"] },
      { label: "508 II (2018–dosud)", powers: ["96 kW – 1.2 PureTech", "132 kW – 1.6 PureTech", "165 kW – 1.6 PureTech", "165 kW – 1.6 PHEV", "265 kW – 1.6 PHEV PSE", "96 kW – 1.5 BlueHDi", "118 kW – 2.0 BlueHDi", "133 kW – 2.0 BlueHDi"] },

      // ── 2008 ──────────────────────────────────────────────────────────────────
      { group: "2008" },
      { label: "2008 I (2013–2019)", powers: ["60 kW – 1.2 VTi", "81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "73 kW – 1.5 BlueHDi", "66 kW – 1.6 HDi", "85 kW – 1.6 BlueHDi"] },
      { label: "2008 II (2019–dosud)", powers: ["75 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "100 kW – Electric e-2008", "115 kW – Electric e-2008", "96 kW – 1.5 BlueHDi"] },

      // ── 3008 ──────────────────────────────────────────────────────────────────
      { group: "3008" },
      { label: "3008 I (2009–2016)", powers: ["88 kW – 1.6 VTi", "110 kW – 1.6 THP", "115 kW – 1.6 THP", "121 kW – 1.6 THP", "80 kW – 1.6 HDi", "82 kW – 1.6 BlueHDi", "110 kW – 2.0 HDi", "120 kW – 2.0 HDi", "133 kW – 2.0 BlueHDi", "150 kW – 2.0 HDi Hybrid4"] },
      { label: "3008 II (2016–dosud)", powers: ["96 kW – 1.2 PureTech", "132 kW – 1.6 PureTech", "165 kW – 1.6 PureTech", "165 kW – 1.6 PHEV", "265 kW – 1.6 PHEV", "96 kW – 1.5 BlueHDi", "118 kW – 2.0 BlueHDi", "133 kW – 2.0 BlueHDi"] },

      // ── 5008 ──────────────────────────────────────────────────────────────────
      { group: "5008" },
      { label: "5008 I (2009–2017)", powers: ["88 kW – 1.6 VTi", "110 kW – 1.6 THP", "121 kW – 1.6 THP", "80 kW – 1.6 HDi", "82 kW – 1.6 BlueHDi", "110 kW – 2.0 HDi", "120 kW – 2.0 HDi"] },
      { label: "5008 II (2017–dosud)", powers: ["96 kW – 1.2 PureTech", "132 kW – 1.6 PureTech", "165 kW – 1.6 PureTech", "165 kW – 1.6 PHEV", "73 kW – 1.5 BlueHDi", "96 kW – 1.5 BlueHDi", "118 kW – 2.0 BlueHDi", "133 kW – 2.0 BlueHDi"] },

      // ── Rifter (Partner) ──────────────────────────────────────────────────────
      { group: "Rifter" },
      { label: "Partner Tepee (2008–2018)", powers: ["54 kW – 1.4", "72 kW – 1.6 VTi", "88 kW – 1.6 VTi", "110 kW – 1.6 THP", "50 kW – 1.6 HDi", "66 kW – 1.6 HDi", "82 kW – 1.6 BlueHDi", "73 kW – 1.5 BlueHDi", "96 kW – 2.0 HDi"] },
      { label: "Rifter (2018–dosud)", powers: ["81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "73 kW – 1.5 BlueHDi", "96 kW – 1.5 BlueHDi", "100 kW – Electric e-Rifter"] },

      // ── Expert ────────────────────────────────────────────────────────────────
      { group: "Expert" },
      { label: "Expert III (2016–dosud)", powers: ["75 kW – 1.5 BlueHDi", "88 kW – 1.5 BlueHDi", "110 kW – 2.0 BlueHDi", "130 kW – 2.0 BlueHDi", "100 kW – Electric e-Expert"] },

      // ── Boxer ─────────────────────────────────────────────────────────────────
      { group: "Boxer" },
      { label: "Boxer III (2006–dosud)", powers: ["74 kW – 2.2 HDi", "88 kW – 2.2 HDi", "96 kW – 2.2 HDi", "81 kW – 2.0 BlueHDi", "88 kW – 2.2 BlueHDi", "103 kW – 2.2 BlueHDi", "121 kW – 2.2 BlueHDi", "120 kW – 3.0 HDi"] },
    ],
  },

  // ── BMW ──────────────────────────────────────────────────────────────────────

  {
    brand:     "BMW",
    active:    true,
    expertise: "BMW osobní vozy a SUV všech modelových řad (1, 3, 5, X1, X3, X5) — motory N47/B47 diesel, N20/B48 benzín, N55/B58 R6, S-série M Performance, hybridní a elektrické pohony od roku 2006, EU spec",
    models: [
      // ── Řada 1 ───────────────────────────────────────────────────────────────
      { group: "Řada 1" },
      { label: "1 E87 (2004–2011)", powers: ["85 kW – 1.6 N45", "95 kW – 2.0 N46", "105 kW – 2.0 N43", "125 kW – 2.0 N43", "195 kW – 3.0 N52", "225 kW – 3.0T N54", "85 kW – 2.0d N47", "105 kW – 2.0d N47", "130 kW – 2.0d N47", "150 kW – 2.0d N47S"] },
      { label: "1 F20 (2011–2019)", powers: ["75 kW – 1.6T N13", "100 kW – 1.6T N13", "80 kW – 1.5T B38", "100 kW – 1.5T B38", "135 kW – 2.0T B48", "165 kW – 2.0T B48", "250 kW – 3.0T B58 M140i", "85 kW – 1.5d B37", "105 kW – 2.0d N47", "110 kW – 2.0d B47", "140 kW – 2.0d B47"] },
      { label: "1 F40 (2019–dosud)", powers: ["80 kW – 1.5T B38", "103 kW – 1.5T B38", "131 kW – 2.0T B48", "195 kW – 2.0T B48 128ti", "225 kW – 2.0T B48 M135i", "85 kW – 1.5d B37", "110 kW – 2.0d B47", "140 kW – 2.0d B47"] },

      // ── Řada 3 ───────────────────────────────────────────────────────────────
      { group: "Řada 3" },
      { label: "3 E90 (2005–2012)", powers: ["105 kW – 2.0 N43", "110 kW – 2.0 N46", "125 kW – 2.0 N43", "160 kW – 2.5 N52", "190 kW – 3.0 N52", "225 kW – 3.0T N54", "85 kW – 2.0d N47", "105 kW – 2.0d N47", "130 kW – 2.0d N47", "150 kW – 3.0d N57", "180 kW – 3.0d N57", "210 kW – 3.0d M57"] },
      { label: "3 F30 (2012–2019)", powers: ["100 kW – 1.6T N13", "135 kW – 2.0T N20", "135 kW – 2.0T B48", "185 kW – 2.0T B48", "240 kW – 3.0T B58 340i", "85 kW – 2.0d N47", "110 kW – 2.0d B47", "135 kW – 2.0d N47", "140 kW – 2.0d B47", "190 kW – 3.0d N57", "195 kW – 3.0d B57"] },
      { label: "3 G20 (2019–dosud)", powers: ["115 kW – 2.0T B48", "135 kW – 2.0T B48", "190 kW – 2.0T B48", "275 kW – 3.0T B58 M340i", "110 kW – 2.0d B47", "140 kW – 2.0d B47", "210 kW – 3.0d B57", "250 kW – 3.0d B57 M340d"] },

      // ── Řada 5 ───────────────────────────────────────────────────────────────
      { group: "Řada 5" },
      { label: "5 E60 (2003–2010)", powers: ["125 kW – 2.0 N43", "160 kW – 2.5 N52", "190 kW – 3.0 N52", "225 kW – 3.0T N54", "270 kW – 4.8 N62", "120 kW – 2.0d M47", "130 kW – 2.0d N47", "145 kW – 3.0d M57", "170 kW – 3.0d M57", "200 kW – 3.0d M57 bi-turbo"] },
      { label: "5 F10 (2010–2017)", powers: ["135 kW – 2.0T N20", "185 kW – 2.0T B48", "225 kW – 3.0T N55", "250 kW – 3.0T B58", "300 kW – 4.4T N63", "105 kW – 2.0d N47", "140 kW – 2.0d B47", "190 kW – 3.0d N57", "195 kW – 3.0d B57", "230 kW – 3.0d N57 bi-turbo"] },
      { label: "5 G30 (2017–dosud)", powers: ["135 kW – 2.0T B48", "185 kW – 2.0T B48", "250 kW – 3.0T B58", "340 kW – 4.4T N63 M550i", "110 kW – 2.0d B47", "140 kW – 2.0d B47", "195 kW – 3.0d B57", "210 kW – 3.0d B57", "235 kW – 3.0d B57 540d"] },

      // ── X1 ───────────────────────────────────────────────────────────────────
      { group: "X1" },
      { label: "X1 E84 (2009–2015)", powers: ["110 kW – 2.0 N46", "135 kW – 2.0T N20", "180 kW – 2.0T N20", "85 kW – 2.0d N47", "105 kW – 2.0d N47", "135 kW – 2.0d N47", "160 kW – 2.0d N47S"] },
      { label: "X1 F48 (2015–2022)", powers: ["103 kW – 1.5T B38", "141 kW – 2.0T B48", "85 kW – 1.5d B37", "110 kW – 2.0d B47", "140 kW – 2.0d B47", "170 kW – 2.0d B47", "162 kW – 1.5T+E PHEV"] },
      { label: "X1 U11 (2022–dosud)", powers: ["100 kW – 1.5T B38", "125 kW – 2.0T B48", "150 kW – 2.0T B48", "233 kW – 2.0T B48 M35i", "110 kW – 2.0d B47", "155 kW – 2.0d B47", "150 kW – Electric iX1 eDrive20", "230 kW – Electric iX1 xDrive30"] },

      // ── X3 ───────────────────────────────────────────────────────────────────
      { group: "X3" },
      { label: "X3 F25 (2010–2017)", powers: ["135 kW – 2.0T N20", "180 kW – 2.0T N20", "225 kW – 3.0T N55", "110 kW – 2.0d N47", "140 kW – 2.0d B47", "190 kW – 3.0d N57", "230 kW – 3.0d N57 bi-turbo"] },
      { label: "X3 G01 (2017–dosud)", powers: ["135 kW – 2.0T B48", "185 kW – 2.0T B48", "265 kW – 3.0T B58 M40i", "110 kW – 2.0d B47", "140 kW – 2.0d B47", "195 kW – 3.0d B57", "240 kW – 3.0d B57 M40d", "215 kW – 2.0T+E PHEV", "210 kW – Electric iX3"] },

      // ── X5 ───────────────────────────────────────────────────────────────────
      { group: "X5" },
      { label: "X5 E70 (2006–2013)", powers: ["190 kW – 3.0 N52", "225 kW – 3.0T N55", "300 kW – 4.4T N63", "173 kW – 3.0d M57", "180 kW – 3.0d N57", "210 kW – 3.0d M57 bi-turbo", "225 kW – 3.0d N57"] },
      { label: "X5 F15 (2013–2018)", powers: ["225 kW – 3.0T N55", "330 kW – 4.4T N63", "170 kW – 2.0d B47", "190 kW – 3.0d N57", "230 kW – 3.0d N57", "280 kW – 3.0d N57 M50d", "230 kW – 2.0T+E PHEV"] },
      { label: "X5 G05 (2018–dosud)", powers: ["250 kW – 3.0T B58", "390 kW – 4.4T N63 M50i", "170 kW – 2.0d B47", "195 kW – 3.0d B57", "250 kW – 3.0d B57", "294 kW – 3.0d B57 M50d", "290 kW – 3.0T+E PHEV xDrive45e"] },

      // ── Elektro ──────────────────────────────────────────────────────────────
      { group: "Elektro" },
      { label: "i3 (2013–2022)", powers: ["125 kW – Electric", "135 kW – Electric (2017+)", "170 kW – Electric S (2018+)"] },
    ],
  },

  // ── Tesla ──────────────────────────────────────────────────────────────────

  {
    brand:     "Tesla",
    active:    true,
    expertise: "Tesla elektromobily všech modelových řad (Model 3, Model Y, Model S, Model X) — elektrické pohony, bateriové systémy NMC/LFP, BMS, tepelné čerpadlo, rekuperace, supercharging, HV bezpečnost, OTA aktualizace",
    models: [
      // ── Model 3 ──────────────────────────────────────────────────────────────
      { group: "Model 3" },
      { label: "Model 3 (2017–2023)", powers: ["208 kW – Standard Range RWD", "324 kW – Long Range AWD", "357 kW – Performance AWD"] },
      { label: "Model 3 Highland (2024–dosud)", powers: ["208 kW – RWD", "348 kW – Long Range AWD"] },

      // ── Model Y ──────────────────────────────────────────────────────────────
      { group: "Model Y" },
      { label: "Model Y (2020–2024)", powers: ["220 kW – RWD", "258 kW – Long Range RWD", "324 kW – Long Range AWD", "357 kW – Performance AWD"] },
      { label: "Model Y Juniper (2025–dosud)", powers: ["220 kW – RWD", "340 kW – Long Range AWD"] },

      // ── Model S ──────────────────────────────────────────────────────────────
      { group: "Model S" },
      { label: "Model S (2012–2020)", powers: ["245 kW – 75D AWD", "311 kW – 100D AWD", "449 kW – P100D AWD"] },
      { label: "Model S (2021–dosud)", powers: ["493 kW – Dual Motor AWD", "750 kW – Plaid Tri-Motor"] },

      // ── Model X ──────────────────────────────────────────────────────────────
      { group: "Model X" },
      { label: "Model X (2015–2020)", powers: ["311 kW – 100D AWD", "449 kW – P100D AWD"] },
      { label: "Model X (2021–dosud)", powers: ["493 kW – Dual Motor AWD", "750 kW – Plaid Tri-Motor"] },
    ],
  },

  // ── Kia ────────────────────────────────────────────────────────────────────

  {
    brand:     "Kia",
    active:    true,
    expertise: "Kia osobní vozy a SUV všech modelových řad (Picanto, Rio, Ceed, Sportage, Sorento, Niro, Stonic, EV6) — motory T-GDi, GDi, CRDi, hybridní a elektrické pohony od roku 2010, EU spec",
    models: [
      // ── Picanto ──────────────────────────────────────────────────────────────
      { group: "Picanto" },
      { label: "Picanto II (2011–2017)", powers: ["51 kW – 1.0 Kappa", "63 kW – 1.2 Kappa"] },
      { label: "Picanto III (2017–dosud)", powers: ["49 kW – 1.0 MPI", "67 kW – 1.0 T-GDi", "62 kW – 1.2 MPI"] },

      // ── Rio ──────────────────────────────────────────────────────────────────
      { group: "Rio" },
      { label: "Rio III (2011–2017)", powers: ["62 kW – 1.2 CVVT", "80 kW – 1.4 CVVT", "66 kW – 1.1 CRDi", "74 kW – 1.4 CRDi"] },
      { label: "Rio IV (2017–dosud)", powers: ["62 kW – 1.2 MPI", "74 kW – 1.0 T-GDi", "88 kW – 1.0 T-GDi", "74 kW – 1.4 MPI", "55 kW – 1.5 CRDi"] },

      // ── Ceed ─────────────────────────────────────────────────────────────────
      { group: "Ceed" },
      { label: "Ceed II JD (2012–2018)", powers: ["74 kW – 1.4 MPI", "88 kW – 1.0 T-GDi", "103 kW – 1.6 GDi", "150 kW – 1.6 T-GDi GT", "66 kW – 1.4 CRDi", "85 kW – 1.6 CRDi", "100 kW – 1.6 CRDi"] },
      { label: "Ceed III CD (2018–dosud)", powers: ["74 kW – 1.0 T-GDi", "88 kW – 1.0 T-GDi", "103 kW – 1.5 T-GDi", "150 kW – 1.6 T-GDi GT", "73 kW – 1.6 CRDi", "85 kW – 1.6 CRDi", "100 kW – 1.6 CRDi"] },

      // ── Stonic ───────────────────────────────────────────────────────────────
      { group: "Stonic" },
      { label: "Stonic (2017–dosud)", powers: ["74 kW – 1.0 T-GDi", "88 kW – 1.0 T-GDi", "74 kW – 1.4 MPI", "55 kW – 1.5 CRDi", "85 kW – 1.6 CRDi"] },

      // ── Sportage ─────────────────────────────────────────────────────────────
      { group: "Sportage" },
      { label: "Sportage III (2010–2015)", powers: ["122 kW – 2.0 GDi", "100 kW – 1.7 CRDi", "135 kW – 2.0 CRDi"] },
      { label: "Sportage IV QL (2015–2021)", powers: ["97 kW – 1.6 GDi", "130 kW – 1.6 T-GDi", "85 kW – 1.6 CRDi", "100 kW – 1.7 CRDi", "136 kW – 2.0 CRDi"] },
      { label: "Sportage V NQ5 (2021–dosud)", powers: ["110 kW – 1.6 T-GDi", "132 kW – 1.6 T-GDi MHEV", "169 kW – 1.6 T-GDi HEV", "195 kW – 1.6 T-GDi PHEV", "85 kW – 1.6 CRDi", "100 kW – 1.6 CRDi MHEV"] },

      // ── Sorento ──────────────────────────────────────────────────────────────
      { group: "Sorento" },
      { label: "Sorento II XM (2009–2014)", powers: ["128 kW – 2.4 GDi", "110 kW – 2.0 CRDi", "145 kW – 2.2 CRDi"] },
      { label: "Sorento III UM (2014–2020)", powers: ["176 kW – 2.0 T-GDi", "136 kW – 2.0 CRDi", "147 kW – 2.2 CRDi"] },
      { label: "Sorento IV MQ4 (2020–dosud)", powers: ["169 kW – 1.6 T-GDi HEV", "195 kW – 1.6 T-GDi PHEV", "147 kW – 2.2 CRDi"] },

      // ── Niro ─────────────────────────────────────────────────────────────────
      { group: "Niro" },
      { label: "Niro I DE (2016–2022)", powers: ["104 kW – 1.6 GDi HEV", "104 kW – 1.6 GDi PHEV", "100 kW – Electric 39 kWh", "150 kW – Electric 64 kWh"] },
      { label: "Niro II SG2 (2022–dosud)", powers: ["104 kW – 1.6 GDi HEV", "135 kW – 1.6 GDi PHEV", "110 kW – Electric 58 kWh", "150 kW – Electric 64 kWh"] },

      // ── EV6 ──────────────────────────────────────────────────────────────────
      { group: "EV6" },
      { label: "EV6 (2021–dosud)", powers: ["125 kW – Standard Range RWD", "168 kW – Long Range RWD", "239 kW – Long Range AWD", "430 kW – GT AWD"] },
    ],
  },

  // ── Hyundai ────────────────────────────────────────────────────────────────

  {
    brand:     "Hyundai",
    active:    true,
    expertise: "Hyundai osobní vozy a SUV všech modelových řad (i10, i20, i30, Tucson, Santa Fe, Kona, IONIQ 5/6) — motory T-GDi, GDi, CRDi, hybridní a elektrické pohony E-GMP od roku 2008, EU spec",
    models: [
      // ── i10 ──────────────────────────────────────────────────────────────────
      { group: "i10" },
      { label: "i10 II BA (2013–2019)", powers: ["49 kW – 1.0 Kappa MPI", "64 kW – 1.2 Kappa MPI"] },
      { label: "i10 III AC3 (2019–dosud)", powers: ["49 kW – 1.0 MPI", "62 kW – 1.2 MPI", "74 kW – 1.0 T-GDi"] },

      // ── i20 ──────────────────────────────────────────────────────────────────
      { group: "i20" },
      { label: "i20 II GB (2014–2020)", powers: ["55 kW – 1.2 MPI", "62 kW – 1.2 MPI", "74 kW – 1.0 T-GDi", "88 kW – 1.0 T-GDi", "74 kW – 1.4 MPI", "55 kW – 1.1 CRDi", "66 kW – 1.4 CRDi"] },
      { label: "i20 III BC3 (2020–dosud)", powers: ["62 kW – 1.2 MPI", "74 kW – 1.0 T-GDi", "88 kW – 1.0 T-GDi MHEV", "150 kW – 1.6 T-GDi N"] },

      // ── i30 ──────────────────────────────────────────────────────────────────
      { group: "i30" },
      { label: "i30 II GD (2012–2017)", powers: ["74 kW – 1.4 MPI", "99 kW – 1.6 GDi", "88 kW – 1.0 T-GDi", "137 kW – 1.6 T-GDi Turbo", "66 kW – 1.4 CRDi", "81 kW – 1.6 CRDi", "100 kW – 1.6 CRDi"] },
      { label: "i30 III PD (2017–dosud)", powers: ["88 kW – 1.0 T-GDi", "103 kW – 1.4 T-GDi", "117 kW – 1.5 T-GDi", "206 kW – 2.0 T-GDi N", "85 kW – 1.6 CRDi", "100 kW – 1.6 CRDi"] },

      // ── Tucson ───────────────────────────────────────────────────────────────
      { group: "Tucson" },
      { label: "Tucson III TL (2015–2020)", powers: ["97 kW – 1.6 GDi", "130 kW – 1.6 T-GDi", "85 kW – 1.6 CRDi", "100 kW – 1.7 CRDi", "136 kW – 2.0 CRDi"] },
      { label: "Tucson IV NX4 (2021–dosud)", powers: ["110 kW – 1.6 T-GDi", "132 kW – 1.6 T-GDi MHEV", "169 kW – 1.6 T-GDi HEV", "195 kW – 1.6 T-GDi PHEV", "85 kW – 1.6 CRDi", "100 kW – 1.6 CRDi MHEV"] },

      // ── Santa Fe ─────────────────────────────────────────────────────────────
      { group: "Santa Fe" },
      { label: "Santa Fe III DM (2012–2018)", powers: ["138 kW – 2.4 GDi", "176 kW – 2.0 T-GDi", "110 kW – 2.0 CRDi", "145 kW – 2.2 CRDi"] },
      { label: "Santa Fe IV TM (2018–dosud)", powers: ["136 kW – 2.4 GDi", "169 kW – 1.6 T-GDi HEV", "195 kW – 1.6 T-GDi PHEV", "110 kW – 2.0 CRDi", "147 kW – 2.2 CRDi"] },

      // ── Kona ─────────────────────────────────────────────────────────────────
      { group: "Kona" },
      { label: "Kona I OS (2017–2023)", powers: ["88 kW – 1.0 T-GDi", "130 kW – 1.6 T-GDi", "104 kW – 1.6 GDi HEV", "85 kW – 1.6 CRDi", "100 kW – Electric 39 kWh", "150 kW – Electric 64 kWh"] },
      { label: "Kona II SX2 (2023–dosud)", powers: ["88 kW – 1.0 T-GDi", "104 kW – 1.6 GDi HEV", "115 kW – Electric 48 kWh", "160 kW – Electric 65 kWh"] },

      // ── IONIQ 5 / IONIQ 6 ────────────────────────────────────────────────────
      { group: "IONIQ" },
      { label: "IONIQ 5 NE (2021–dosud)", powers: ["125 kW – Standard Range RWD", "168 kW – Long Range RWD", "239 kW – Long Range AWD", "448 kW – N AWD"] },
      { label: "IONIQ 6 CE (2022–dosud)", powers: ["111 kW – Standard Range RWD", "168 kW – Long Range RWD", "239 kW – Long Range AWD"] },
    ],
  },

  // ── Mercedes-Benz ──────────────────────────────────────────────────────────

  {
    brand:     "Mercedes-Benz",
    active:    true,
    expertise: "Mercedes-Benz osobní a užitková vozidla (A, B, C, E, GLA, GLB, GLC, Sprinter, Vito) — motory M270/M260/M264/M282/M133/M139 benzín, OM607/OM608/OM651/OM654/OM656 diesel, elektrické pohony od roku 2006, EU spec (BlueTEC, AdBlue, DPF Euro 5/6, SCR)",
    models: [
      // ── A-Class ────────────────────────────────────────────────────────────────
      { group: "A-Class" },
      { label: "A-Class W176 (2012–2018)", powers: ["75 kW – A160 1.6 (M270)", "90 kW – A180 1.6 (M270)", "115 kW – A200 1.6 (M270)", "155 kW – A250 2.0 (M270)", "265 kW – A45 AMG 2.0 (M133)", "280 kW – A45 AMG FL 2.0 (M133)", "80 kW – A160d 1.5 (OM607)", "80 kW – A180d 1.5 (OM607)", "100 kW – A180d 1.5 (OM607)", "100 kW – A200d 2.1 (OM651)", "130 kW – A220d 2.1 (OM651)"] },
      { label: "A-Class W177 (2018–současnost)", powers: ["80 kW – A160 1.3 (M282)", "100 kW – A180 1.3 (M282)", "120 kW – A200 1.3 (M282)", "165 kW – A250 2.0 (M260)", "225 kW – A35 AMG 2.0 (M260)", "306 kW – A45 S AMG 2.0 (M139)", "85 kW – A180d 1.5 (OM608)", "110 kW – A200d 2.0 (OM654)", "140 kW – A220d 2.0 (OM654)"] },

      // ── B-Class ────────────────────────────────────────────────────────────────
      { group: "B-Class" },
      { label: "B-Class W246 (2011–2018)", powers: ["75 kW – B160 1.6 (M270)", "90 kW – B180 1.6 (M270)", "115 kW – B200 1.6 (M270)", "155 kW – B250 2.0 (M270)", "80 kW – B160d 1.5 (OM607)", "80 kW – B180d 1.5 (OM607)", "100 kW – B180d 1.5 (OM607)", "100 kW – B200d 2.1 (OM651)", "130 kW – B220d 2.1 (OM651)"] },
      { label: "B-Class W247 (2018–současnost)", powers: ["80 kW – B160 1.3 (M282)", "100 kW – B180 1.3 (M282)", "120 kW – B200 1.3 (M282)", "165 kW – B250 2.0 (M260)", "85 kW – B180d 1.5 (OM608)", "110 kW – B200d 2.0 (OM654)", "140 kW – B220d 2.0 (OM654)"] },

      // ── C-Class ────────────────────────────────────────────────────────────────
      { group: "C-Class" },
      { label: "C-Class W204 (2007–2014)", powers: ["115 kW – C180 1.8 K (M271)", "135 kW – C200 1.8 K (M271)", "125 kW – C200 CGI 1.8 (M271)", "150 kW – C250 CGI 1.8 (M271)", "170 kW – C300 3.0 (M272)", "170 kW – C350 3.5 (M272)", "336 kW – C63 AMG 6.2 (M156)", "350 kW – C63 AMG FL 6.2 (M156)", "100 kW – C200 CDI 2.1 (OM651)", "125 kW – C220 CDI 2.1 (OM651)", "150 kW – C250 CDI 2.1 (OM651)", "150 kW – C250 BlueTEC 2.1 (OM651)", "170 kW – C300 CDI 3.0 (OM642)"] },
      { label: "C-Class W205 (2014–2021)", powers: ["115 kW – C180 1.6 (M274)", "135 kW – C200 2.0 (M274)", "155 kW – C250 2.0 (M274)", "180 kW – C300 2.0 (M274)", "270 kW – C43 AMG 3.0 V6 (M276)", "350 kW – C63 AMG 4.0 V8 (M177)", "375 kW – C63 S AMG 4.0 V8 (M177)", "90 kW – C160d 1.6 (OM626)", "100 kW – C180d 1.6 (OM626)", "125 kW – C220d 2.0 (OM654)", "143 kW – C220d FL 2.0 (OM654)", "140 kW – C250d 2.1 (OM651)", "173 kW – C300d 2.0 (OM654)", "190 kW – C300de 2.0 PHEV (OM654)"] },
      { label: "C-Class W206 (2021–současnost)", powers: ["125 kW – C180 1.5 (M254)", "150 kW – C200 1.5 (M254)", "190 kW – C300 2.0 (M254)", "280 kW – C43 AMG 2.0 (M139)", "350 kW – C63 S AMG 2.0 PHEV (M139)", "125 kW – C200d 2.0 (OM654M)", "147 kW – C220d 2.0 (OM654M)", "195 kW – C300d 2.0 (OM654M)", "230 kW – C300de 2.0 PHEV (OM654M)"] },

      // ── E-Class ────────────────────────────────────────────────────────────────
      { group: "E-Class" },
      { label: "E-Class W212 (2009–2016)", powers: ["135 kW – E200 1.8 CGI (M271)", "150 kW – E250 1.8 CGI (M271)", "155 kW – E250 2.0 (M274)", "185 kW – E300 3.5 (M276)", "225 kW – E400 3.0 V6 (M276)", "300 kW – E500 4.7 V8 (M278)", "386 kW – E63 AMG 5.5 V8 (M157)", "100 kW – E200 CDI 2.1 (OM651)", "125 kW – E220 CDI 2.1 (OM651)", "150 kW – E250 CDI 2.1 (OM651)", "150 kW – E250 BlueTEC 2.1 (OM651)", "170 kW – E300 BlueTEC 3.0 (OM642)", "190 kW – E350 BlueTEC 3.0 (OM642)"] },
      { label: "E-Class W213 (2016–současnost)", powers: ["135 kW – E200 2.0 (M264)", "145 kW – E200 2.0 FL (M254)", "190 kW – E300 2.0 (M264)", "270 kW – E43 AMG 3.0 V6 (M276)", "310 kW – E53 AMG 3.0 I6 (M256)", "420 kW – E63 S AMG 4.0 V8 (M177)", "120 kW – E200d 2.0 (OM654)", "143 kW – E220d 2.0 (OM654)", "195 kW – E300d 2.0 (OM654)", "210 kW – E350d 3.0 (OM656)", "243 kW – E400d 3.0 (OM656)", "225 kW – E300de 2.0 PHEV (OM654)", "240 kW – E300e 2.0 PHEV (M254)"] },

      // ── GLA ────────────────────────────────────────────────────────────────────
      { group: "GLA" },
      { label: "GLA H247 (2020–současnost)", powers: ["100 kW – GLA 180 1.3 (M282)", "120 kW – GLA 200 1.3 (M282)", "165 kW – GLA 250 2.0 (M260)", "225 kW – GLA 35 AMG 2.0 (M260)", "306 kW – GLA 45 S AMG 2.0 (M139)", "85 kW – GLA 180d 1.5 (OM608)", "110 kW – GLA 200d 2.0 (OM654)", "140 kW – GLA 220d 2.0 (OM654)"] },

      // ── GLB ────────────────────────────────────────────────────────────────────
      { group: "GLB" },
      { label: "GLB X247 (2019–současnost)", powers: ["100 kW – GLB 180 1.3 (M282)", "120 kW – GLB 200 1.3 (M282)", "165 kW – GLB 250 2.0 (M260)", "225 kW – GLB 35 AMG 2.0 (M260)", "85 kW – GLB 180d 1.5 (OM608)", "110 kW – GLB 200d 2.0 (OM654)", "140 kW – GLB 220d 2.0 (OM654)"] },

      // ── GLC ────────────────────────────────────────────────────────────────────
      { group: "GLC" },
      { label: "GLC X253 (2015–2022)", powers: ["135 kW – GLC 200 2.0 (M274)", "155 kW – GLC 250 2.0 (M274)", "180 kW – GLC 300 2.0 (M274)", "270 kW – GLC 43 AMG 3.0 V6 (M276)", "375 kW – GLC 63 S AMG 4.0 V8 (M177)", "125 kW – GLC 220d 2.1 (OM651)", "150 kW – GLC 250d 2.1 (OM651)", "173 kW – GLC 300d 2.0 (OM654)", "143 kW – GLC 220d FL 2.0 (OM654)"] },
      { label: "GLC X254 (2022–současnost)", powers: ["150 kW – GLC 200 2.0 (M254)", "190 kW – GLC 300 2.0 (M254)", "280 kW – GLC 43 AMG 2.0 (M139)", "350 kW – GLC 63 S AMG 2.0 PHEV (M139)", "147 kW – GLC 220d 2.0 (OM654M)", "195 kW – GLC 300d 2.0 (OM654M)", "245 kW – GLC 300de 2.0 PHEV (OM654M)", "230 kW – GLC 300e 2.0 PHEV (M254)"] },

      // ── Sprinter ───────────────────────────────────────────────────────────────
      { group: "Sprinter" },
      { label: "Sprinter W906 2.1 CDI (2006–2018)", powers: ["65 kW – 209/211 CDI (OM646)", "80 kW – 213 CDI (OM646)", "95 kW – 214/216 CDI (OM651)", "105 kW – 216 CDI (OM651)", "120 kW – 219/316 CDI (OM651)", "140 kW – 319/519 CDI (OM642)", "65 kW – 210/211 CDI (OM651)", "84 kW – 214 CDI (OM651)", "105 kW – 311/314 CDI (OM651)", "120 kW – 316 CDI (OM651)"] },
      { label: "Sprinter W906 3.0 CDI V6 (2006–2018)", powers: ["135 kW – 318/418 CDI (OM642)", "140 kW – 319/519 CDI (OM642)", "142 kW – 324 (M272)"] },
      { label: "Sprinter W907/W910 2.1 CDI (2018–současnost)", powers: ["84 kW – 211/311/411/511 CDI (OM651)", "105 kW – 214/314/414/514 CDI (OM651)", "120 kW – 216/316/416/516 CDI (OM651)", "140 kW – 219/319/419/519 CDI (OM651)"] },
      { label: "eSprinter Electric (2023–současnost)", powers: ["85 kW – eSprinter Electric", "100 kW – eSprinter Electric"] },

      // ── Vito ────────────────────────────────────────────────────────────────────
      { group: "Vito" },
      { label: "Vito W447 (2014–současnost)", powers: ["65 kW – 109 CDI 1.6 (OM622)", "75 kW – 111 CDI 1.6 (OM622)", "100 kW – 114 CDI 2.1 (OM651)", "120 kW – 116 CDI 2.1 (OM651)", "140 kW – 119 CDI 2.1 (OM651)", "100 kW – 114 CDI 2.0 FL (OM654)", "120 kW – 116 CDI 2.0 FL (OM654)", "143 kW – 119 CDI 2.0 FL (OM654)", "150 kW – 124 CDI 2.0 FL (OM654)", "100 kW – eVito Electric"] },
    ],
  },

  {
    brand:     "Citroën",
    active:    true,
    expertise: "Citroën osobní a užitková vozidla všech modelových řad (C1, C3, C3 Aircross, C4, C4 Cactus, C5 Aircross, Berlingo, Jumpy, Jumper) — motory PureTech, VTi, THP, HDi, BlueHDi a elektrické pohony od roku 2005 do současnosti, EU spec (AdBlue, DPF Euro 5/6, SCR)",
    models: [
      // ── C1 ─────────────────────────────────────────────────────────────────────
      { group: "C1" },
      { label: "C1 I (2005–2014)", powers: ["50 kW – 1.0 VVT-i", "51 kW – 1.4 HDi"] },
      { label: "C1 II (2014–2022)", powers: ["51 kW – 1.0 VTi", "53 kW – 1.0 VTi", "60 kW – 1.2 PureTech"] },

      // ── C3 ─────────────────────────────────────────────────────────────────────
      { group: "C3" },
      { label: "C3 II (2009–2016)", powers: ["54 kW – 1.0 VTi", "60 kW – 1.2 VTi", "70 kW – 1.4 VTi", "88 kW – 1.6 VTi", "68 kW – 1.4 HDi", "50 kW – 1.4 HDi", "66 kW – 1.6 HDi", "82 kW – 1.6 HDi", "55 kW – 1.4 e-HDi"] },
      { label: "C3 III (2016–současnost)", powers: ["60 kW – 1.2 PureTech", "68 kW – 1.2 PureTech", "81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "55 kW – 1.5 BlueHDi", "75 kW – 1.5 BlueHDi", "100 kW – ë-C3 Electric"] },

      // ── C3 Aircross ────────────────────────────────────────────────────────────
      { group: "C3 Aircross" },
      { label: "C3 Aircross (2017–současnost)", powers: ["60 kW – 1.2 PureTech", "81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "55 kW – 1.5 BlueHDi", "75 kW – 1.5 BlueHDi", "96 kW – 1.5 BlueHDi"] },

      // ── C4 ─────────────────────────────────────────────────────────────────────
      { group: "C4" },
      { label: "C4 II (2010–2018)", powers: ["70 kW – 1.4 VTi", "88 kW – 1.6 VTi", "110 kW – 1.6 THP", "115 kW – 1.6 THP", "68 kW – 1.6 HDi", "82 kW – 1.6 HDi", "84 kW – 1.6 BlueHDi", "73 kW – 1.6 e-HDi", "100 kW – 2.0 HDi", "110 kW – 2.0 BlueHDi"] },
      { label: "C4 III / ë-C4 (2020–současnost)", powers: ["75 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "114 kW – 1.2 PureTech", "96 kW – 1.5 BlueHDi", "100 kW – ë-C4 Electric", "115 kW – ë-C4 Electric"] },

      // ── C4 Cactus ──────────────────────────────────────────────────────────────
      { group: "C4 Cactus" },
      { label: "C4 Cactus (2014–2020)", powers: ["55 kW – 1.2 PureTech", "60 kW – 1.2 PureTech", "68 kW – 1.2 PureTech", "81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "73 kW – 1.5 BlueHDi", "68 kW – 1.6 BlueHDi", "75 kW – 1.6 BlueHDi"] },

      // ── C5 Aircross ────────────────────────────────────────────────────────────
      { group: "C5 Aircross" },
      { label: "C5 Aircross (2018–současnost)", powers: ["96 kW – 1.2 PureTech", "114 kW – 1.2 PureTech", "132 kW – 1.6 PureTech", "165 kW – 1.6 PHEV Hybrid", "225 kW – 1.6 PHEV Hybrid4", "96 kW – 1.5 BlueHDi", "118 kW – 2.0 BlueHDi", "130 kW – 2.0 BlueHDi"] },

      // ── Berlingo ───────────────────────────────────────────────────────────────
      { group: "Berlingo" },
      { label: "Berlingo III (2018–současnost)", powers: ["81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "55 kW – 1.5 BlueHDi", "75 kW – 1.5 BlueHDi", "96 kW – 1.5 BlueHDi", "100 kW – ë-Berlingo Electric"] },

      // ── Jumpy (Dispatch) ───────────────────────────────────────────────────────
      { group: "Jumpy" },
      { label: "Jumpy III (2016–současnost)", powers: ["75 kW – 1.5 BlueHDi", "88 kW – 1.5 BlueHDi", "110 kW – 2.0 BlueHDi", "130 kW – 2.0 BlueHDi", "100 kW – ë-Jumpy Electric"] },

      // ── Jumper (Relay) ─────────────────────────────────────────────────────────
      { group: "Jumper" },
      { label: "Jumper III 2.2 HDi (2006–2016)", powers: ["74 kW – 2.2 HDi", "88 kW – 2.2 HDi", "96 kW – 2.2 HDi", "110 kW – 2.2 HDi", "120 kW – 3.0 HDi"] },
      { label: "Jumper III 2.0/2.2 BlueHDi (2016–současnost)", powers: ["81 kW – 2.0 BlueHDi", "88 kW – 2.2 BlueHDi", "103 kW – 2.2 BlueHDi", "121 kW – 2.2 BlueHDi", "100 kW – ë-Jumper Electric"] },
    ],
  },

  {
    brand:     "Nissan",
    active:    true,
    expertise: "Nissan osobní a užitková vozidla všech modelových řad (Micra, Note, Juke, Qashqai, X-Trail, Leaf, NV200, NV300) — motory HR/MR/K9K/R9M benzín a diesel, e-POWER, elektrické pohony od roku 2006 do současnosti, EU spec (DPF, AdBlue Euro 5/6)",
    models: [
      // ── Micra ──────────────────────────────────────────────────────────────────
      { group: "Micra" },
      { label: "Micra K13 (2010–2017)", powers: ["54 kW – 1.2 HR12DE", "72 kW – 1.2 DIG-S HR12DDR", "48 kW – 1.5 dCi K9K"] },
      { label: "Micra K14 (2017–současnost)", powers: ["52 kW – 0.9 IG-T H4Bt", "71 kW – 0.9 IG-T H4Bt", "73 kW – 1.0 IG-T HR10DET", "86 kW – 1.0 IG-T HR10DET", "55 kW – 1.5 dCi K9K"] },

      // ── Note ───────────────────────────────────────────────────────────────────
      { group: "Note" },
      { label: "Note E12 (2013–2020)", powers: ["54 kW – 1.2 HR12DE", "72 kW – 1.2 DIG-S HR12DDR", "66 kW – 1.5 dCi K9K"] },

      // ── Juke ───────────────────────────────────────────────────────────────────
      { group: "Juke" },
      { label: "Juke F15 (2010–2019)", powers: ["86 kW – 1.6 HR16DE", "140 kW – 1.6 DIG-T MR16DDT", "157 kW – 1.6 DIG-T Nismo RS", "81 kW – 1.5 dCi K9K"] },
      { label: "Juke F16 (2019–současnost)", powers: ["84 kW – 1.0 DIG-T HR10DDT", "86 kW – 1.0 DIG-T HR10DDT", "103 kW – 1.0 DIG-T HR10DDT", "105 kW – 1.6 e-POWER Hybrid"] },

      // ── Qashqai ────────────────────────────────────────────────────────────────
      { group: "Qashqai" },
      { label: "Qashqai J10 (2007–2013)", powers: ["86 kW – 1.6 HR16DE", "104 kW – 2.0 MR20DE", "78 kW – 1.5 dCi K9K", "81 kW – 1.5 dCi K9K", "96 kW – 1.6 dCi R9M", "110 kW – 2.0 dCi M9R"] },
      { label: "Qashqai J11 (2014–2021)", powers: ["85 kW – 1.2 DIG-T HRA2", "120 kW – 1.6 DIG-T MR16DDT", "163 kW – 1.6 DIG-T Nismo RS", "81 kW – 1.5 dCi K9K", "85 kW – 1.5 dCi K9K", "96 kW – 1.6 dCi R9M"] },
      { label: "Qashqai J12 (2021–současnost)", powers: ["103 kW – 1.3 DIG-T HR13DDT", "116 kW – 1.3 DIG-T HR13DDT", "140 kW – 1.5 e-POWER Hybrid"] },

      // ── X-Trail ────────────────────────────────────────────────────────────────
      { group: "X-Trail" },
      { label: "X-Trail T31 (2007–2013)", powers: ["104 kW – 2.0 MR20DE", "124 kW – 2.5 QR25DE", "110 kW – 2.0 dCi M9R", "127 kW – 2.0 dCi M9R"] },
      { label: "X-Trail T32 (2014–2021)", powers: ["120 kW – 1.6 DIG-T MR16DDT", "126 kW – 2.0 MR20DD", "96 kW – 1.6 dCi R9M", "130 kW – 2.0 dCi M9R"] },
      { label: "X-Trail T33 (2022–současnost)", powers: ["110 kW – 1.5 VC-Turbo KR15DDT", "150 kW – 1.5 VC-Turbo e-POWER", "157 kW – 1.5 VC-Turbo e-POWER e-4ORCE"] },

      // ── Leaf ───────────────────────────────────────────────────────────────────
      { group: "Leaf" },
      { label: "Leaf ZE0 (2010–2017)", powers: ["80 kW – EM57 Electric 24 kWh", "80 kW – EM57 Electric 30 kWh"] },
      { label: "Leaf ZE1 (2017–současnost)", powers: ["110 kW – EM57 Electric 40 kWh", "160 kW – EM57 Electric 62 kWh e+"] },

      // ── NV200 ──────────────────────────────────────────────────────────────────
      { group: "NV200" },
      { label: "NV200 (2009–2021)", powers: ["81 kW – 1.6 HR16DE", "66 kW – 1.5 dCi K9K", "80 kW – e-NV200 Electric"] },

      // ── NV300 ──────────────────────────────────────────────────────────────────
      { group: "NV300" },
      { label: "NV300 (2016–současnost)", powers: ["70 kW – 1.6 dCi R9M", "85 kW – 1.6 dCi R9M", "88 kW – 1.6 dCi R9M", "103 kW – 1.6 dCi R9M", "107 kW – 2.0 dCi M9R", "110 kW – 2.0 dCi M9R", "125 kW – 2.0 dCi M9R"] },
    ],
  },

  {
    brand:     "Fiat",
    active:    true,
    expertise: "Fiat osobní a užitková vozidla všech modelových řad (500, 500X, 500L, Panda, Punto, Tipo, Ducato, Doblò, Fiorino) — motory FIRE, TwinAir, MultiAir, MultiJet a elektrické pohony od roku 2005 do současnosti, EU spec (DPF, AdBlue Euro 5/6, SCR)",
    models: [
      // ── 500 ────────────────────────────────────────────────────────────────────
      { group: "500" },
      { label: "500 (2007–2020)", powers: ["51 kW – 1.2 FIRE", "63 kW – 1.4 FIRE", "77 kW – 1.4 FIRE Sport", "99 kW – 0.9 TwinAir Abarth", "132 kW – 1.4 T-Jet Abarth", "135 kW – 1.4 T-Jet 595", "63 kW – 0.9 TwinAir 65", "77 kW – 0.9 TwinAir 85", "55 kW – 1.3 MultiJet", "70 kW – 1.3 MultiJet"] },
      { label: "500e Electric (2020–současnost)", powers: ["70 kW – Electric 23.8 kWh", "87 kW – Electric 42 kWh"] },
      { label: "500 Hybrid (2020–současnost)", powers: ["51 kW – 1.0 Hybrid FireFly"] },

      // ── 500X ───────────────────────────────────────────────────────────────────
      { group: "500X" },
      { label: "500X (2014–současnost)", powers: ["88 kW – 1.0 FireFly T3", "96 kW – 1.3 FireFly T4", "110 kW – 1.3 FireFly T4", "125 kW – 1.3 FireFly T4 PHEV", "132 kW – 1.4 MultiAir", "125 kW – 1.4 MultiAir", "70 kW – 1.3 MultiJet", "88 kW – 1.6 MultiJet", "103 kW – 2.0 MultiJet"] },

      // ── 500L ───────────────────────────────────────────────────────────────────
      { group: "500L" },
      { label: "500L (2012–2022)", powers: ["70 kW – 0.9 TwinAir", "77 kW – 0.9 TwinAir", "88 kW – 1.4 T-Jet", "70 kW – 1.4 FIRE", "62 kW – 1.3 MultiJet", "70 kW – 1.3 MultiJet", "77 kW – 1.6 MultiJet", "88 kW – 1.6 MultiJet"] },

      // ── Panda ──────────────────────────────────────────────────────────────────
      { group: "Panda" },
      { label: "Panda II 169 (2003–2012)", powers: ["40 kW – 1.1 FIRE", "44 kW – 1.2 FIRE", "74 kW – 1.4 FIRE 100HP", "51 kW – 1.3 MultiJet", "55 kW – 1.3 MultiJet"] },
      { label: "Panda III 319 (2012–současnost)", powers: ["51 kW – 0.9 TwinAir", "63 kW – 0.9 TwinAir", "51 kW – 1.0 Hybrid FireFly", "44 kW – 1.2 FIRE", "51 kW – 1.2 FIRE", "55 kW – 1.3 MultiJet", "70 kW – 1.3 MultiJet"] },

      // ── Punto ──────────────────────────────────────────────────────────────────
      { group: "Punto" },
      { label: "Grande Punto (2005–2012)", powers: ["48 kW – 1.2 FIRE", "57 kW – 1.4 FIRE", "70 kW – 1.4 FIRE", "96 kW – 1.4 MultiAir", "132 kW – 1.4 T-Jet Abarth", "55 kW – 1.3 MultiJet", "66 kW – 1.3 MultiJet", "88 kW – 1.6 MultiJet", "96 kW – 1.9 MultiJet"] },
      { label: "Punto Evo / Punto (2009–2018)", powers: ["48 kW – 1.2 FIRE", "57 kW – 1.4 FIRE", "77 kW – 1.4 MultiAir", "99 kW – 1.4 MultiAir", "132 kW – 1.4 T-Jet Abarth", "55 kW – 1.3 MultiJet", "63 kW – 1.3 MultiJet", "70 kW – 1.3 MultiJet", "77 kW – 1.6 MultiJet", "88 kW – 1.6 MultiJet"] },

      // ── Tipo ───────────────────────────────────────────────────────────────────
      { group: "Tipo" },
      { label: "Tipo (2015–současnost)", powers: ["70 kW – 1.0 FireFly T3", "74 kW – 1.4 FIRE", "88 kW – 1.4 T-Jet", "96 kW – 1.4 T-Jet", "110 kW – 1.5 FireFly Hybrid", "70 kW – 1.3 MultiJet", "88 kW – 1.6 MultiJet", "96 kW – 1.6 MultiJet"] },

      // ── Ducato ─────────────────────────────────────────────────────────────────
      { group: "Ducato" },
      { label: "Ducato III 2.0/2.2 MultiJet (2006–2014)", powers: ["74 kW – 2.2 MultiJet", "88 kW – 2.2 MultiJet", "96 kW – 2.2 MultiJet", "100 kW – 2.3 MultiJet", "107 kW – 2.3 MultiJet", "109 kW – 2.3 MultiJet", "130 kW – 3.0 MultiJet", "115 kW – 3.0 MultiJet"] },
      { label: "Ducato III FL 2.0/2.2/2.3 MultiJet (2014–současnost)", powers: ["85 kW – 2.0 MultiJet", "96 kW – 2.2 MultiJet", "103 kW – 2.2 MultiJet", "121 kW – 2.2 MultiJet", "88 kW – 2.3 MultiJet", "96 kW – 2.3 MultiJet", "109 kW – 2.3 MultiJet", "130 kW – 2.3 MultiJet", "132 kW – 2.3 MultiJet", "90 kW – e-Ducato Electric"] },

      // ── Doblò ──────────────────────────────────────────────────────────────────
      { group: "Doblò" },
      { label: "Doblò II (2010–2022)", powers: ["70 kW – 1.4 FIRE", "88 kW – 1.4 T-Jet", "66 kW – 1.3 MultiJet", "70 kW – 1.3 MultiJet", "77 kW – 1.6 MultiJet", "88 kW – 1.6 MultiJet", "99 kW – 2.0 MultiJet"] },

      // ── Fiorino ────────────────────────────────────────────────────────────────
      { group: "Fiorino" },
      { label: "Fiorino III (2007–současnost)", powers: ["54 kW – 1.4 FIRE", "40 kW – 1.3 MultiJet", "55 kW – 1.3 MultiJet", "59 kW – 1.3 MultiJet", "70 kW – 1.3 MultiJet"] },
    ],
  },
]

// ── Odvozené konstanty ────────────────────────────────────────────────────────

/** Vyhledá záznam katalogu podle značky (case-insensitive) */
export function getBrandEntry(brand) {
  if (!brand) return null
  return VEHICLE_CATALOG.find(b => b.brand.toLowerCase() === brand.toLowerCase()) ?? null
}

/** Pouze aktivní značky — zobrazují se v GUI */
export const ACTIVE_BRANDS = VEHICLE_CATALOG.filter(b => b.active)

/**
 * Flat seznam modelů aktivních značek pro <select> v GUI.
 * Pokud je aktivních značek více, přidá nadpis značky jako group separator.
 */
export const VEHICLE_MODELS = ACTIVE_BRANDS.length === 1
  ? ACTIVE_BRANDS[0].models
  : ACTIVE_BRANDS.flatMap(b => [{ group: b.brand }, ...b.models])

/** Výchozí značka pro nový případ */
export const DEFAULT_BRAND  = ACTIVE_BRANDS[0]?.brand ?? ""

/** Prázdné vozidlo pro nový případ */
export const EMPTY_VEHICLE  = { brand: DEFAULT_BRAND, model: "", mileage: "", enginePower: "" }

/** Vrátí pole modelů pro danou značku (pro dynamický model select) */
export function getBrandModels(brand) {
  if (!brand) return []
  const entry = getBrandEntry(brand)
  return entry?.models ?? []
}

/** Vrátí pole dostupných výkonů pro daný model (label) */
export function getModelPowers(modelLabel) {
  if (!modelLabel) return []
  for (const brand of VEHICLE_CATALOG) {
    const entry = brand.models.find(m => m.label === modelLabel)
    if (entry?.powers) return entry.powers
  }
  return []
}

// ── Příznaky podle kategorie (klíče do i18n) ─────────────────────────────────
// V DB se ukládají klíče (sym.*), v GUI se překládají přes tr().
export const SYMPTOM_CATEGORIES = [
  { catKey: "sym.cat.engine", symptoms: ["sym.lossOfPower", "sym.blackSmoke", "sym.whiteSmoke", "sym.excessFuel", "sym.roughIdle", "sym.stalling", "sym.hardStart", "sym.noStart", "sym.limpMode", "sym.overheating", "sym.oilConsumption"] },
  { catKey: "sym.cat.transmission", symptoms: ["sym.shiftVibration", "sym.hardShifting", "sym.clutchSlip", "sym.shiftJerks", "sym.gearboxNoise", "sym.accelDropout"] },
  { catKey: "sym.cat.brakes", symptoms: ["sym.absLight", "sym.brakePulse", "sym.brakePull", "sym.chassisNoise", "sym.steeringVibration", "sym.unevenTyreWear"] },
  { catKey: "sym.cat.steering", symptoms: ["sym.heavySteering", "sym.steeringPlay", "sym.steeringClick", "sym.pullingSide", "sym.steeringLight"] },
  { catKey: "sym.cat.electrical", symptoms: ["sym.milLight", "sym.electricalDropout", "sym.alternatorIssue", "sym.batteryDrain", "sym.centralLockIssue", "sym.dashErrors"] },
  { catKey: "sym.cat.exhaust", symptoms: ["sym.dpfLight", "sym.adblueWarning", "sym.exhaustSmell", "sym.accelSmoke", "sym.dpfRegenFail"] },
]

// ── Časté OBD kódy ────────────────────────────────────────────────────────────
export const COMMON_OBD_CODES = [
  "P0087", "P0093", "P0191", "P0401", "P0402", "P0403",
  "P0489", "P0490", "P1000", "P2002", "P2003", "P2263",
  "P2599", "P242F", "P246C", "U0001",
]
