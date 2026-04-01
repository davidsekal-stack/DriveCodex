// ── Katalog vozidel ───────────────────────────────────────────────────────────
//
// Centrální datová struktura pro všechny podporované značky.
//
// active: true  → zobrazuje se v GUI (výběr modelu, system prompt...)
// active: false → data připravena v katalogu, GUI je zatím nezobrazuje
//
// expertise → odborný kontext vložený do AI system promptu pro tuto značku

import { VEHICLE_CATALOG_US } from "./catalog-us.js"

export const VEHICLE_CATALOG = [
  {
    brand:     "Ford",
    active:    true,
    expertise: "Ford osobní a užitková vozidla hlavních evropských i užitkových modelových řad (Fiesta, Focus, Escort, Mondeo, Kuga, Puma, EcoSport, Mustang, Galaxy, S-MAX, Ka, Transit, Tourneo, Ranger) — motory Zetec, Endura, Duratec, EcoBoost, TDDi, TDCi, EcoBlue a elektrické pohony od roku 1995 do současnosti, EU spec (AdBlue, DPF Euro 5/6, SCR systémy)",
    models: [
      // ── Fiesta ──────────────────────────────────────────────────────────────
      { group: "Fiesta" },
      { label: "Fiesta MK4 / MK5 (1995–2002)" },
      { label: "Fiesta MK6 (2006–2008)", powers: ["44 kW – 1.25 Duratec", "55 kW – 1.4 Duratec", "74 kW – 1.6 Duratec", "50 kW – 1.4 TDCi", "66 kW – 1.6 TDCi"] },
      { label: "Fiesta MK7 (2008–2017)", powers: ["44 kW – 1.25", "60 kW – 1.25", "60 kW – 1.4", "74 kW – 1.0 EcoBoost", "92 kW – 1.0 EcoBoost", "100 kW – 1.0 EcoBoost", "134 kW – 1.6 EcoBoost ST", "55 kW – 1.4 TDCi", "51 kW – 1.5 TDCi", "55 kW – 1.5 TDCi", "70 kW – 1.6 TDCi"] },
      { label: "Fiesta MK8 (2017–2023)", powers: ["52 kW – 1.1 Ti-VCT", "63 kW – 1.1 Ti-VCT", "70 kW – 1.0 EcoBoost", "74 kW – 1.0 EcoBoost", "92 kW – 1.0 EcoBoost", "100 kW – 1.0 EcoBoost mHEV", "147 kW – 1.5 EcoBoost ST", "55 kW – 1.5 TDCi", "63 kW – 1.5 EcoBlue"] },

      // ── Focus ───────────────────────────────────────────────────────────────
      { group: "Focus" },
      { label: "Focus MK1 (1998–2005)" },
      { label: "Focus MK2 (2006–2010)", powers: ["59 kW – 1.4 Duratec", "74 kW – 1.6 Duratec", "92 kW – 1.6 Ti-VCT", "107 kW – 2.0 Duratec", "166 kW – 2.5T ST", "66 kW – 1.6 TDCi", "80 kW – 1.8 TDCi", "100 kW – 2.0 TDCi"] },
      { label: "Focus MK2 FL (2008–2011)", powers: ["59 kW – 1.4", "74 kW – 1.6 Ti-VCT", "92 kW – 1.6 Ti-VCT", "107 kW – 2.0 Duratec", "166 kW – 2.5T ST", "224 kW – 2.5T RS", "66 kW – 1.6 TDCi", "80 kW – 1.8 TDCi", "100 kW – 2.0 TDCi"] },
      { label: "Focus MK3 (2011–2018)", powers: ["63 kW – 1.0 EcoBoost", "74 kW – 1.0 EcoBoost", "92 kW – 1.0 EcoBoost", "110 kW – 1.5 EcoBoost", "134 kW – 1.5 EcoBoost", "184 kW – 2.0 EcoBoost ST", "257 kW – 2.3 EcoBoost RS", "70 kW – 1.5 TDCi", "77 kW – 1.5 TDCi", "88 kW – 1.5 TDCi", "110 kW – 2.0 TDCi", "120 kW – 2.0 TDCi"] },
      { label: "Focus MK4 (2018–)", powers: ["63 kW – 1.0 EcoBoost", "74 kW – 1.0 EcoBoost", "92 kW – 1.0 EcoBoost", "92 kW – 1.0 EcoBoost mHEV", "110 kW – 1.5 EcoBoost", "134 kW – 1.5 EcoBoost", "206 kW – 2.3 EcoBoost ST", "70 kW – 1.5 EcoBlue", "88 kW – 1.5 EcoBlue", "110 kW – 2.0 EcoBlue"] },

      // ── Escort ──────────────────────────────────────────────────────────────
      { group: "Escort" },
      { label: "Escort MkVII / Classic (1995–2000)" },

      // ── Mondeo ──────────────────────────────────────────────────────────────
      { group: "Mondeo" },
      { label: "Mondeo II (1996–2000)" },
      { label: "Mondeo MK III (2000–2007)" },
      { label: "Mondeo MK4 (2007–2014)", powers: ["92 kW – 1.6 Ti-VCT", "107 kW – 2.0 Duratec", "149 kW – 2.5 Duratec", "162 kW – 2.0 EcoBoost", "176 kW – 2.0 EcoBoost", "74 kW – 1.6 TDCi", "85 kW – 1.8 TDCi", "96 kW – 2.0 TDCi", "103 kW – 2.0 TDCi", "120 kW – 2.0 TDCi", "130 kW – 2.2 TDCi"] },
      { label: "Mondeo MK5 (2014–2022)", powers: ["118 kW – 1.5 EcoBoost", "140 kW – 1.5 EcoBoost", "176 kW – 2.0 EcoBoost", "138 kW – 2.0 EcoBoost HEV", "88 kW – 1.5 TDCi", "88 kW – 1.5 EcoBlue", "110 kW – 2.0 TDCi", "132 kW – 2.0 TDCi", "110 kW – 2.0 EcoBlue", "140 kW – 2.0 EcoBlue"] },

      // ── Kuga ────────────────────────────────────────────────────────────────
      { group: "Kuga" },
      { label: "Kuga I (2008–2012)", powers: ["147 kW – 2.5 Duratec Turbo", "100 kW – 2.0 TDCi", "120 kW – 2.0 TDCi"] },
      { label: "Kuga II (2013–2019)", powers: ["88 kW – 1.5 EcoBoost", "110 kW – 1.5 EcoBoost", "134 kW – 1.5 EcoBoost", "176 kW – 2.0 EcoBoost", "85 kW – 1.5 TDCi", "88 kW – 1.5 TDCi", "110 kW – 2.0 TDCi", "132 kW – 2.0 TDCi"] },
      { label: "Kuga III (2020–)", powers: ["88 kW – 1.5 EcoBoost", "110 kW – 1.5 EcoBoost", "140 kW – 1.5 EcoBoost mHEV", "165 kW – 2.5 Duratec FHEV", "165 kW – 2.5 Duratec PHEV", "88 kW – 1.5 EcoBlue", "110 kW – 2.0 EcoBlue", "140 kW – 2.0 EcoBlue"] },

      // ── Puma ────────────────────────────────────────────────────────────────
      { group: "Puma" },
      { label: "Puma (2019–)", powers: ["74 kW – 1.0 EcoBoost", "92 kW – 1.0 EcoBoost mHEV", "92 kW – 1.0 EcoBoost", "114 kW – 1.0 EcoBoost mHEV", "147 kW – 1.5 EcoBoost ST", "88 kW – 1.5 EcoBlue"] },

      // ── EcoSport ────────────────────────────────────────────────────────────
      { group: "EcoSport" },
      { label: "EcoSport (2014–2022)", powers: ["74 kW – 1.0 EcoBoost", "92 kW – 1.0 EcoBoost", "103 kW – 1.5 Ti-VCT", "74 kW – 1.5 TDCi", "92 kW – 1.5 EcoBlue"] },

      // ── Galaxy / S-MAX ──────────────────────────────────────────────────────
      { group: "Galaxy / S-MAX" },
      { label: "Galaxy MK3 (2006–2015)", powers: ["92 kW – 1.6 Ti-VCT", "118 kW – 2.0 EcoBoost", "147 kW – 2.0 EcoBoost", "85 kW – 1.8 TDCi", "96 kW – 2.0 TDCi", "103 kW – 2.0 TDCi", "120 kW – 2.0 TDCi", "130 kW – 2.2 TDCi"] },
      { label: "Galaxy MK4 (2015–2023)", powers: ["118 kW – 1.5 EcoBoost", "176 kW – 2.0 EcoBoost", "88 kW – 1.5 TDCi", "88 kW – 1.5 EcoBlue", "110 kW – 2.0 TDCi", "132 kW – 2.0 TDCi", "110 kW – 2.0 EcoBlue", "140 kW – 2.0 EcoBlue"] },
      { label: "S-MAX I (2006–2015)", powers: ["92 kW – 1.6 Ti-VCT", "118 kW – 2.0 EcoBoost", "147 kW – 2.0 EcoBoost", "176 kW – 2.0 EcoBoost", "85 kW – 1.8 TDCi", "96 kW – 2.0 TDCi", "103 kW – 2.0 TDCi", "120 kW – 2.0 TDCi"] },
      { label: "S-MAX II (2015–2023)", powers: ["118 kW – 1.5 EcoBoost", "176 kW – 2.0 EcoBoost", "88 kW – 1.5 TDCi", "88 kW – 1.5 EcoBlue", "110 kW – 2.0 TDCi", "132 kW – 2.0 TDCi", "110 kW – 2.0 EcoBlue", "140 kW – 2.0 EcoBlue"] },

      // ── Mustang ─────────────────────────────────────────────────────────────
      { group: "Mustang" },
      { label: "Mustang VI (2015–2023)", powers: ["233 kW – 2.3 EcoBoost", "310 kW – 5.0 V8 GT", "338 kW – 5.0 V8 GT", "350 kW – 5.0 V8 Mach 1", "374 kW – 5.2 V8 Shelby GT350"] },
      { label: "Mustang VII (2024–)", powers: ["231 kW – 2.3 EcoBoost", "325 kW – 5.0 V8 GT", "355 kW – 5.0 V8 Dark Horse"] },
      { label: "Mustang Mach-E (2021–)", powers: ["198 kW – Electric RWD", "216 kW – Electric AWD", "258 kW – Electric AWD ER", "346 kW – Electric GT"] },

      // ── Ka / Ka+ ───────────────────────────────────────────────────────────
      { group: "Ka / Ka+" },
      { label: "Ka I (1996–2008)" },
      { label: "Ka II (2008–2016)", powers: ["1.2 MPI", "1.3 TDCi"] },
      { label: "Ka+ (2016–2021)", powers: ["51 kW – 1.2 Ti-VCT", "63 kW – 1.2 Ti-VCT", "70 kW – 1.5 TDCi"] },

      // ── B-MAX ──────────────────────────────────────────────────────────
      { group: "B-MAX" },
      { label: "B-MAX (2012–2017)", powers: ["55 kW – 1.0", "74 kW – 1.0 EcoBoost", "88 kW – 1.0 EcoBoost", "66 kW – 1.4 Duratec", "55 kW – 1.5 TDCi", "70 kW – 1.6 TDCi"] },

      // ── C-MAX / Grand C-MAX ────────────────────────────────────────────
      { group: "C-MAX / Grand C-MAX" },
      { label: "C-MAX II (2010–2019)", powers: ["74 kW – 1.0 EcoBoost", "92 kW – 1.0 EcoBoost", "110 kW – 1.5 EcoBoost", "134 kW – 1.5 EcoBoost", "70 kW – 1.5 TDCi", "77 kW – 1.5 TDCi", "88 kW – 1.5 TDCi", "110 kW – 2.0 TDCi", "120 kW – 2.0 TDCi"] },
      { label: "Grand C-MAX (2010–2019)", powers: ["74 kW – 1.0 EcoBoost", "92 kW – 1.0 EcoBoost", "110 kW – 1.5 EcoBoost", "70 kW – 1.5 TDCi", "88 kW – 1.5 TDCi", "110 kW – 2.0 TDCi", "120 kW – 2.0 TDCi"] },

      // ── Ranger (pickup) ─────────────────────────────────────────────────────
      { group: "Ranger" },
      { label: "Ranger III (2011–2018)", powers: ["88 kW – 2.2 TDCi", "110 kW – 2.2 TDCi", "147 kW – 3.2 TDCi"] },
      { label: "Ranger IV (2019–)", powers: ["96 kW – 2.0 EcoBlue", "125 kW – 2.0 EcoBlue", "157 kW – 2.0 EcoBlue BiTurbo", "210 kW – 3.0 V6 EcoBoost Raptor"] },

      // ── Transit (velká dodávka) ──────────────────────────────────────────
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

      // ── Tourneo Custom (osobní varianta) ─────────────────────────────────
      { group: "Tourneo Custom" },
      { label: "Tourneo Custom I 2.2 TDCi (2012–2016)",          powers: ["74 kW (100 k)", "92 kW (125 k)", "113 kW (154 k)"] },
      { label: "Tourneo Custom I FL 2.0 EcoBlue (2016–2023)",    powers: ["77 kW (105 k)", "96 kW (130 k)", "125 kW (170 k)", "136 kW (185 k)"] },
      { label: "Tourneo Custom II 2.0 EcoBlue (2023–současnost)", powers: ["81 kW (110 k)", "100 kW (136 k)", "110 kW (150 k)", "125 kW (170 k)"] },
      { label: "Tourneo Custom II 2.5 Duratec PHEV (2023–současnost)", powers: ["171 kW (232 k)"] },

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

      // ── Tourneo Courier (osobní varianta) ────────────────────────────────
      { group: "Tourneo Courier" },
      { label: "Tourneo Courier I 1.5/1.6 TDCi (2014–2023)",    powers: ["55 kW (75 k)", "70 kW (95 k)", "74 kW (100 k)"] },
      { label: "Tourneo Courier I 1.0 EcoBoost (2014–2023)",    powers: ["74 kW (100 k)"] },
      { label: "Tourneo Courier II 1.0 EcoBoost (2023–současnost)", powers: ["74 kW (100 k)", "92 kW (125 k)"] },
      { label: "Tourneo Courier II 1.5 EcoBlue (2023–současnost)", powers: ["74 kW (100 k)"] },
    ],
  },

  {
    brand:     "Volkswagen",
    active:    true,
    expertise: "Volkswagen osobní a užitková vozidla všech modelových řad (Polo, Golf, Jetta, Passat, Arteon, Tiguan, T-Roc, Touareg, Touran, Sharan, Caddy, Transporter, Crafter, ID série) — motory TSI, TDI, MPI, FSI, TFSI a elektrické pohony od roku 2006 do současnosti, EU spec (AdBlue, DPF Euro 5/6, SCR systémy)",
    models: [
      // ── Up! ─────────────────────────────────────────────────────────────────
      { group: "Up!" },
      { label: "Up! (2011–2023)", powers: ["44 kW – 1.0 MPI", "55 kW – 1.0 MPI", "66 kW – 1.0 TSI", "85 kW – 1.0 TSI GTI", "61 kW – e-Up! Electric"] },

      // ── Polo ──────────────────────────────────────────────────────────────────
      { group: "Polo" },
      { label: "Polo IV (2006–2009)", powers: ["44 kW – 1.2", "47 kW – 1.2", "59 kW – 1.4", "63 kW – 1.4", "51 kW – 1.4 TDI", "59 kW – 1.4 TDI", "74 kW – 1.9 TDI"] },
      { label: "Polo V (2009–2017)", powers: ["44 kW – 1.0 MPI", "55 kW – 1.0 MPI", "66 kW – 1.2", "77 kW – 1.2 TSI", "81 kW – 1.2 TSI", "90 kW – 1.4 TSI", "55 kW – 1.4 TDI", "66 kW – 1.6 TDI", "77 kW – 1.6 TDI", "141 kW – 1.8 TSI GTI"] },
      { label: "Polo VI (2017–)", powers: ["48 kW – 1.0 MPI", "59 kW – 1.0 MPI", "70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "147 kW – 2.0 TSI GTI", "59 kW – 1.6 TDI", "70 kW – 1.6 TDI"] },

      // ── Golf ──────────────────────────────────────────────────────────────────
      { group: "Golf" },
      { label: "Golf V (2006–2008)", powers: ["55 kW – 1.4", "75 kW – 1.6", "85 kW – 1.6 FSI", "90 kW – 1.4 TSI", "103 kW – 1.4 TSI", "118 kW – 1.8 TSI", "66 kW – 1.9 TDI", "77 kW – 1.9 TDI", "103 kW – 2.0 TDI", "147 kW – 2.0 TFSI GTI", "184 kW – 3.2 VR6 R32"] },
      { label: "Golf VI (2008–2012)", powers: ["77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "118 kW – 1.4 TSI", "118 kW – 1.8 TSI", "66 kW – 1.6 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "155 kW – 2.0 TSI GTI"] },
      { label: "Golf VII (2012–2020)", powers: ["63 kW – 1.0 TSI", "85 kW – 1.0 TSI", "63 kW – 1.2 TSI", "77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "103 kW – 1.4 TSI", "96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "66 kW – 1.6 TDI", "81 kW – 1.6 TDI", "110 kW – 2.0 TDI", "135 kW – 2.0 TDI GTD", "162 kW – 2.0 TSI GTI", "169 kW – 2.0 TSI GTI", "221 kW – 2.0 TSI R", "228 kW – 2.0 TSI R"] },
      { label: "Golf VIII (2020–)", powers: ["81 kW – 1.0 TSI", "96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "85 kW – 2.0 TDI", "110 kW – 2.0 TDI", "180 kW – 2.0 TSI GTI", "235 kW – 2.0 TSI R"] },

      // ── Golf Plus ────────────────────────────────────────────────────────────
      { group: "Golf Plus" },
      { label: "Golf Plus (2005–2014)", powers: ["55 kW – 1.4", "75 kW – 1.6 MPI", "85 kW – 1.6 FSI", "90 kW – 1.4 TSI", "118 kW – 1.8 TSI", "66 kW – 1.9 TDI", "77 kW – 1.9 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI"] },

      // ── Golf Variant ─────────────────────────────────────────────────────────
      { group: "Golf Variant" },
      { label: "Golf Variant V (2007–2009)", powers: ["55 kW – 1.4", "75 kW – 1.6", "90 kW – 1.4 TSI", "77 kW – 1.9 TDI", "103 kW – 2.0 TDI"] },
      { label: "Golf Variant VI (2009–2013)", powers: ["77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "118 kW – 1.4 TSI", "66 kW – 1.6 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI"] },

      // ── Jetta ─────────────────────────────────────────────────────────────────
      { group: "Jetta" },
      { label: "Jetta V (2006–2010)", powers: ["75 kW – 1.6", "90 kW – 1.4 TSI", "103 kW – 1.4 TSI", "77 kW – 1.9 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "147 kW – 2.0 TFSI"] },
      { label: "Jetta VI (2010–2018)", powers: ["77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "110 kW – 1.4 TSI", "77 kW – 1.6 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "110 kW – 2.0 TDI"] },
      { label: "Jetta VII (2018–)", powers: ["81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "110 kW – 2.0 TDI"] },

      // ── Passat ────────────────────────────────────────────────────────────────
      { group: "Passat" },
      { label: "Passat B6 (2006–2010)", powers: ["75 kW – 1.6 MPI", "85 kW – 1.6 FSI", "90 kW – 1.4 TSI", "92 kW – 1.4 TSI", "77 kW – 1.9 TDI", "118 kW – 1.8 TSI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "147 kW – 2.0 TFSI", "220 kW – 3.6 VR6"] },
      { label: "Passat B7 (2010–2014)", powers: ["90 kW – 1.4 TSI", "110 kW – 1.4 TSI", "118 kW – 1.8 TSI", "132 kW – 1.8 TSI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "130 kW – 2.0 TDI", "155 kW – 2.0 TSI", "220 kW – 3.6 VR6"] },
      { label: "Passat B8 (2014–2023)", powers: ["110 kW – 1.5 TSI", "140 kW – 2.0 TSI", "200 kW – 2.0 TSI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI", "176 kW – 2.0 TDI"] },
      { label: "Passat B9 (2023–)", powers: ["110 kW – 1.5 TSI", "150 kW – 1.5 TSI eHybrid", "200 kW – 1.5 TSI eHybrid", "110 kW – 2.0 TDI", "142 kW – 2.0 TDI"] },

      // ── Passat CC / CC ─────────────────────────────────────────────────────
      { group: "CC" },
      { label: "Passat CC (2008–2012)", powers: ["118 kW – 1.8 TSI", "147 kW – 2.0 TFSI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "220 kW – 3.6 VR6"] },
      { label: "CC (2012–2017)", powers: ["118 kW – 1.8 TSI", "155 kW – 2.0 TSI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "130 kW – 2.0 TDI", "220 kW – 3.6 VR6"] },

      // ── Eos ──────────────────────────────────────────────────────────────────
      { group: "Eos" },
      { label: "Eos (2006–2016)", powers: ["90 kW – 1.4 TSI", "118 kW – 1.8 TSI", "147 kW – 2.0 TFSI", "155 kW – 2.0 TSI", "103 kW – 2.0 TDI"] },

      // ── Scirocco ─────────────────────────────────────────────────────────────
      { group: "Scirocco" },
      { label: "Scirocco III (2008–2017)", powers: ["90 kW – 1.4 TSI", "118 kW – 1.4 TSI", "118 kW – 1.8 TSI", "147 kW – 2.0 TFSI", "155 kW – 2.0 TSI", "195 kW – 2.0 TSI R", "103 kW – 2.0 TDI"] },

      // ── Arteon ────────────────────────────────────────────────────────────────
      { group: "Arteon" },
      { label: "Arteon I (2017–2023)", powers: ["110 kW – 1.5 TSI", "140 kW – 2.0 TSI", "206 kW – 2.0 TSI", "110 kW – 2.0 TDI", "147 kW – 2.0 TDI", "235 kW – 2.0 TSI R"] },
      { label: "Arteon II (2023–)", powers: ["110 kW – 1.5 TSI", "150 kW – 2.0 TSI", "110 kW – 2.0 TDI", "142 kW – 2.0 TDI"] },

      // ── Tiguan ────────────────────────────────────────────────────────────────
      { group: "Tiguan" },
      { label: "Tiguan I (2007–2016)", powers: ["90 kW – 1.4 TSI", "110 kW – 1.4 TSI", "118 kW – 1.4 TSI", "118 kW – 1.8 TSI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "135 kW – 2.0 TDI", "125 kW – 2.0 TSI", "147 kW – 2.0 TSI", "155 kW – 2.0 TSI"] },
      { label: "Tiguan II (2016–2023)", powers: ["96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "132 kW – 2.0 TSI", "180 kW – 2.0 TSI", "110 kW – 2.0 TDI", "147 kW – 2.0 TDI", "235 kW – 2.0 TSI R"] },
      { label: "Tiguan III (2023–)", powers: ["96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "150 kW – 1.5 TSI eHybrid", "200 kW – 1.5 TSI eHybrid", "110 kW – 2.0 TDI", "142 kW – 2.0 TDI"] },

      // ── T-Roc ─────────────────────────────────────────────────────────────────
      { group: "T-Roc" },
      { label: "T-Roc (2017–)", powers: ["81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "140 kW – 2.0 TSI", "221 kW – 2.0 TSI R", "85 kW – 1.6 TDI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI"] },

      // ── T-Cross ─────────────────────────────────────────────────────────────
      { group: "T-Cross" },
      { label: "T-Cross (2019–dosud)", powers: ["70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "70 kW – 1.6 TDI"] },

      // ── Taigo ───────────────────────────────────────────────────────────────
      { group: "Taigo" },
      { label: "Taigo (2021–dosud)", powers: ["70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI"] },

      // ── Touareg ───────────────────────────────────────────────────────────────
      { group: "Touareg" },
      { label: "Touareg II (2010–2018)", powers: ["150 kW – 3.0 V6 TDI", "176 kW – 3.0 V6 TDI", "193 kW – 3.0 V6 TDI", "204 kW – 3.0 V6 TDI", "206 kW – 3.6 V6 FSI", "250 kW – 4.2 V8 TDI"] },
      { label: "Touareg III (2018–)", powers: ["170 kW – 3.0 V6 TDI", "210 kW – 3.0 V6 TDI", "231 kW – 3.0 V6 TDI", "280 kW – 3.0 V6 TSI eHybrid", "340 kW – 3.0 V6 TSI eHybrid R"] },

      // ── Touran ────────────────────────────────────────────────────────────────
      { group: "Touran" },
      { label: "Touran I (2006–2015)", powers: ["75 kW – 1.6", "77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "103 kW – 1.4 TSI", "110 kW – 1.4 TSI", "66 kW – 1.6 TDI", "77 kW – 1.9 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI"] },
      { label: "Touran II (2015–dosud)", powers: ["81 kW – 1.2 TSI", "110 kW – 1.4 TSI", "110 kW – 1.5 TSI", "81 kW – 1.6 TDI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI"] },

      // ── Sharan ────────────────────────────────────────────────────────────────
      { group: "Sharan" },
      { label: "Sharan II (2010–2022)", powers: ["110 kW – 1.4 TSI", "147 kW – 2.0 TSI", "85 kW – 2.0 TDI", "103 kW – 2.0 TDI", "130 kW – 2.0 TDI", "135 kW – 2.0 TDI"] },

      // ── Caddy ─────────────────────────────────────────────────────────────────
      { group: "Caddy" },
      { label: "Caddy III (2006–2015)", powers: ["55 kW – 1.4", "75 kW – 1.6", "63 kW – 1.2 TSI", "77 kW – 1.2 TSI", "55 kW – 1.6 TDI", "75 kW – 1.6 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI"] },
      { label: "Caddy IV (2015–2020)", powers: ["75 kW – 1.0 TSI", "62 kW – 1.2 TSI", "92 kW – 1.4 TSI", "55 kW – 2.0 TDI", "75 kW – 2.0 TDI", "103 kW – 2.0 TDI", "110 kW – 2.0 TDI"] },
      { label: "Caddy V (2020–)", powers: ["84 kW – 1.5 TSI", "96 kW – 1.5 TSI", "55 kW – 2.0 TDI", "75 kW – 2.0 TDI", "90 kW – 2.0 TDI", "110 kW – 2.0 TDI"] },

      // ── Transporter ───────────────────────────────────────────────────────────
      { group: "Transporter" },
      { label: "Transporter T5 (2006–2015)", powers: ["85 kW – 2.0", "62 kW – 1.9 TDI", "75 kW – 1.9 TDI", "77 kW – 1.9 TDI", "96 kW – 2.5 TDI", "128 kW – 2.5 TDI", "62 kW – 2.0 TDI", "75 kW – 2.0 TDI", "103 kW – 2.0 TDI", "132 kW – 2.0 BiTDI"] },
      { label: "Transporter T6 (2015–2019)", powers: ["62 kW – 2.0 TDI", "75 kW – 2.0 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "110 kW – 2.0 TDI", "150 kW – 2.0 TDI", "132 kW – 2.0 BiTDI", "150 kW – 2.0 TSI"] },
      { label: "Transporter T6.1 (2019–)", powers: ["66 kW – 2.0 TDI", "81 kW – 2.0 TDI", "110 kW – 2.0 TDI", "150 kW – 2.0 TDI", "146 kW – 2.0 BiTDI"] },

      // ── Crafter ───────────────────────────────────────────────────────────────
      { group: "Crafter" },
      { label: "Crafter I (2006–2016)", powers: ["65 kW – 2.5 TDI", "80 kW – 2.5 TDI", "100 kW – 2.5 TDI", "120 kW – 2.5 TDI", "80 kW – 2.0 TDI", "100 kW – 2.0 TDI", "120 kW – 2.0 TDI"] },
      { label: "Crafter II (2016–)", powers: ["75 kW – 2.0 TDI", "90 kW – 2.0 TDI", "103 kW – 2.0 TDI", "130 kW – 2.0 TDI", "177 kW – 2.0 TDI", "100 kW – e-Crafter Electric"] },

      // ── ID (elektro) ─────────────────────────────────────────────────────────
      { group: "ID (elektro)" },
      { label: "ID.3 (2020–dosud)", powers: ["107 kW – Electric Pro", "125 kW – Electric Pro", "150 kW – Electric Pro S", "170 kW – Electric Pro S", "210 kW – Electric GTX"] },
      { label: "ID.4 (2020–dosud)", powers: ["109 kW – Electric Pure", "125 kW – Electric Pro", "150 kW – Electric Pro", "195 kW – Electric Pro S", "210 kW – Electric GTX", "220 kW – Electric GTX"] },
      { label: "ID.5 (2021–dosud)", powers: ["128 kW – Electric Pro", "150 kW – Electric Pro", "195 kW – Electric Pro S", "210 kW – Electric GTX", "220 kW – Electric GTX"] },
      { label: "ID.7 (2023–dosud)", powers: ["210 kW – Electric Pro S", "250 kW – Electric GTX"] },
    ],
  },

  {
    brand:     "Škoda",
    active:    true,
    expertise: "Škoda osobní vozidla všech modelových řad (Fabia, Scala, Octavia, Superb, Kamiq, Karoq, Kodiaq, Yeti, Roomster, Citigo, Elroq, Enyaq) — motory TSI, TDI, MPI, HTP a elektrické pohony od roku 2006 do současnosti, EU spec (AdBlue, DPF Euro 5/6)",
    models: [
      // ── Citigo ────────────────────────────────────────────────────────────────
      { group: "Citigo" },
      { label: "Citigo (2011–2020)", powers: ["44 kW – 1.0 MPI", "55 kW – 1.0 MPI", "61 kW – Electric"] },

      // ── Fabia ─────────────────────────────────────────────────────────────────
      { group: "Fabia" },
      { label: "Fabia II (2007–2014)", powers: ["44 kW – 1.2 HTP", "51 kW – 1.2 HTP", "63 kW – 1.2 TSI", "77 kW – 1.2 TSI", "132 kW – 1.4 TSI RS", "51 kW – 1.4 TDI", "59 kW – 1.4 TDI", "66 kW – 1.6 TDI", "77 kW – 1.6 TDI"] },
      { label: "Fabia III (2014–2021)", powers: ["44 kW – 1.0 MPI", "55 kW – 1.0 MPI", "70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "66 kW – 1.2 TSI", "81 kW – 1.2 TSI", "66 kW – 1.4 TDI", "77 kW – 1.4 TDI"] },
      { label: "Fabia IV (2021–)", powers: ["48 kW – 1.0 MPI", "59 kW – 1.0 MPI", "70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI"] },

      // ── Rapid / Scala ─────────────────────────────────────────────────────────
      { group: "Rapid / Scala" },
      { label: "Rapid (2012–2019)", powers: ["55 kW – 1.0 MPI", "70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "77 kW – 1.2 TSI", "66 kW – 1.4 TDI", "66 kW – 1.6 TDI"] },
      { label: "Scala (2019–)", powers: ["70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "85 kW – 1.6 TDI"] },

      // ── Octavia ───────────────────────────────────────────────────────────────
      { group: "Octavia" },
      { label: "Octavia II (2006–2013)", powers: ["59 kW – 1.4", "75 kW – 1.6", "77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "118 kW – 1.8 TSI", "147 kW – 2.0 TSI RS", "77 kW – 1.6 TDI", "77 kW – 1.9 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI"] },
      { label: "Octavia III (2013–2020)", powers: ["63 kW – 1.2 TSI", "77 kW – 1.2 TSI", "81 kW – 1.2 TSI", "85 kW – 1.0 TSI", "103 kW – 1.4 TSI", "110 kW – 1.4 TSI", "110 kW – 1.5 TSI", "162 kW – 2.0 TSI RS", "180 kW – 2.0 TSI RS", "66 kW – 1.6 TDI", "77 kW – 1.6 TDI", "85 kW – 1.6 TDI", "110 kW – 2.0 TDI", "135 kW – 2.0 TDI"] },
      { label: "Octavia IV (2020–2024)", powers: ["81 kW – 1.0 TSI", "81 kW – 1.0 TSI e-TEC", "110 kW – 1.5 TSI", "110 kW – 1.5 TSI e-TEC", "140 kW – 2.0 TSI", "150 kW – 1.4 TSI iV", "180 kW – 1.4 TSI RS iV", "180 kW – 2.0 TSI RS", "85 kW – 2.0 TDI", "110 kW – 2.0 TDI", "147 kW – 2.0 TDI"] },
      { label: "Octavia IV FL (2024–dosud)", powers: ["85 kW – 1.5 TSI", "85 kW – 1.5 TSI mHEV", "110 kW – 1.5 TSI", "110 kW – 1.5 TSI mHEV", "150 kW – 2.0 TSI 4x4", "195 kW – 2.0 TSI RS", "85 kW – 2.0 TDI", "110 kW – 2.0 TDI"] },

      // ── Superb ────────────────────────────────────────────────────────────────
      { group: "Superb" },
      { label: "Superb II (2008–2015)", powers: ["92 kW – 1.4 TSI", "118 kW – 1.8 TSI", "132 kW – 1.8 TSI", "147 kW – 2.0 TSI", "206 kW – 2.0 TSI", "77 kW – 1.6 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "140 kW – 2.0 TDI"] },
      { label: "Superb III (2015–2024)", powers: ["110 kW – 1.4 TSI", "110 kW – 1.5 TSI", "160 kW – 1.4 TSI iV", "140 kW – 2.0 TSI", "200 kW – 2.0 TSI", "88 kW – 1.6 TDI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI", "176 kW – 2.0 TDI"] },
      { label: "Superb IV (2024–dosud)", powers: ["110 kW – 1.5 TSI mHEV", "150 kW – 1.5 TSI iV", "150 kW – 2.0 TSI", "195 kW – 2.0 TSI", "110 kW – 2.0 TDI", "142 kW – 2.0 TDI"] },

      // ── Yeti ──────────────────────────────────────────────────────────────────
      { group: "Yeti" },
      { label: "Yeti (2009–2017)", powers: ["77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "110 kW – 1.4 TSI", "118 kW – 1.8 TSI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "110 kW – 2.0 TDI", "125 kW – 2.0 TDI"] },

      // ── Roomster ──────────────────────────────────────────────────────────────
      { group: "Roomster" },
      { label: "Roomster (2006–2015)", powers: ["47 kW – 1.2 HTP", "51 kW – 1.2 HTP", "63 kW – 1.2 TSI", "77 kW – 1.2 TSI", "51 kW – 1.4 TDI", "59 kW – 1.4 TDI", "66 kW – 1.6 TDI"] },

      // ── Kamiq ─────────────────────────────────────────────────────────────────
      { group: "Kamiq" },
      { label: "Kamiq (2019–)", powers: ["70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "85 kW – 1.6 TDI"] },

      // ── Karoq ─────────────────────────────────────────────────────────────────
      { group: "Karoq" },
      { label: "Karoq (2017–)", powers: ["81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "140 kW – 2.0 TSI", "85 kW – 1.6 TDI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI"] },

      // ── Kodiaq ────────────────────────────────────────────────────────────────
      { group: "Kodiaq" },
      { label: "Kodiaq I (2016–2024)", powers: ["110 kW – 1.4 TSI", "110 kW – 1.5 TSI", "132 kW – 2.0 TSI", "180 kW – 2.0 TSI", "180 kW – 2.0 TSI RS", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI", "147 kW – 2.0 TDI"] },
      { label: "Kodiaq II (2024–dosud)", powers: ["110 kW – 1.5 TSI mHEV", "150 kW – 1.5 TSI iV", "150 kW – 2.0 TSI", "195 kW – 2.0 TSI RS", "110 kW – 2.0 TDI", "142 kW – 2.0 TDI"] },

      // ── Elroq ─────────────────────────────────────────────────────────────────
      { group: "Elroq" },
      { label: "Elroq (2024–dosud)", powers: ["125 kW – Electric 50", "150 kW – Electric 60", "210 kW – Electric 85", "210 kW – Electric 85x"] },

      // ── Enyaq ─────────────────────────────────────────────────────────────────
      { group: "Enyaq" },
      { label: "Enyaq iV (2021–)", powers: ["109 kW – Electric 50", "132 kW – Electric 60", "150 kW – Electric 80", "195 kW – Electric 80x", "220 kW – Electric RS"] },
    ],
  },

  {
    brand:     "SEAT",
    active:    true,
    expertise: "SEAT osobní vozidla hlavních EU modelových řad (Mii, Ibiza, Leon, Cordoba, Toledo, Altea, Exeo, Arona, Ateca, Tarraco, Alhambra) — motory MPI, FSI, TSI, TDI, TGI/CNG, EcoFuel, e-HYBRID a elektrické pohony od roku 2002 do současnosti, EU spec",
    models: [
      // ── Mii ───────────────────────────────────────────────────────────────────
      { group: "Mii" },
      { label: "Mii (2012–2020)", powers: ["44 kW – 1.0 MPI", "50 kW – 1.0 EcoFuel CNG", "55 kW – 1.0 MPI", "61 kW – Electric"] },

      // ── Ibiza ─────────────────────────────────────────────────────────────────
      { group: "Ibiza" },
      { label: "Ibiza III 6L (2002–2008)", powers: ["47 kW – 1.2", "55 kW – 1.4 16V", "74 kW – 1.4 16V", "96 kW – 1.8T Cupra", "118 kW – 1.8T Cupra R", "47 kW – 1.4 TDI", "59 kW – 1.4 TDI", "74 kW – 1.9 TDI", "96 kW – 1.9 TDI"] },
      { label: "Ibiza IV (2008–2017)", powers: ["44 kW – 1.2 12V", "51 kW – 1.2 12V", "63 kW – 1.4 16V", "60 kW – 1.6 BiFuel", "63 kW – 1.2 TSI", "77 kW – 1.2 TSI", "110 kW – 1.4 TSI", "132 kW – 1.4 TSI Cupra", "55 kW – 1.2 TDI", "66 kW – 1.6 TDI", "77 kW – 1.6 TDI", "105 kW – 2.0 TDI"] },
      { label: "Ibiza V (2017–dosud)", powers: ["59 kW – 1.0 MPI", "70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "59 kW – 1.6 TDI", "85 kW – 1.6 TDI"] },

      // ── Leon ──────────────────────────────────────────────────────────────────
      { group: "Leon" },
      { label: "Leon II 1P (2005–2012)", powers: ["63 kW – 1.4", "75 kW – 1.6", "77 kW – 1.2 TSI", "92 kW – 1.4 TSI", "118 kW – 1.8 TSI", "155 kW – 2.0 TSI Cupra", "177 kW – 2.0 TSI Cupra R", "66 kW – 1.6 TDI", "77 kW – 1.9 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI"] },
      { label: "Leon III (2012–2020)", powers: ["63 kW – 1.2 TSI", "77 kW – 1.2 TSI", "85 kW – 1.0 TSI", "90 kW – 1.4 TSI", "96 kW – 1.5 TSI", "96 kW – 1.5 TGI", "103 kW – 1.4 TSI", "110 kW – 1.5 TSI", "132 kW – 1.8 TSI", "66 kW – 1.6 TDI", "77 kW – 1.6 TDI", "85 kW – 1.6 TDI", "110 kW – 2.0 TDI", "135 kW – 2.0 TDI"] },
      { label: "Leon IV (2020–dosud)", powers: ["85 kW – 1.5 TSI", "85 kW – 1.5 eTSI mHEV", "110 kW – 1.5 TSI", "110 kW – 1.5 eTSI mHEV", "150 kW – 1.5 e-HYBRID", "85 kW – 2.0 TDI", "110 kW – 2.0 TDI"] },

      // ── Cordoba / Toledo ───────────────────────────────────────────────────────
      { group: "Cordoba / Toledo" },
      { label: "Cordoba II (2002–2009)", powers: ["47 kW – 1.2", "55 kW – 1.4 16V", "74 kW – 1.4 16V", "74 kW – 2.0", "47 kW – 1.4 TDI", "74 kW – 1.9 TDI", "96 kW – 1.9 TDI"] },
      { label: "Toledo III 5P (2004–2009)", powers: ["75 kW – 1.6 FSI", "77 kW – 1.2 TSI", "92 kW – 1.4 TSI", "110 kW – 1.8 TSI", "77 kW – 1.9 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI"] },

      // ── Toledo ────────────────────────────────────────────────────────────────
      { group: "Toledo" },
      { label: "Toledo IV (2012–2019)", powers: ["55 kW – 1.2 MPI", "63 kW – 1.2 TSI", "70 kW – 1.0 TSI", "77 kW – 1.2 TSI", "81 kW – 1.0 TSI", "90 kW – 1.4 TSI", "77 kW – 1.6 TDI"] },

      // ── Altea ─────────────────────────────────────────────────────────────────
      { group: "Altea" },
      { label: "Altea / Altea XL / Freetrack (2004–2015)", powers: ["63 kW – 1.4", "77 kW – 1.2 TSI", "92 kW – 1.4 TSI", "72 kW – 1.6 BiFuel", "118 kW – 1.8 TSI", "66 kW – 1.6 TDI", "77 kW – 1.6 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI"] },

      // ── Exeo ──────────────────────────────────────────────────────────────────
      { group: "Exeo" },
      { label: "Exeo / Exeo ST (2009–2013)", powers: ["88 kW – 1.8 TSI", "118 kW – 1.8 TSI", "155 kW – 2.0 TSI", "88 kW – 2.0 TDI", "105 kW – 2.0 TDI", "125 kW – 2.0 TDI"] },

      // ── Arona ────────────────────────────────────────────────────────────────
      { group: "Arona" },
      { label: "Arona (2017–dosud)", powers: ["70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "110 kW – 1.5 TSI"] },

      // ── Ateca ────────────────────────────────────────────────────────────────
      { group: "Ateca" },
      { label: "Ateca (2016–dosud)", powers: ["85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "140 kW – 2.0 TSI", "85 kW – 1.6 TDI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI"] },

      // ── Tarraco ──────────────────────────────────────────────────────────────
      { group: "Tarraco" },
      { label: "Tarraco (2018–dosud)", powers: ["110 kW – 1.5 TSI", "110 kW – 2.0 TDI", "147 kW – 2.0 TDI", "180 kW – 1.4 e-HYBRID"] },

      // ── Alhambra ─────────────────────────────────────────────────────────────
      { group: "Alhambra" },
      { label: "Alhambra II (2010–2022)", powers: ["110 kW – 1.4 TSI", "85 kW – 2.0 TDI", "110 kW – 2.0 TDI", "135 kW – 2.0 TDI"] },
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
      { label: "A1 GB (2018–)", powers: ["70 kW – 1.0 TFSI", "81 kW – 1.0 TFSI", "85 kW – 1.0 TFSI", "110 kW – 1.5 TFSI", "147 kW – 2.0 TFSI S line"] },

      // ── A3 ────────────────────────────────────────────────────────────────────
      { group: "A3" },
      { label: "A3 8P (2006–2012)", powers: ["75 kW – 1.6", "77 kW – 1.2 TFSI", "92 kW – 1.4 TFSI", "118 kW – 1.8 TFSI", "147 kW – 2.0 TFSI", "195 kW – 2.5 TFSI RS3", "77 kW – 1.6 TDI", "77 kW – 1.9 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI"] },
      { label: "A3 8V (2012–2020)", powers: ["77 kW – 1.2 TFSI", "81 kW – 1.2 TFSI", "90 kW – 1.4 TFSI", "103 kW – 1.4 TFSI", "110 kW – 1.5 TFSI", "132 kW – 1.8 TFSI", "169 kW – 2.0 TFSI S3", "228 kW – 2.5 TFSI RS3", "77 kW – 1.6 TDI", "81 kW – 1.6 TDI", "110 kW – 2.0 TDI", "135 kW – 2.0 TDI"] },
      { label: "A3 8Y (2020–)", powers: ["81 kW – 1.0 TFSI", "110 kW – 1.5 TFSI", "140 kW – 2.0 TFSI", "228 kW – 2.0 TFSI S3", "294 kW – 2.5 TFSI RS3", "85 kW – 2.0 TDI", "110 kW – 2.0 TDI"] },

      // ── A4 ────────────────────────────────────────────────────────────────────
      { group: "A4" },
      { label: "A4 B7 (2006–2008)", powers: ["96 kW – 1.8 T", "118 kW – 2.0 TFSI", "147 kW – 2.0 TFSI", "188 kW – 3.2 FSI", "85 kW – 1.9 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "150 kW – 2.5 TDI", "171 kW – 3.0 TDI"] },
      { label: "A4 B8 (2008–2015)", powers: ["88 kW – 1.8 TFSI", "118 kW – 1.8 TFSI", "132 kW – 1.8 TFSI", "155 kW – 2.0 TFSI", "165 kW – 2.0 TFSI", "200 kW – 3.0 TFSI", "88 kW – 2.0 TDI", "100 kW – 2.0 TDI", "105 kW – 2.0 TDI", "130 kW – 2.0 TDI", "140 kW – 2.0 TDI", "150 kW – 3.0 TDI", "176 kW – 3.0 TDI"] },
      { label: "A4 B9 (2015–)", powers: ["110 kW – 1.4 TFSI", "110 kW – 1.5 TFSI", "140 kW – 2.0 TFSI", "185 kW – 2.0 TFSI", "260 kW – 2.9 TFSI RS4", "90 kW – 2.0 TDI", "110 kW – 2.0 TDI", "120 kW – 2.0 TDI", "140 kW – 2.0 TDI", "150 kW – 3.0 TDI", "170 kW – 3.0 TDI", "210 kW – 3.0 TDI"] },

      // ── A5 ────────────────────────────────────────────────────────────────────
      { group: "A5" },
      { label: "A5 8T (2007–2016)", powers: ["118 kW – 1.8 TFSI", "155 kW – 2.0 TFSI", "200 kW – 3.0 TFSI", "245 kW – 3.0 TFSI S5", "120 kW – 2.0 TDI", "130 kW – 2.0 TDI", "150 kW – 3.0 TDI", "176 kW – 3.0 TDI"] },
      { label: "A5 F5 (2016–)", powers: ["110 kW – 1.5 TFSI", "140 kW – 2.0 TFSI", "185 kW – 2.0 TFSI", "260 kW – 2.9 TFSI RS5", "110 kW – 2.0 TDI", "120 kW – 2.0 TDI", "140 kW – 2.0 TDI", "170 kW – 3.0 TDI", "210 kW – 3.0 TDI"] },

      // ── A6 ────────────────────────────────────────────────────────────────────
      { group: "A6" },
      { label: "A6 C6 (2006–2011)", powers: ["96 kW – 2.0", "125 kW – 2.0 TFSI", "147 kW – 2.0 TFSI", "162 kW – 2.8 FSI", "213 kW – 3.0 TFSI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "150 kW – 2.7 TDI", "171 kW – 3.0 TDI"] },
      { label: "A6 C7 (2011–2018)", powers: ["132 kW – 1.8 TFSI", "165 kW – 2.0 TFSI", "228 kW – 3.0 TFSI", "310 kW – 4.0 TFSI RS6", "100 kW – 2.0 TDI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI", "150 kW – 3.0 TDI", "160 kW – 3.0 TDI", "200 kW – 3.0 TDI", "235 kW – 3.0 BiTDI"] },
      { label: "A6 C8 (2018–)", powers: ["110 kW – 2.0 TFSI", "150 kW – 2.0 TFSI", "195 kW – 2.0 TFSI", "250 kW – 3.0 TFSI", "441 kW – 4.0 TFSI RS6", "120 kW – 2.0 TDI", "140 kW – 2.0 TDI", "170 kW – 3.0 TDI", "210 kW – 3.0 TDI", "231 kW – 3.0 TDI"] },

      // ── Q2 ────────────────────────────────────────────────────────────────────
      { group: "Q2" },
      { label: "Q2 (2016–)", powers: ["85 kW – 1.0 TFSI", "110 kW – 1.5 TFSI", "140 kW – 2.0 TFSI", "228 kW – 2.5 TFSI SQ2", "85 kW – 1.6 TDI", "110 kW – 2.0 TDI"] },

      // ── Q3 ────────────────────────────────────────────────────────────────────
      { group: "Q3" },
      { label: "Q3 8U (2011–2018)", powers: ["110 kW – 1.4 TFSI", "132 kW – 1.8 TFSI", "162 kW – 2.0 TFSI", "228 kW – 2.5 TFSI RS Q3", "103 kW – 2.0 TDI", "110 kW – 2.0 TDI", "130 kW – 2.0 TDI"] },
      { label: "Q3 F3 (2018–)", powers: ["110 kW – 1.5 TFSI", "140 kW – 2.0 TFSI", "169 kW – 2.0 TFSI", "294 kW – 2.5 TFSI RS Q3", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI"] },

      // ── Q5 ────────────────────────────────────────────────────────────────────
      { group: "Q5" },
      { label: "Q5 8R (2008–2017)", powers: ["132 kW – 2.0 TFSI", "162 kW – 2.0 TFSI", "200 kW – 3.0 TFSI", "270 kW – 3.0 TFSI SQ5", "105 kW – 2.0 TDI", "120 kW – 2.0 TDI", "130 kW – 2.0 TDI", "140 kW – 2.0 TDI", "176 kW – 3.0 TDI", "230 kW – 3.0 BiTDI SQ5"] },
      { label: "Q5 FY (2017–)", powers: ["110 kW – 2.0 TFSI", "140 kW – 2.0 TFSI", "195 kW – 2.0 TFSI", "260 kW – 2.9 TFSI SQ5", "110 kW – 2.0 TDI", "120 kW – 2.0 TDI", "140 kW – 2.0 TDI", "170 kW – 3.0 TDI", "251 kW – 3.0 TDI SQ5"] },

      // ── Q7 ────────────────────────────────────────────────────────────────────
      { group: "Q7" },
      { label: "Q7 4L (2006–2015)", powers: ["206 kW – 3.6 FSI", "245 kW – 4.2 FSI", "176 kW – 3.0 TDI", "180 kW – 3.0 TDI", "150 kW – 3.0 TDI", "240 kW – 4.2 TDI", "250 kW – 6.0 V12 TDI"] },
      { label: "Q7 4M (2015–)", powers: ["185 kW – 2.0 TFSI", "250 kW – 3.0 TFSI", "110 kW – 2.0 TDI", "170 kW – 3.0 TDI", "200 kW – 3.0 TDI", "210 kW – 3.0 TDI", "270 kW – 4.0 TDI SQ7"] },

      // ── Q8 ────────────────────────────────────────────────────────────────────
      { group: "Q8" },
      { label: "Q8 (2018–)", powers: ["250 kW – 3.0 TFSI", "373 kW – 4.0 TFSI SQ8", "441 kW – 4.0 TFSI RS Q8", "170 kW – 3.0 TDI", "210 kW – 3.0 TDI", "270 kW – 4.0 TDI SQ8"] },

      // ── TT ────────────────────────────────────────────────────────────────────
      { group: "TT" },
      { label: "TT 8J (2006–2014)", powers: ["118 kW – 1.8 TFSI", "147 kW – 2.0 TFSI", "155 kW – 2.0 TFSI", "200 kW – 2.0 TFSI TTS", "250 kW – 2.5 TFSI RS", "125 kW – 2.0 TDI"] },
      { label: "TT 8S (2014–)", powers: ["132 kW – 1.8 TFSI", "169 kW – 2.0 TFSI", "228 kW – 2.0 TFSI TTS", "294 kW – 2.5 TFSI RS"] },

      // ── A7 ────────────────────────────────────────────────────────────────────
      { group: "A7" },
      { label: "A7 4G (2010–2018)", powers: ["165 kW – 2.0 TFSI", "228 kW – 3.0 TFSI", "310 kW – 4.0 TFSI RS7", "412 kW – 4.0 TFSI RS7 Performance", "100 kW – 2.0 TDI", "140 kW – 2.0 TDI", "160 kW – 3.0 TDI", "200 kW – 3.0 TDI", "235 kW – 3.0 BiTDI"] },
      { label: "A7 4K (2018–dosud)", powers: ["195 kW – 2.0 TFSI", "250 kW – 3.0 TFSI", "331 kW – 4.0 TFSI S7", "441 kW – 4.0 TFSI RS7", "120 kW – 2.0 TDI", "170 kW – 3.0 TDI", "210 kW – 3.0 TDI", "231 kW – 3.0 TDI"] },

      // ── e-tron (elektro) ──────────────────────────────────────────────────────
      { group: "e-tron (elektro)" },
      { label: "e-tron 55 (2019–2023)", powers: ["230 kW – Electric 55", "300 kW – Electric S", "370 kW – Electric RS"] },
      { label: "Q4 e-tron (2021–dosud)", powers: ["125 kW – Electric 35", "150 kW – Electric 40", "195 kW – Electric 45", "220 kW – Electric 50", "250 kW – Electric SQ4"] },
      { label: "Q8 e-tron (2023–dosud)", powers: ["250 kW – Electric 55", "300 kW – Electric S", "370 kW – Electric SQ8"] },
      { label: "e-tron GT (2021–dosud)", powers: ["350 kW – Electric GT", "440 kW – Electric RS", "475 kW – Electric RS Performance"] },
    ],
  },

  {
    brand:     "Toyota",
    active:    true,
    expertise: "Toyota osobní a užitková vozidla hlavních i vybraných globálních modelových řad (Aygo, Yaris, Corolla, Corolla Cross, Auris, Avensis, Prius, Camry, C-HR, RAV4, Land Cruiser, Hilux, Proace, Supra/GT86/GR86, Highlander, Tacoma, 4Runner) — motory VVT-i, D-4D, hybridní systémy a elektrické pohony primárně od roku 2006 do současnosti, doplněné o vybrané starší forum-backed generace z Toyota Club fóra",
    models: [
      // ── Aygo ──────────────────────────────────────────────────────────────────
      { group: "Aygo" },
      { label: "Aygo I (2006–2014)", powers: ["50 kW – 1.0 VVT-i", "51 kW – 1.4 D-4D"] },
      { label: "Aygo II (2014–2022)", powers: ["51 kW – 1.0 VVT-i", "53 kW – 1.0 VVT-i"] },
      { label: "Aygo X (2022–dosud)", powers: ["53 kW – 1.0 VVT-i"] },

      // ── Yaris ─────────────────────────────────────────────────────────────────
      { group: "Yaris" },
      { label: "Yaris II (2006–2011)", powers: ["51 kW – 1.0 VVT-i", "64 kW – 1.3 VVT-i", "97 kW – 1.8 VVT-i TS", "66 kW – 1.4 D-4D"] },
      { label: "Yaris III (2011–2020)", powers: ["51 kW – 1.0 VVT-i", "54 kW – 1.0 VVT-i", "73 kW – 1.33 VVT-i", "82 kW – 1.5 VVT-i", "74 kW – 1.5 Hybrid", "66 kW – 1.4 D-4D"] },
      { label: "Yaris IV (2020–)", powers: ["92 kW – 1.5 Hybrid", "85 kW – 1.5 Hybrid", "200 kW – 1.6 Turbo GR"] },

      // ── Yaris Cross ─────────────────────────────────────────────────────────
      { group: "Yaris Cross" },
      { label: "Yaris Cross (2021–dosud)", powers: ["88 kW – 1.5 Hybrid", "92 kW – 1.5 Hybrid AWD", "85 kW – 1.5 VVT-i"] },

      // ── Corolla ───────────────────────────────────────────────────────────────
      { group: "Corolla" },
      { label: "Corolla E150 (2006–2013)", powers: ["71 kW – 1.33 VVT-i", "97 kW – 1.6 VVT-i", "100 kW – 1.8 VVT-i", "66 kW – 1.4 D-4D", "93 kW – 2.0 D-4D", "91 kW – 2.2 D-CAT"] },
      { label: "Corolla E210 (2019–)", powers: ["85 kW – 1.5 VVT-i", "90 kW – 1.8 Hybrid", "103 kW – 1.8 Hybrid", "140 kW – 2.0 Hybrid", "221 kW – 2.0 Turbo GR"] },

      // ── Corolla Cross ───────────────────────────────────────────────────────
      { group: "Corolla Cross" },
      { label: "Corolla Cross (2022–dosud)", powers: ["103 kW – 1.8 Hybrid", "145 kW – 2.0 Hybrid", "145 kW – 2.0 Hybrid AWD"] },

      // ── Auris ─────────────────────────────────────────────────────────────────
      { group: "Auris" },
      { label: "Auris I (2006–2012)", powers: ["73 kW – 1.33 VVT-i", "97 kW – 1.6 VVT-i", "100 kW – 1.8 VVT-i", "66 kW – 1.4 D-4D", "91 kW – 2.0 D-4D", "130 kW – 2.2 D-CAT"] },
      { label: "Auris II (2012–2018)", powers: ["73 kW – 1.33 VVT-i", "97 kW – 1.6 VVT-i", "100 kW – 1.8 Hybrid", "66 kW – 1.4 D-4D", "91 kW – 2.0 D-4D"] },

      // ── Avensis ───────────────────────────────────────────────────────────────
      { group: "Avensis" },
      { label: "Avensis T25 (2003–2009)" },
      { label: "Avensis T27 (2009–2018)", powers: ["97 kW – 1.6 VVT-i", "108 kW – 1.8 VVT-i", "112 kW – 2.0 VVT-i", "91 kW – 2.0 D-4D", "93 kW – 2.0 D-4D", "105 kW – 2.2 D-4D", "110 kW – 2.2 D-CAT"] },

      // ── Camry ─────────────────────────────────────────────────────────────────
      { group: "Camry" },
      { label: "Camry XV70 (2019–)", powers: ["131 kW – 2.5 Hybrid", "160 kW – 2.5 Hybrid AWD"] },

      // ── Prius ────────────────────────────────────────────────────────────────
      { group: "Prius" },
      { label: "Prius II (2004–2009)" },
      { label: "Prius III (2009–2016)", powers: ["100 kW – 1.8 Hybrid"] },
      { label: "Prius IV (2016–2022)", powers: ["90 kW – 1.8 Hybrid", "90 kW – 1.8 Plug-in Hybrid"] },
      { label: "Prius V (2023–dosud)", powers: ["164 kW – 2.0 Plug-in Hybrid"] },

      // ── C-HR ──────────────────────────────────────────────────────────────────
      { group: "C-HR" },
      { label: "C-HR I (2016–2023)", powers: ["85 kW – 1.2 Turbo", "90 kW – 1.8 Hybrid", "135 kW – 2.0 Hybrid"] },
      { label: "C-HR II (2023–)", powers: ["103 kW – 1.8 Hybrid", "145 kW – 2.0 Hybrid", "152 kW – 2.0 Hybrid AWD"] },

      // ── RAV4 ──────────────────────────────────────────────────────────────────
      { group: "RAV4" },
      { label: "RAV4 II (2000–2006)" },
      { label: "RAV4 III (2006–2012)", powers: ["112 kW – 2.0 VVT-i", "125 kW – 2.4 VVT-i", "100 kW – 2.2 D-4D", "110 kW – 2.2 D-4D", "130 kW – 2.2 D-CAT"] },
      { label: "RAV4 IV (2013–2018)", powers: ["111 kW – 2.0 VVT-i", "107 kW – 2.5 Hybrid", "91 kW – 2.0 D-4D", "110 kW – 2.2 D-4D"] },
      { label: "RAV4 V (2019–)", powers: ["130 kW – 2.0 VVT-i", "160 kW – 2.5 Hybrid", "163 kW – 2.5 Hybrid AWD", "225 kW – 2.5 Plug-in Hybrid"] },

      // ── Land Cruiser ──────────────────────────────────────────────────────────
      { group: "Land Cruiser" },
      { label: "Land Cruiser 150 (2009–)", powers: ["120 kW – 2.8 D-4D", "140 kW – 2.8 D-4D", "145 kW – 2.8 D-4D", "127 kW – 3.0 D-4D"] },
      { label: "Land Cruiser 300 (2021–)", powers: ["227 kW – 3.3 D-4D", "305 kW – 3.5 V6 Twin-Turbo"] },

      // ── Hilux ─────────────────────────────────────────────────────────────────
      { group: "Hilux" },
      { label: "Hilux VIII (2015–)", powers: ["110 kW – 2.4 D-4D", "130 kW – 2.8 D-4D", "150 kW – 2.8 D-4D"] },

      // ── Global / forum-backed Toyota lines ──────────────────────────────────
      { group: "4Runner" },
      { label: "4Runner (2009–dosud)" },

      { group: "Highlander / Kluger" },
      { label: "Highlander / Kluger IV (2020–dosud)", powers: ["182 kW – 2.5 Hybrid AWD"] },

      { group: "Tacoma" },
      { label: "Tacoma (2016–dosud)" },

      // ── Proace ────────────────────────────────────────────────────────────────
      { group: "Proace" },
      { label: "Proace II (2016–)", powers: ["70 kW – 1.5 D-4D", "88 kW – 1.5 D-4D", "110 kW – 2.0 D-4D", "130 kW – 2.0 D-4D", "100 kW – Electric"] },
      { label: "Proace City (2019–)", powers: ["55 kW – 1.5 D-4D", "75 kW – 1.5 D-4D", "96 kW – 1.2 Turbo", "81 kW – 1.5 D-4D", "100 kW – Electric"] },

      // ── GT86 / GR86 ──────────────────────────────────────────────────────────
      { group: "GT86" },
      { label: "GT86 (2012–2021)", powers: ["147 kW – 2.0 Boxer"] },

      { group: "GR86" },
      { label: "GR86 (2022–dosud)", powers: ["172 kW – 2.4 Boxer"] },

      // ── Supra ─────────────────────────────────────────────────────────────────
      { group: "Supra" },
      { label: "Supra GR (2019–dosud)", powers: ["145 kW – 2.0 Turbo", "190 kW – 2.0 Turbo", "250 kW – 3.0 Turbo", "285 kW – 3.0 Turbo"] },

      // ── bZ4X ────────────────────────────────────────────────────────────────
      { group: "bZ4X" },
      { label: "bZ4X (2022–dosud)", powers: ["150 kW – Electric FWD", "160 kW – Electric AWD"] },

      // ── Verso ───────────────────────────────────────────────────────────────
      { group: "Verso" },
      { label: "Corolla Verso / Verso II (2004–2009)" },
      { label: "Verso (2009–2018)", powers: ["97 kW – 1.6 VVT-i", "108 kW – 1.8 VVT-i", "111 kW – 2.0 VVT-i", "99 kW – 1.8 Hybrid", "66 kW – 1.4 D-4D", "82 kW – 2.0 D-4D", "93 kW – 2.0 D-4D", "110 kW – 2.2 D-4D"] },
    ],
  },

  {
    brand:     "Renault",
    active:    true,
    expertise: "Renault osobní a užitková vozidla hlavních modelových řad po roce 2000 (Twingo, Clio, Thalia, Megane, Scenic, Laguna, Espace, Captur, Kadjar, Arkana, Austral, Koleos, Fluence, Talisman, Kangoo, Trafic, Master) — motory TCe, dCi, Blue dCi a elektrické pohony, převážně EU spec",
    models: [
      // ── Twingo ────────────────────────────────────────────────────────────────
      { group: "Twingo" },
      { label: "Twingo II (2007–2014)", powers: ["43 kW – 1.2", "56 kW – 1.2 16V", "74 kW – 1.2 TCe", "98 kW – 1.6 RS", "47 kW – 1.5 dCi"] },
      { label: "Twingo III (2014–dosud)", powers: ["52 kW – 1.0 SCe", "54 kW – 1.0 SCe", "66 kW – 0.9 TCe", "68 kW – 0.9 TCe", "60 kW – Electric"] },

      // ── Clio ──────────────────────────────────────────────────────────────────
      { group: "Clio" },
      { label: "Clio III (2006–2012)", powers: ["55 kW – 1.2", "74 kW – 1.2 TCe", "72 kW – 1.4", "82 kW – 1.6", "145 kW – 2.0 RS", "48 kW – 1.5 dCi", "63 kW – 1.5 dCi", "78 kW – 1.5 dCi"] },
      { label: "Clio IV (2012–2019)", powers: ["54 kW – 1.2", "66 kW – 0.9 TCe", "87 kW – 1.2 TCe", "118 kW – 1.6 Turbo RS", "162 kW – 1.6 Turbo RS Trophy", "55 kW – 1.5 dCi", "66 kW – 1.5 dCi"] },
      { label: "Clio V (2019–)", powers: ["49 kW – 1.0 SCe", "67 kW – 1.0 TCe", "74 kW – 1.0 TCe", "103 kW – 1.3 TCe", "104 kW – 1.6 E-Tech Hybrid", "63 kW – 1.5 Blue dCi", "85 kW – 1.5 Blue dCi"] },

      // ── Thalia ────────────────────────────────────────────────────────────────
      { group: "Thalia" },
      { label: "Thalia II (2008–2013)", powers: ["55 kW – 1.2 16V", "74 kW – 1.2 TCe", "55 kW – 1.5 dCi"] },

      // ── Megane ────────────────────────────────────────────────────────────────
      { group: "Megane" },
      { label: "Megane II (2002–2009)", powers: ["72 kW – 1.4 16V", "82 kW – 1.6 16V", "100 kW – 2.0 16V", "165 kW – 2.0 Turbo RS", "63 kW – 1.5 dCi", "88 kW – 1.9 dCi"] },
      { label: "Megane III (2008–2016)", powers: ["74 kW – 1.2 TCe", "85 kW – 1.2 TCe", "97 kW – 1.2 TCe", "81 kW – 1.6", "96 kW – 2.0", "184 kW – 2.0 TCe RS", "201 kW – 2.0 TCe RS Trophy", "66 kW – 1.5 dCi", "81 kW – 1.5 dCi", "95 kW – 1.6 dCi", "110 kW – 1.6 dCi", "96 kW – 2.0 dCi"] },
      { label: "Megane IV (2016–2022)", powers: ["74 kW – 1.0 TCe", "85 kW – 1.0 TCe", "103 kW – 1.3 TCe", "117 kW – 1.3 TCe", "205 kW – 1.8 TCe RS", "221 kW – 1.8 TCe RS Trophy", "85 kW – 1.5 Blue dCi", "110 kW – 1.5 Blue dCi", "118 kW – 1.7 Blue dCi"] },
      { label: "Megane E-Tech Electric (2022–)", powers: ["96 kW – Electric 40", "131 kW – Electric 60", "160 kW – Electric 60"] },

      // ── Scenic ────────────────────────────────────────────────────────────────
      { group: "Scenic" },
      { label: "Scenic II (2003–2009)", powers: ["82 kW – 1.6 16V", "98 kW – 2.0 16V", "60 kW – 1.5 dCi", "88 kW – 1.9 dCi", "110 kW – 2.0 dCi"] },
      { label: "Scenic III (2009–2016)", powers: ["85 kW – 1.2 TCe", "97 kW – 1.2 TCe", "81 kW – 1.6", "96 kW – 2.0", "66 kW – 1.5 dCi", "81 kW – 1.5 dCi", "95 kW – 1.6 dCi", "118 kW – 1.6 dCi", "96 kW – 2.0 dCi", "110 kW – 2.0 dCi"] },
      { label: "Scenic IV (2016–2022)", powers: ["85 kW – 1.2 TCe", "103 kW – 1.3 TCe", "117 kW – 1.3 TCe", "85 kW – 1.5 Blue dCi", "110 kW – 1.5 Blue dCi", "88 kW – 1.7 Blue dCi", "110 kW – 1.7 Blue dCi"] },

      // ── Laguna ────────────────────────────────────────────────────────────────
      { group: "Laguna" },
      { label: "Laguna II (2001–2007)", powers: ["79 kW – 1.6 16V", "99 kW – 2.0 16V", "120 kW – 2.0 Turbo", "79 kW – 1.9 dCi", "110 kW – 2.2 dCi", "130 kW – 3.0 dCi"] },
      { label: "Laguna III (2007–2015)", powers: ["81 kW – 1.6 16V", "125 kW – 2.0 Turbo", "81 kW – 1.5 dCi", "96 kW – 2.0 dCi", "127 kW – 2.0 dCi"] },

      // ── Captur ────────────────────────────────────────────────────────────────
      { group: "Captur" },
      { label: "Captur I (2013–2019)", powers: ["66 kW – 0.9 TCe", "87 kW – 1.2 TCe", "66 kW – 1.5 dCi", "81 kW – 1.5 dCi"] },
      { label: "Captur II (2019–)", powers: ["74 kW – 1.0 TCe", "103 kW – 1.3 TCe", "117 kW – 1.3 TCe", "116 kW – 1.6 E-Tech Hybrid", "118 kW – 1.6 E-Tech PHEV", "85 kW – 1.5 Blue dCi"] },

      // ── Modus / Fluence / Latitude / Talisman ───────────────────────────────
      { group: "Modus / Fluence / Latitude / Talisman" },
      { label: "Modus / Grand Modus (2004–2012)", powers: ["55 kW – 1.2", "74 kW – 1.2 TCe", "65 kW – 1.4 16V", "78 kW – 1.5 dCi"] },
      { label: "Fluence (2009–2016)", powers: ["81 kW – 1.6 16V", "103 kW – 2.0 16V", "81 kW – 1.5 dCi", "70 kW – Electric"] },
      { label: "Latitude (2011–2015)", powers: ["103 kW – 2.0 16V", "125 kW – 2.0 Turbo", "110 kW – 2.0 dCi", "177 kW – 3.0 V6 dCi"] },
      { label: "Talisman (2015–2022)", powers: ["110 kW – 1.6 TCe", "147 kW – 1.6 TCe", "96 kW – 1.5 dCi", "118 kW – 1.6 dCi", "118 kW – 2.0 Blue dCi"] },

      // ── Kadjar / Austral / Arkana ─────────────────────────────────────────────
      { group: "Kadjar / Austral / Arkana" },
      { label: "Kadjar (2015–2022)", powers: ["97 kW – 1.2 TCe", "117 kW – 1.3 TCe", "85 kW – 1.5 Blue dCi", "110 kW – 1.5 Blue dCi", "96 kW – 1.6 dCi"] },
      { label: "Arkana (2021–)", powers: ["103 kW – 1.3 TCe", "117 kW – 1.3 TCe", "105 kW – 1.6 E-Tech Hybrid", "145 kW – 1.6 E-Tech Hybrid"] },
      { label: "Austral (2022–)", powers: ["96 kW – 1.2 TCe", "110 kW – 1.2 TCe", "130 kW – 1.2 E-Tech Hybrid", "147 kW – 1.2 E-Tech Hybrid"] },

      // ── Koleos ────────────────────────────────────────────────────────────────
      { group: "Koleos" },
      { label: "Koleos I (2008–2016)", powers: ["126 kW – 2.5 16V", "110 kW – 2.0 dCi", "127 kW – 2.0 dCi"] },
      { label: "Koleos II (2017–dosud)", powers: ["96 kW – 1.3 TCe", "117 kW – 1.3 TCe", "96 kW – 1.7 Blue dCi", "110 kW – 2.0 Blue dCi", "140 kW – 2.0 Blue dCi"] },

      // ── Renault 5 / Twizy / Wind ────────────────────────────────────────────
      { group: "Renault 5 / Twizy / Wind" },
      { label: "Renault 5 E-Tech Electric (2024–dosud)", powers: ["90 kW – Electric", "110 kW – Electric"] },
      { label: "Twizy (2011–dosud)", powers: ["4 kW – Electric 45", "13 kW – Electric 80"] },
      { label: "Wind (2010–2013)", powers: ["74 kW – 1.2 TCe", "98 kW – 1.6 16V"] },

      // ── Kangoo ────────────────────────────────────────────────────────────────
      { group: "Kangoo" },
      { label: "Kangoo II (2008–2021)", powers: ["55 kW – 1.2 TCe", "85 kW – 1.2 TCe", "55 kW – 1.5 dCi", "66 kW – 1.5 dCi", "81 kW – 1.5 dCi", "44 kW – Electric"] },
      { label: "Kangoo III (2021–)", powers: ["96 kW – 1.3 TCe", "75 kW – 1.5 Blue dCi", "85 kW – 1.5 Blue dCi", "90 kW – Electric"] },

      // ── Trafic ────────────────────────────────────────────────────────────────
      { group: "Trafic" },
      { label: "Trafic III (2014–)", powers: ["70 kW – 1.6 dCi", "85 kW – 1.6 dCi", "88 kW – 1.6 dCi", "103 kW – 1.6 dCi", "107 kW – 2.0 dCi", "110 kW – 2.0 Blue dCi", "125 kW – 2.0 Blue dCi"] },

      // ── Master ────────────────────────────────────────────────────────────────
      { group: "Master" },
      { label: "Master III (2010–dosud)", powers: ["74 kW – 2.3 dCi", "81 kW – 2.3 dCi", "92 kW – 2.3 dCi", "100 kW – 2.3 dCi", "107 kW – 2.3 dCi", "110 kW – 2.3 Blue dCi", "120 kW – 2.3 Blue dCi"] },

      // ── Zoe ──────────────────────────────────────────────────────────────────
      { group: "Zoe" },
      { label: "Zoe (2012–2024)", powers: ["65 kW – Electric 22 kWh", "68 kW – Electric 22 kWh", "80 kW – Electric 41 kWh", "100 kW – Electric 52 kWh", "108 kW – Electric 52 kWh R135"] },

      // ── Espace ───────────────────────────────────────────────────────────────
      { group: "Espace" },
      { label: "Espace IV (2002–2014)", powers: ["100 kW – 2.0 Turbo", "120 kW – 2.0 Turbo", "110 kW – 2.2 dCi", "127 kW – 2.0 dCi", "130 kW – 3.0 dCi"] },
      { label: "Espace V (2015–2023)", powers: ["97 kW – 1.2 TCe", "118 kW – 1.3 TCe", "96 kW – 1.6 dCi", "118 kW – 1.6 dCi", "110 kW – 2.0 Blue dCi", "140 kW – 2.0 Blue dCi"] },
      { label: "Espace VI (2023–dosud)", powers: ["130 kW – 1.2 E-Tech Hybrid", "147 kW – 1.2 E-Tech Hybrid"] },

      // ── Vel Satis / Alaskan ─────────────────────────────────────────────────
      { group: "Vel Satis / Alaskan" },
      { label: "Vel Satis (2001–2009)", powers: ["120 kW – 2.0 Turbo", "177 kW – 3.5 V6", "110 kW – 2.2 dCi", "130 kW – 3.0 dCi"] },
      { label: "Alaskan (2017–2021)", powers: ["120 kW – 2.3 dCi", "140 kW – 2.3 dCi"] },
    ],
  },

  {
    brand:     "Dacia",
    active:    true,
    expertise: "Dacia osobní vozidla všech modelových řad (Logan, Sandero, Duster, Bigster, Jogger, Dokker, Lodgy, Spring) — motory SCe, TCe, dCi, Blue dCi, LPG a elektrický pohon od roku 2006 do současnosti, EU spec",
    models: [
      // ── Logan ─────────────────────────────────────────────────────────────────
      { group: "Logan" },
      { label: "Logan I (2006–2012)", powers: ["55 kW – 1.4", "64 kW – 1.4", "77 kW – 1.6", "62 kW – 1.5 dCi", "50 kW – 1.5 dCi"] },
      { label: "Logan II (2012–2020)", powers: ["54 kW – 1.0 SCe", "66 kW – 0.9 TCe", "73 kW – 1.0 TCe", "55 kW – 1.5 dCi", "66 kW – 1.5 dCi", "70 kW – 1.5 Blue dCi"] },
      { label: "Logan III (2021–)", powers: ["48 kW – 1.0 SCe", "67 kW – 1.0 TCe", "74 kW – 1.0 TCe", "96 kW – 1.3 TCe", "74 kW – 1.0 TCe LPG", "63 kW – 1.5 Blue dCi"] },

      // ── Sandero ───────────────────────────────────────────────────────────────
      { group: "Sandero" },
      { label: "Sandero I (2008–2012)", powers: ["55 kW – 1.4", "64 kW – 1.4", "77 kW – 1.6", "50 kW – 1.5 dCi"] },
      { label: "Sandero II (2012–2020)", powers: ["54 kW – 1.0 SCe", "66 kW – 0.9 TCe", "73 kW – 1.0 TCe", "55 kW – 1.5 dCi", "66 kW – 1.5 dCi", "70 kW – 1.5 Blue dCi"] },
      { label: "Sandero III (2021–)", powers: ["48 kW – 1.0 SCe", "67 kW – 1.0 TCe", "74 kW – 1.0 TCe", "96 kW – 1.3 TCe", "110 kW – 1.3 TCe Stepway", "74 kW – 1.0 TCe LPG"] },

      // ── Duster ────────────────────────────────────────────────────────────────
      { group: "Duster" },
      { label: "Duster I (2010–2017)", powers: ["77 kW – 1.6", "92 kW – 1.2 TCe", "79 kW – 1.5 dCi", "80 kW – 1.5 dCi"] },
      { label: "Duster II (2018–2024)", powers: ["96 kW – 1.0 TCe", "110 kW – 1.3 TCe", "96 kW – 1.0 TCe LPG", "84 kW – 1.5 Blue dCi", "85 kW – 1.5 Blue dCi"] },
      { label: "Duster III (2024–)", powers: ["96 kW – 1.0 TCe", "103 kW – 1.2 TCe", "96 kW – 1.0 TCe LPG", "103 kW – 1.2 TCe Hybrid 48V"] },

      // ── Bigster ───────────────────────────────────────────────────────────────
      { group: "Bigster" },
      { label: "Bigster (2025–dosud)" },

      // ── Lodgy / Jogger ────────────────────────────────────────────────────────
      { group: "Lodgy / Jogger" },
      { label: "Lodgy (2012–2022)", powers: ["73 kW – 1.0 TCe", "75 kW – 1.6", "96 kW – 1.3 TCe", "55 kW – 1.5 dCi", "80 kW – 1.5 dCi"] },
      { label: "Jogger (2022–)", powers: ["74 kW – 1.0 TCe", "96 kW – 1.0 TCe", "74 kW – 1.0 TCe LPG", "103 kW – 1.6 E-Tech Hybrid"] },

      // ── Dokker ────────────────────────────────────────────────────────────────
      { group: "Dokker" },
      { label: "Dokker (2012–2020)", powers: ["54 kW – 1.0 SCe", "73 kW – 1.0 TCe", "75 kW – 1.6", "55 kW – 1.5 dCi", "66 kW – 1.5 dCi"] },

      // ── Spring ────────────────────────────────────────────────────────────────
      { group: "Spring" },
      { label: "Spring (2021–)", powers: ["33 kW – Electric", "48 kW – Electric Extreme"] },
    ],
  },

  {
    brand:     "Peugeot",
    active:    true,
    expertise: "Peugeot osobní a užitková vozidla hlavních evropských modelových řad (107, 206, 207, 208, 301, 307, 308, 405, 4007, 4008, 5008, 508, 607, 807, RCZ, Bipper, Partner, Rifter, Expert, Traveller, Boxer) — motory TU, EW, Prince/THP, PureTech, HDi, BlueHDi a elektrické pohony od konce 80. let do současnosti, EU spec (AdBlue, DPF Euro 5/6, SCR)",
    models: [
      // ── 207 / 208 ────────────────────────────────────────────────────────────
      { group: "207 / 208" },
      { label: "107" },
      { label: "206 / 206+" },
      { label: "207 (2006–2012)", powers: ["54 kW – 1.4 VTi", "65 kW – 1.4 VTi", "88 kW – 1.6 VTi", "110 kW – 1.6 THP", "128 kW – 1.6 THP GTi", "150 kW – 1.6 THP RC", "50 kW – 1.4 HDi", "66 kW – 1.6 HDi", "80 kW – 1.6 HDi"] },
      { label: "208 I (2012–2019)", powers: ["50 kW – 1.0 VTi", "60 kW – 1.2 VTi", "81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "147 kW – 1.6 THP GTi", "153 kW – 1.6 THP GTi by PS", "50 kW – 1.4 HDi", "68 kW – 1.6 HDi", "55 kW – 1.5 BlueHDi", "75 kW – 1.5 BlueHDi"] },
      { label: "208 II (2019–)", powers: ["55 kW – 1.2 PureTech", "75 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "100 kW – Electric e-208", "115 kW – Electric e-208"] },

      // ── 301 / 307 ────────────────────────────────────────────────────────────
      { group: "301 / 307" },
      { label: "301" },
      { label: "307" },

      // ── 308 ───────────────────────────────────────────────────────────────────
      { group: "308" },
      { label: "308 I T7 (2007–2013)", powers: ["72 kW – 1.4 VTi", "88 kW – 1.6 VTi", "110 kW – 1.6 THP", "128 kW – 1.6 THP GTi", "66 kW – 1.6 HDi", "82 kW – 1.6 HDi", "100 kW – 2.0 HDi", "120 kW – 2.0 HDi"] },
      { label: "308 II T9 (2013–2021)", powers: ["60 kW – 1.2 PureTech", "81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "151 kW – 1.6 THP", "200 kW – 1.6 THP GTi", "73 kW – 1.5 BlueHDi", "96 kW – 1.5 BlueHDi", "110 kW – 2.0 BlueHDi", "133 kW – 2.0 BlueHDi"] },
      { label: "308 III P5 (2021–)", powers: ["81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "132 kW – 1.2 PureTech", "165 kW – 1.6 PHEV", "132 kW – 1.5 BlueHDi", "96 kW – 1.5 BlueHDi"] },

      // ── 508 ───────────────────────────────────────────────────────────────────
      { group: "508" },
      { label: "508 I (2010–2018)", powers: ["110 kW – 1.6 THP", "121 kW – 1.6 THP", "147 kW – 1.6 THP", "100 kW – 2.0 HDi", "110 kW – 2.0 HDi", "120 kW – 2.0 HDi", "133 kW – 2.0 BlueHDi", "150 kW – 2.2 HDi"] },
      { label: "508 II (2018–)", powers: ["96 kW – 1.2 PureTech", "132 kW – 1.6 PureTech", "165 kW – 1.6 PureTech", "165 kW – 1.6 PHEV", "265 kW – 1.6 PHEV PSE", "96 kW – 1.5 BlueHDi", "118 kW – 2.0 BlueHDi", "133 kW – 2.0 BlueHDi"] },

      // ── 2008 ──────────────────────────────────────────────────────────────────
      { group: "2008" },
      { label: "2008 I (2013–2019)", powers: ["60 kW – 1.2 VTi", "81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "73 kW – 1.5 BlueHDi", "66 kW – 1.6 HDi", "85 kW – 1.6 BlueHDi"] },
      { label: "2008 II (2019–)", powers: ["75 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "100 kW – Electric e-2008", "115 kW – Electric e-2008", "96 kW – 1.5 BlueHDi"] },

      // ── 3008 ──────────────────────────────────────────────────────────────────
      { group: "3008" },
      { label: "3008 I (2009–2016)", powers: ["88 kW – 1.6 VTi", "110 kW – 1.6 THP", "115 kW – 1.6 THP", "121 kW – 1.6 THP", "80 kW – 1.6 HDi", "82 kW – 1.6 BlueHDi", "110 kW – 2.0 HDi", "120 kW – 2.0 HDi", "133 kW – 2.0 BlueHDi", "150 kW – 2.0 HDi Hybrid4"] },
      { label: "3008 II (2016–)", powers: ["96 kW – 1.2 PureTech", "132 kW – 1.6 PureTech", "165 kW – 1.6 PureTech", "165 kW – 1.6 PHEV", "265 kW – 1.6 PHEV", "96 kW – 1.5 BlueHDi", "118 kW – 2.0 BlueHDi", "133 kW – 2.0 BlueHDi"] },

      // ── 4007 / 4008 / 405 ────────────────────────────────────────────────────
      { group: "4007 / 4008 / 405" },
      { label: "405" },
      { label: "4007" },
      { label: "4008" },

      // ── 5008 ──────────────────────────────────────────────────────────────────
      { group: "5008" },
      { label: "5008 I (2009–2017)", powers: ["88 kW – 1.6 VTi", "110 kW – 1.6 THP", "121 kW – 1.6 THP", "80 kW – 1.6 HDi", "82 kW – 1.6 BlueHDi", "110 kW – 2.0 HDi", "120 kW – 2.0 HDi"] },
      { label: "5008 II (2017–)", powers: ["96 kW – 1.2 PureTech", "132 kW – 1.6 PureTech", "165 kW – 1.6 PureTech", "165 kW – 1.6 PHEV", "73 kW – 1.5 BlueHDi", "96 kW – 1.5 BlueHDi", "118 kW – 2.0 BlueHDi", "133 kW – 2.0 BlueHDi"] },

      // ── 607 / 807 / RCZ ──────────────────────────────────────────────────────
      { group: "607 / 807 / RCZ" },
      { label: "607" },
      { label: "807" },
      { label: "RCZ" },

      // ── Rifter (Partner) ──────────────────────────────────────────────────────
      { group: "Rifter" },
      { label: "Bipper / Bipper Tepee" },
      { label: "Partner Tepee (2008–2018)", powers: ["54 kW – 1.4", "72 kW – 1.6 VTi", "88 kW – 1.6 VTi", "110 kW – 1.6 THP", "50 kW – 1.6 HDi", "66 kW – 1.6 HDi", "82 kW – 1.6 BlueHDi", "73 kW – 1.5 BlueHDi", "96 kW – 2.0 HDi"] },
      { label: "Rifter (2018–)", powers: ["81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "73 kW – 1.5 BlueHDi", "96 kW – 1.5 BlueHDi", "100 kW – Electric e-Rifter"] },

      // ── Expert ────────────────────────────────────────────────────────────────
      { group: "Expert" },
      { label: "Expert / Traveller II (2007–2016)" },
      { label: "Expert III (2016–dosud)", powers: ["75 kW – 1.5 BlueHDi", "88 kW – 1.5 BlueHDi", "110 kW – 2.0 BlueHDi", "130 kW – 2.0 BlueHDi", "100 kW – Electric e-Expert"] },
      { label: "Traveller (2016–dosud)" },

      // ── Boxer ─────────────────────────────────────────────────────────────────
      { group: "Boxer" },
      { label: "Boxer I (1994–2006)" },
      { label: "Boxer III (2006–dosud)", powers: ["74 kW – 2.2 HDi", "88 kW – 2.2 HDi", "96 kW – 2.2 HDi", "81 kW – 2.0 BlueHDi", "88 kW – 2.2 BlueHDi", "103 kW – 2.2 BlueHDi", "121 kW – 2.2 BlueHDi", "120 kW – 3.0 HDi"] },
    ],
  },

  // ── BMW ──────────────────────────────────────────────────────────────────────

  {
    brand:     "BMW",
    active:    true,
    expertise: "BMW osobní vozy a SUV hlavních post-2000 modelových řad (1, 2, 3, 4, 5, 6, 7, 8, Z4, X1–X7) — motory N47/B47 diesel, N20/B48 benzín, N55/B58 R6, M Performance/M, plug-in hybridní a elektrické pohony od roku 2002, EU spec",
    models: [
      // ── Řada 1 ───────────────────────────────────────────────────────────────
      { group: "Řada 1" },
      { label: "1 E87 (2004–2011)", powers: ["85 kW – 1.6 N45", "95 kW – 2.0 N46", "105 kW – 2.0 N43", "125 kW – 2.0 N43", "195 kW – 3.0 N52", "225 kW – 3.0T N54", "85 kW – 2.0d N47", "105 kW – 2.0d N47", "130 kW – 2.0d N47", "150 kW – 2.0d N47S"] },
      { label: "1 F20 (2011–2019)", powers: ["75 kW – 1.6T N13", "100 kW – 1.6T N13", "80 kW – 1.5T B38", "100 kW – 1.5T B38", "135 kW – 2.0T B48", "165 kW – 2.0T B48", "250 kW – 3.0T B58 M140i", "85 kW – 1.5d B37", "105 kW – 2.0d N47", "110 kW – 2.0d B47", "140 kW – 2.0d B47"] },
      { label: "1 F40 (2019–)", powers: ["80 kW – 1.5T B38", "103 kW – 1.5T B38", "131 kW – 2.0T B48", "195 kW – 2.0T B48 128ti", "225 kW – 2.0T B48 M135i", "85 kW – 1.5d B37", "110 kW – 2.0d B47", "140 kW – 2.0d B47"] },

      // ── Řada 2 ───────────────────────────────────────────────────────────────
      { group: "Řada 2" },
      { label: "2 F22 Coupé (2014–2021)", powers: ["100 kW – 1.5T B38 218i", "135 kW – 2.0T B48 220i", "185 kW – 2.0T B48 230i", "250 kW – 3.0T B58 M240i", "272 kW – 3.0T N55 M2", "302 kW – 3.0T S55 M2 Competition", "110 kW – 2.0d B47 218d", "140 kW – 2.0d B47 220d", "155 kW – 2.0d B47 225d"] },
      { label: "2 G42 Coupé (2022–dosud)", powers: ["135 kW – 2.0T B48 220i", "190 kW – 2.0T B48 230i", "275 kW – 3.0T B58 M240i", "338 kW – 3.0T S58 M2", "110 kW – 2.0d B47 218d", "140 kW – 2.0d B47 220d"] },
      { label: "2 Active Tourer F45 (2014–2021)", powers: ["75 kW – 1.5T B38 214i", "100 kW – 1.5T B38 218i", "141 kW – 2.0T B48 220i", "170 kW – 2.0T B48 225i", "85 kW – 1.5d B37 216d", "110 kW – 2.0d B47 218d", "140 kW – 2.0d B47 220d", "162 kW – 1.5T+E PHEV 225xe"] },
      { label: "2 Active Tourer U06 (2022–dosud)", powers: ["100 kW – 1.5T B38 218i", "125 kW – 2.0T B48 220i", "150 kW – 2.0T B48 223i", "85 kW – 1.5d B37 216d", "110 kW – 2.0d B47 218d", "155 kW – 2.0d B47 220d", "180 kW – 1.5T+E PHEV 225e", "240 kW – 1.5T+E PHEV 230e"] },

      // ── Řada 3 ───────────────────────────────────────────────────────────────
      { group: "Řada 3" },
      { label: "3 E90 (2005–2012)", powers: ["105 kW – 2.0 N43", "110 kW – 2.0 N46", "125 kW – 2.0 N43", "160 kW – 2.5 N52", "190 kW – 3.0 N52", "225 kW – 3.0T N54", "85 kW – 2.0d N47", "105 kW – 2.0d N47", "130 kW – 2.0d N47", "150 kW – 3.0d N57", "180 kW – 3.0d N57", "210 kW – 3.0d M57"] },
      { label: "3 F30 (2012–2019)", powers: ["100 kW – 1.6T N13", "135 kW – 2.0T N20", "135 kW – 2.0T B48", "185 kW – 2.0T B48", "240 kW – 3.0T B58 340i", "85 kW – 2.0d N47", "110 kW – 2.0d B47", "135 kW – 2.0d N47", "140 kW – 2.0d B47", "190 kW – 3.0d N57", "195 kW – 3.0d B57"] },
      { label: "3 G20 (2019–)", powers: ["115 kW – 2.0T B48", "135 kW – 2.0T B48", "190 kW – 2.0T B48", "275 kW – 3.0T B58 M340i", "110 kW – 2.0d B47", "140 kW – 2.0d B47", "210 kW – 3.0d B57", "250 kW – 3.0d B57 M340d"] },

      // ── Řada 4 ───────────────────────────────────────────────────────────────
      { group: "Řada 4" },
      { label: "4 F32/F33/F36 (2013–2020)", powers: ["135 kW – 2.0T B48 420i", "185 kW – 2.0T B48 430i", "240 kW – 3.0T B58 440i", "317 kW – 3.0T S55 M4", "331 kW – 3.0T S55 M4 Competition", "110 kW – 2.0d B47 418d", "140 kW – 2.0d B47 420d", "190 kW – 3.0d N57 430d", "230 kW – 3.0d N57 435d"] },
      { label: "4 G22/G23/G26 (2020–dosud)", powers: ["135 kW – 2.0T B48 420i", "190 kW – 2.0T B48 430i", "275 kW – 3.0T B58 M440i", "353 kW – 3.0T S58 M4", "375 kW – 3.0T S58 M4 Competition", "110 kW – 2.0d B47 420d", "140 kW – 2.0d B47 420d xDrive", "210 kW – 3.0d B57 430d", "250 kW – 3.0d B57 M440d"] },

      // ── Řada 5 ───────────────────────────────────────────────────────────────
      { group: "Řada 5" },
      { label: "5 E60 (2003–2010)", powers: ["125 kW – 2.0 N43", "160 kW – 2.5 N52", "190 kW – 3.0 N52", "225 kW – 3.0T N54", "270 kW – 4.8 N62", "120 kW – 2.0d M47", "130 kW – 2.0d N47", "145 kW – 3.0d M57", "170 kW – 3.0d M57", "200 kW – 3.0d M57 bi-turbo"] },
      { label: "5 F10 (2010–2017)", powers: ["135 kW – 2.0T N20", "185 kW – 2.0T B48", "225 kW – 3.0T N55", "250 kW – 3.0T B58", "300 kW – 4.4T N63", "105 kW – 2.0d N47", "140 kW – 2.0d B47", "190 kW – 3.0d N57", "195 kW – 3.0d B57", "230 kW – 3.0d N57 bi-turbo"] },
      { label: "5 G30 (2017–)", powers: ["135 kW – 2.0T B48", "185 kW – 2.0T B48", "250 kW – 3.0T B58", "340 kW – 4.4T N63 M550i", "110 kW – 2.0d B47", "140 kW – 2.0d B47", "195 kW – 3.0d B57", "210 kW – 3.0d B57", "235 kW – 3.0d B57 540d"] },

      // ── Řada 6 / 8 / Z4 ──────────────────────────────────────────────────────
      { group: "Řada 6 / 8 / Z4" },
      { label: "6 E63/E64 (2003–2010)", powers: ["190 kW – 3.0 N52 630i", "270 kW – 4.8 N62 650i", "373 kW – 5.0 S85 M6", "210 kW – 3.0d M57 635d"] },
      { label: "6 F06/F12/F13 (2011–2018)", powers: ["235 kW – 3.0T N55 640i", "330 kW – 4.4T N63 650i", "412 kW – 4.4T S63 M6", "230 kW – 3.0d N57 640d"] },
      { label: "8 G14/G15/G16 (2018–dosud)", powers: ["245 kW – 3.0T B58 840i", "390 kW – 4.4T N63 M850i", "460 kW – 4.4T S63 M8 Competition", "235 kW – 3.0d B57 840d"] },
      { label: "Z4 E85/E86 (2002–2008)", powers: ["110 kW – 2.0 N46", "130 kW – 2.2 M54", "160 kW – 2.5 N52", "195 kW – 3.0 N52", "252 kW – 3.2 S54 M"] },
      { label: "Z4 E89 (2009–2016)", powers: ["115 kW – 2.0 N20 sDrive18i", "135 kW – 2.0 N20 sDrive20i", "180 kW – 2.0 N20 sDrive28i", "250 kW – 3.0T N54/N55 sDrive35i", "250 kW – 3.0T N54 sDrive35is"] },
      { label: "Z4 G29 (2019–dosud)", powers: ["145 kW – 2.0T B48 sDrive20i", "190 kW – 2.0T B48 sDrive30i", "250 kW – 3.0T B58 M40i"] },

      // ── Řada 7 ───────────────────────────────────────────────────────────────
      { group: "Řada 7" },
      { label: "7 F01 (2008–2015)", powers: ["225 kW – 3.0T N55 740i", "300 kW – 4.4T N63 750i", "400 kW – 6.0T N74 760Li", "190 kW – 3.0d N57 730d", "210 kW – 3.0d N57 730Ld", "230 kW – 3.0d N57 740d", "280 kW – 3.0d N57 740d xDrive"] },
      { label: "7 G11 (2015–2022)", powers: ["250 kW – 3.0T B58 740i", "340 kW – 4.4T N63 750i", "430 kW – 6.6T N74 M760Li", "195 kW – 3.0d B57 730d", "210 kW – 3.0d B57 740d", "294 kW – 3.0d B57 M750d", "245 kW – 3.0T+E PHEV 745e"] },
      { label: "7 G70 (2022–dosud)", powers: ["200 kW – 2.0T B48 735i", "280 kW – 3.0T B58 740i", "400 kW – 4.4T S68 M760e PHEV", "455 kW – Electric i7 xDrive60", "485 kW – Electric i7 M70"] },

      // ── X1 ───────────────────────────────────────────────────────────────────
      { group: "X1" },
      { label: "X1 E84 (2009–2015)", powers: ["110 kW – 2.0 N46", "135 kW – 2.0T N20", "180 kW – 2.0T N20", "85 kW – 2.0d N47", "105 kW – 2.0d N47", "135 kW – 2.0d N47", "160 kW – 2.0d N47S"] },
      { label: "X1 F48 (2015–2022)", powers: ["103 kW – 1.5T B38", "141 kW – 2.0T B48", "85 kW – 1.5d B37", "110 kW – 2.0d B47", "140 kW – 2.0d B47", "170 kW – 2.0d B47", "162 kW – 1.5T+E PHEV"] },
      { label: "X1 U11 (2022–)", powers: ["100 kW – 1.5T B38", "125 kW – 2.0T B48", "150 kW – 2.0T B48", "233 kW – 2.0T B48 M35i", "110 kW – 2.0d B47", "155 kW – 2.0d B47", "150 kW – Electric iX1 eDrive20", "230 kW – Electric iX1 xDrive30"] },

      // ── X2 ───────────────────────────────────────────────────────────────────
      { group: "X2" },
      { label: "X2 F39 (2018–2023)", powers: ["103 kW – 1.5T B38 sDrive18i", "141 kW – 2.0T B48 sDrive20i", "225 kW – 2.0T B48 M35i", "85 kW – 1.5d B37 sDrive16d", "110 kW – 2.0d B47 sDrive18d", "140 kW – 2.0d B47 xDrive20d", "162 kW – 1.5T+E PHEV xDrive25e"] },
      { label: "X2 U10 (2024–dosud)", powers: ["125 kW – 2.0T B48 sDrive20i", "150 kW – 2.0T B48 xDrive23i", "233 kW – 2.0T B48 M35i", "110 kW – 2.0d B47 sDrive18d", "155 kW – 2.0d B47 xDrive20d", "150 kW – Electric iX2 eDrive20", "230 kW – Electric iX2 xDrive30"] },

      // ── X3 ───────────────────────────────────────────────────────────────────
      { group: "X3" },
      { label: "X3 F25 (2010–2017)", powers: ["135 kW – 2.0T N20", "180 kW – 2.0T N20", "225 kW – 3.0T N55", "110 kW – 2.0d N47", "140 kW – 2.0d B47", "190 kW – 3.0d N57", "230 kW – 3.0d N57 bi-turbo"] },
      { label: "X3 G01 (2017–)", powers: ["135 kW – 2.0T B48", "185 kW – 2.0T B48", "265 kW – 3.0T B58 M40i", "110 kW – 2.0d B47", "140 kW – 2.0d B47", "195 kW – 3.0d B57", "240 kW – 3.0d B57 M40d", "215 kW – 2.0T+E PHEV", "210 kW – Electric iX3"] },

      // ── X4 ───────────────────────────────────────────────────────────────────
      { group: "X4" },
      { label: "X4 F26 (2014–2018)", powers: ["135 kW – 2.0T N20 xDrive20i", "180 kW – 2.0T N20 xDrive28i", "225 kW – 3.0T N55 xDrive35i", "110 kW – 2.0d N47 xDrive20d", "140 kW – 2.0d B47 xDrive20d", "190 kW – 3.0d N57 xDrive30d", "230 kW – 3.0d N57 xDrive35d"] },
      { label: "X4 G02 (2018–dosud)", powers: ["135 kW – 2.0T B48 xDrive20i", "185 kW – 2.0T B48 xDrive30i", "265 kW – 3.0T B58 M40i", "353 kW – 3.0T S58 M Competition", "110 kW – 2.0d B47 xDrive20d", "140 kW – 2.0d B47 xDrive20d", "195 kW – 3.0d B57 xDrive30d", "240 kW – 3.0d B57 M40d"] },

      // ── X5 ───────────────────────────────────────────────────────────────────
      { group: "X5" },
      { label: "X5 E70 (2006–2013)", powers: ["190 kW – 3.0 N52", "225 kW – 3.0T N55", "300 kW – 4.4T N63", "173 kW – 3.0d M57", "180 kW – 3.0d N57", "210 kW – 3.0d M57 bi-turbo", "225 kW – 3.0d N57"] },
      { label: "X5 F15 (2013–2018)", powers: ["225 kW – 3.0T N55", "330 kW – 4.4T N63", "170 kW – 2.0d B47", "190 kW – 3.0d N57", "230 kW – 3.0d N57", "280 kW – 3.0d N57 M50d", "230 kW – 2.0T+E PHEV"] },
      { label: "X5 G05 (2018–)", powers: ["250 kW – 3.0T B58", "390 kW – 4.4T N63 M50i", "170 kW – 2.0d B47", "195 kW – 3.0d B57", "250 kW – 3.0d B57", "294 kW – 3.0d B57 M50d", "290 kW – 3.0T+E PHEV xDrive45e"] },

      // ── X6 ───────────────────────────────────────────────────────────────────
      { group: "X6" },
      { label: "X6 E71 (2008–2014)", powers: ["225 kW – 3.0T N55 xDrive35i", "300 kW – 4.4T N63 xDrive50i", "180 kW – 3.0d N57 xDrive30d", "225 kW – 3.0d N57 xDrive40d", "280 kW – 3.0d N57 M50d"] },
      { label: "X6 F16 (2014–2019)", powers: ["225 kW – 3.0T N55 xDrive35i", "330 kW – 4.4T N63 xDrive50i", "170 kW – 2.0d B47 xDrive20d", "190 kW – 3.0d N57 xDrive30d", "230 kW – 3.0d N57 xDrive40d", "280 kW – 3.0d N57 M50d"] },
      { label: "X6 G06 (2019–dosud)", powers: ["250 kW – 3.0T B58 xDrive40i", "390 kW – 4.4T S68 M60i", "460 kW – 4.4T S68 X6 M Competition", "195 kW – 3.0d B57 xDrive30d", "250 kW – 3.0d B57 xDrive40d", "294 kW – 3.0d B57 M50d"] },

      // ── X7 ───────────────────────────────────────────────────────────────────
      { group: "X7" },
      { label: "X7 G07 (2018–dosud)", powers: ["250 kW – 3.0T B58 xDrive40i", "390 kW – 4.4T N63 M50i", "280 kW – 3.0d B57 xDrive40d", "250 kW – 3.0d B57 xDrive40d", "260 kW – 3.0d B57 M50d"] },

      // ── Elektro ──────────────────────────────────────────────────────────────
      { group: "Elektro" },
      { label: "i3 (2013–2022)", powers: ["125 kW – Electric", "135 kW – Electric (2017+)", "170 kW – Electric S (2018+)"] },
      { label: "i4 (2021–dosud)", powers: ["150 kW – eDrive35", "250 kW – eDrive40", "400 kW – M50", "455 kW – M50 (2025+)"] },
      { label: "iX (2021–dosud)", powers: ["240 kW – xDrive40", "326 kW – xDrive50", "455 kW – M60"] },
      { label: "i5 (2023–dosud)", powers: ["250 kW – eDrive40", "398 kW – M60 xDrive"] },
      { label: "i7 (2022–dosud)", powers: ["455 kW – xDrive60", "485 kW – M70 xDrive"] },
    ],
  },

  // ── Tesla ──────────────────────────────────────────────────────────────────

  {
    brand:     "Tesla",
    active:    true,
    expertise: "Tesla elektromobily a lehká užitková EV hlavních sériově vyráběných modelových řad (Roadster, Model S, Model 3, Model X, Model Y, Cybertruck, Semi) — elektrické pohony, bateriové systémy NMC/LFP, BMS, tepelné čerpadlo, rekuperace, supercharging, HV bezpečnost, OTA aktualizace",
    models: [
      // ── Roadster ─────────────────────────────────────────────────────────────
      { group: "Roadster" },
      { label: "Roadster I (2008–2012)" },

      // ── Model 3 ──────────────────────────────────────────────────────────────
      { group: "Model 3" },
      { label: "Model 3 (2017–2023)", powers: ["208 kW – Standard Range RWD", "324 kW – Long Range AWD", "357 kW – Performance AWD"] },
      { label: "Model 3 Highland (2024–)", powers: ["208 kW – RWD", "348 kW – Long Range AWD"] },

      // ── Model Y ──────────────────────────────────────────────────────────────
      { group: "Model Y" },
      { label: "Model Y (2020–2024)", powers: ["220 kW – RWD", "258 kW – Long Range RWD", "324 kW – Long Range AWD", "357 kW – Performance AWD"] },
      { label: "Model Y Juniper (2025–)", powers: ["220 kW – RWD", "340 kW – Long Range AWD"] },

      // ── Model S ──────────────────────────────────────────────────────────────
      { group: "Model S" },
      { label: "Model S (2012–2020)", powers: ["245 kW – 75D AWD", "311 kW – 100D AWD", "449 kW – P100D AWD"] },
      { label: "Model S (2021–)", powers: ["493 kW – Dual Motor AWD", "750 kW – Plaid Tri-Motor"] },

      // ── Model X ──────────────────────────────────────────────────────────────
      { group: "Model X" },
      { label: "Model X (2015–2020)", powers: ["311 kW – 100D AWD", "449 kW – P100D AWD"] },
      { label: "Model X (2021–dosud)", powers: ["493 kW – Dual Motor AWD", "750 kW – Plaid Tri-Motor"] },

      // ── Cybertruck / Semi ───────────────────────────────────────────────────
      { group: "Cybertruck / Semi" },
      { label: "Cybertruck (2023–dosud)" },
      { label: "Semi (2022–dosud)" },
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
      { label: "Picanto I SA (2006–2011)", powers: ["45 kW – 1.0 Epsilon", "48 kW – 1.1 Epsilon", "55 kW – 1.1 CRDi"] },
      { label: "Picanto II (2011–2017)", powers: ["51 kW – 1.0 Kappa", "63 kW – 1.2 Kappa"] },
      { label: "Picanto III (2017–)", powers: ["49 kW – 1.0 MPI", "67 kW – 1.0 T-GDi", "62 kW – 1.2 MPI"] },

      // ── Rio ──────────────────────────────────────────────────────────────────
      { group: "Rio" },
      { label: "Rio III (2011–2017)", powers: ["62 kW – 1.2 CVVT", "80 kW – 1.4 CVVT", "66 kW – 1.1 CRDi", "74 kW – 1.4 CRDi"] },
      { label: "Rio IV (2017–)", powers: ["62 kW – 1.2 MPI", "74 kW – 1.0 T-GDi", "88 kW – 1.0 T-GDi", "74 kW – 1.4 MPI", "55 kW – 1.5 CRDi"] },

      // ── Ceed ─────────────────────────────────────────────────────────────────
      { group: "Ceed" },
      { label: "Ceed II JD (2012–2018)", powers: ["74 kW – 1.4 MPI", "88 kW – 1.0 T-GDi", "103 kW – 1.6 GDi", "150 kW – 1.6 T-GDi GT", "66 kW – 1.4 CRDi", "85 kW – 1.6 CRDi", "100 kW – 1.6 CRDi"] },
      { label: "Ceed III CD (2018–)", powers: ["74 kW – 1.0 T-GDi", "88 kW – 1.0 T-GDi", "103 kW – 1.5 T-GDi", "150 kW – 1.6 T-GDi GT", "73 kW – 1.6 CRDi", "85 kW – 1.6 CRDi", "100 kW – 1.6 CRDi"] },

      // ── Stonic ───────────────────────────────────────────────────────────────
      { group: "Stonic" },
      { label: "Stonic (2017–)", powers: ["74 kW – 1.0 T-GDi", "88 kW – 1.0 T-GDi", "74 kW – 1.4 MPI", "55 kW – 1.5 CRDi", "85 kW – 1.6 CRDi"] },

      // ── Sportage ─────────────────────────────────────────────────────────────
      { group: "Sportage" },
      { label: "Sportage III (2010–2015)", powers: ["122 kW – 2.0 GDi", "100 kW – 1.7 CRDi", "135 kW – 2.0 CRDi"] },
      { label: "Sportage IV QL (2015–2021)", powers: ["97 kW – 1.6 GDi", "130 kW – 1.6 T-GDi", "85 kW – 1.6 CRDi", "100 kW – 1.7 CRDi", "136 kW – 2.0 CRDi"] },
      { label: "Sportage V NQ5 (2021–)", powers: ["110 kW – 1.6 T-GDi", "132 kW – 1.6 T-GDi MHEV", "169 kW – 1.6 T-GDi HEV", "195 kW – 1.6 T-GDi PHEV", "85 kW – 1.6 CRDi", "100 kW – 1.6 CRDi MHEV"] },

      // ── Sorento ──────────────────────────────────────────────────────────────
      { group: "Sorento" },
      { label: "Sorento II XM (2009–2014)", powers: ["128 kW – 2.4 GDi", "110 kW – 2.0 CRDi", "145 kW – 2.2 CRDi"] },
      { label: "Sorento III UM (2014–2020)", powers: ["176 kW – 2.0 T-GDi", "136 kW – 2.0 CRDi", "147 kW – 2.2 CRDi"] },
      { label: "Sorento IV MQ4 (2020–)", powers: ["169 kW – 1.6 T-GDi HEV", "195 kW – 1.6 T-GDi PHEV", "147 kW – 2.2 CRDi"] },

      // ── Niro ─────────────────────────────────────────────────────────────────
      { group: "Niro" },
      { label: "Niro I DE (2016–2022)", powers: ["104 kW – 1.6 GDi HEV", "104 kW – 1.6 GDi PHEV", "100 kW – Electric 39 kWh", "150 kW – Electric 64 kWh"] },
      { label: "Niro II SG2 (2022–)", powers: ["104 kW – 1.6 GDi HEV", "135 kW – 1.6 GDi PHEV", "110 kW – Electric 58 kWh", "150 kW – Electric 64 kWh"] },

      // ── EV6 ──────────────────────────────────────────────────────────────────
      { group: "EV6" },
      { label: "EV6 (2021–dosud)", powers: ["125 kW – Standard Range RWD", "168 kW – Long Range RWD", "239 kW – Long Range AWD", "430 kW – GT AWD"] },

      // ── EV9 ──────────────────────────────────────────────────────────────────
      { group: "EV9" },
      { label: "EV9 (2023–dosud)", powers: ["150 kW – Standard Range RWD", "204 kW – Long Range RWD", "283 kW – Long Range AWD", "283 kW – GT-Line AWD"] },

      // ── EV3 ──────────────────────────────────────────────────────────────────
      { group: "EV3" },
      { label: "EV3 (2024–dosud)", powers: ["150 kW – Standard Range", "150 kW – Long Range"] },
    ],
  },

  // ── Hyundai ────────────────────────────────────────────────────────────────

  {
    brand:     "Hyundai",
    active:    true,
    expertise: "Hyundai osobní vozy a SUV všech klíčových modelových řad (i10, i20, i30, i40, ix20, Bayon, Tucson, Santa Fe, Kona, IONIQ, INSTER, Genesis, Veloster) — motory MPI, T-GDi, GDi, CRDi, hybridní a elektrické pohony od roku 2001, převážně EU spec",
    models: [
      // ── i10 ──────────────────────────────────────────────────────────────────
      { group: "i10" },
      { label: "i10 I PA (2008–2013)" },
      { label: "i10 II BA (2013–2019)", powers: ["49 kW – 1.0 Kappa MPI", "64 kW – 1.2 Kappa MPI"] },
      { label: "i10 III AC3 (2019–)", powers: ["49 kW – 1.0 MPI", "62 kW – 1.2 MPI", "74 kW – 1.0 T-GDi"] },

      // ── i20 ──────────────────────────────────────────────────────────────────
      { group: "i20" },
      { label: "i20 I PB (2008–2014)" },
      { label: "i20 II GB (2014–2020)", powers: ["55 kW – 1.2 MPI", "62 kW – 1.2 MPI", "74 kW – 1.0 T-GDi", "88 kW – 1.0 T-GDi", "74 kW – 1.4 MPI", "55 kW – 1.1 CRDi", "66 kW – 1.4 CRDi"] },
      { label: "i20 III BC3 (2020–)", powers: ["62 kW – 1.2 MPI", "74 kW – 1.0 T-GDi", "88 kW – 1.0 T-GDi MHEV", "150 kW – 1.6 T-GDi N"] },

      // ── i30 ──────────────────────────────────────────────────────────────────
      { group: "i30" },
      { label: "i30 I FD (2007–2012)", powers: ["80 kW – 1.4 CVVT", "90 kW – 1.6 CVVT", "105 kW – 2.0 CVVT", "66 kW – 1.6 CRDi", "85 kW – 1.6 CRDi", "100 kW – 2.0 CRDi"] },
      { label: "i30 II GD (2012–2017)", powers: ["74 kW – 1.4 MPI", "99 kW – 1.6 GDi", "88 kW – 1.0 T-GDi", "137 kW – 1.6 T-GDi Turbo", "66 kW – 1.4 CRDi", "81 kW – 1.6 CRDi", "100 kW – 1.6 CRDi"] },
      { label: "i30 III PD (2017–)", powers: ["88 kW – 1.0 T-GDi", "103 kW – 1.4 T-GDi", "117 kW – 1.5 T-GDi", "206 kW – 2.0 T-GDi N", "85 kW – 1.6 CRDi", "100 kW – 1.6 CRDi"] },

      // ── i40 ─────────────────────────────────────────────────────────────────
      { group: "i40" },
      { label: "i40 (2011–2019)", powers: ["99 kW – 1.6 GDi", "130 kW – 2.0 GDi", "100 kW – 1.7 CRDi", "104 kW – 1.7 CRDi", "136 kW – 2.0 CRDi"] },

      // ── ix20 ────────────────────────────────────────────────────────────────
      { group: "ix20" },
      { label: "ix20 (2010–2019)", powers: ["66 kW – 1.4 MPI", "92 kW – 1.6 MPI", "57 kW – 1.4 CRDi", "66 kW – 1.6 CRDi"] },

      // ── Coupe / Genesis / Veloster ──────────────────────────────────────────
      { group: "Coupe / Genesis / Veloster" },
      { label: "Coupe GK / Tuscani (2001–2009)" },
      { label: "Genesis Coupe BK (2008–2012)", powers: ["154 kW – 2.0 Turbo"] },
      { group: "Genesis" },
      { label: "Genesis Sportlimousine DH (2015–2016)", powers: ["232 kW – 3.8 V6 GDI AWD"] },
      { group: "Veloster" },
      { label: "Veloster I FS (2011–2018)", powers: ["137 kW – 1.6 T-GDi Turbo"] },

      // ── Tucson ───────────────────────────────────────────────────────────────
      { group: "Tucson" },
      { label: "Tucson I JM (2004–2010)" },
      { label: "Tucson II LM / ix35 (2009–2015)", powers: ["122 kW – 2.0 GDi", "100 kW – 1.7 CRDi", "135 kW – 2.0 CRDi"] },
      { label: "Tucson III TL (2015–2020)", powers: ["97 kW – 1.6 GDi", "130 kW – 1.6 T-GDi", "85 kW – 1.6 CRDi", "100 kW – 1.7 CRDi", "136 kW – 2.0 CRDi"] },
      { label: "Tucson IV NX4 (2021–)", powers: ["110 kW – 1.6 T-GDi", "132 kW – 1.6 T-GDi MHEV", "169 kW – 1.6 T-GDi HEV", "195 kW – 1.6 T-GDi PHEV", "85 kW – 1.6 CRDi", "100 kW – 1.6 CRDi MHEV"] },

      // ── Santa Fe ─────────────────────────────────────────────────────────────
      { group: "Santa Fe" },
      { label: "Santa Fe I SM (2000–2006)" },
      { label: "Santa Fe II CM (2006–2012)" },
      { label: "Santa Fe III DM (2012–2018)", powers: ["138 kW – 2.4 GDi", "176 kW – 2.0 T-GDi", "110 kW – 2.0 CRDi", "145 kW – 2.2 CRDi"] },
      { label: "Santa Fe IV TM (2018–dosud)", powers: ["136 kW – 2.4 GDi", "169 kW – 1.6 T-GDi HEV", "195 kW – 1.6 T-GDi PHEV", "110 kW – 2.0 CRDi", "147 kW – 2.2 CRDi"] },
      { label: "Santa Fe V MX5 (2024–dosud)", powers: ["158 kW – 1.6 T-GDi HEV", "186 kW – 1.6 T-GDi PHEV"] },

      // ── Kona ─────────────────────────────────────────────────────────────────
      { group: "Kona" },
      { label: "Kona I OS (2017–2023)", powers: ["88 kW – 1.0 T-GDi", "130 kW – 1.6 T-GDi", "104 kW – 1.6 GDi HEV", "85 kW – 1.6 CRDi", "100 kW – Electric 39 kWh", "150 kW – Electric 64 kWh"] },
      { label: "Kona II SX2 (2023–)", powers: ["88 kW – 1.0 T-GDi", "104 kW – 1.6 GDi HEV", "115 kW – Electric 48 kWh", "160 kW – Electric 65 kWh"] },

      // ── Bayon ─────────────────────────────────────────────────────────────────
      { group: "Bayon" },
      { label: "Bayon (2021–dosud)", powers: ["62 kW – 1.2 MPI", "74 kW – 1.0 T-GDi", "88 kW – 1.0 T-GDi MHEV"] },

      // ── IONIQ (liftback) ────────────────────────────────────────────────────
      { group: "IONIQ (liftback)" },
      { label: "IONIQ AE (2016–2022)", powers: ["104 kW – 1.6 GDi HEV", "104 kW – 1.6 GDi PHEV", "100 kW – Electric 38 kWh"] },

      // ── IONIQ 5 / IONIQ 6 ────────────────────────────────────────────────────
      { group: "IONIQ" },
      { label: "IONIQ 5 NE (2021–dosud)", powers: ["125 kW – Standard Range RWD", "168 kW – Long Range RWD", "239 kW – Long Range AWD", "448 kW – N AWD"] },
      { label: "IONIQ 6 CE (2022–dosud)", powers: ["111 kW – Standard Range RWD", "168 kW – Long Range RWD", "239 kW – Long Range AWD"] },

      // ── INSTER ───────────────────────────────────────────────────────────────
      { group: "INSTER" },
      { label: "INSTER (2024–dosud)", powers: ["71.1 kW – Electric 42 kWh", "85.5 kW – Electric 49 kWh"] },
    ],
  },

  // ── Mercedes-Benz ──────────────────────────────────────────────────────────

  {
    brand:     "Mercedes-Benz",
    active:    true,
    expertise: "Mercedes-Benz osobní a užitková vozidla hlavních post-2000 modelových řad (A, B, C, E, CLA, CLS, SLK/SLC, GLA, GLK, GLC, ML/GLE, Sprinter, Vito, Citan) — motory M111/M271/M270/M260/M264/M282/M133/M139 benzín, OM611/OM646/OM651/OM654/OM656 diesel, elektrické pohony od roku 2000, EU spec (BlueTEC, AdBlue, DPF Euro 5/6, SCR)",
    models: [
      // ── A-Class ────────────────────────────────────────────────────────────────
      { group: "A-Class" },
      { label: "A-Class W169 (2004–2012)" },
      { label: "A-Class W176 (2012–2018)", powers: ["75 kW – A160 1.6 (M270)", "90 kW – A180 1.6 (M270)", "115 kW – A200 1.6 (M270)", "155 kW – A250 2.0 (M270)", "265 kW – A45 AMG 2.0 (M133)", "280 kW – A45 AMG FL 2.0 (M133)", "80 kW – A160d 1.5 (OM607)", "80 kW – A180d 1.5 (OM607)", "100 kW – A180d 1.5 (OM607)", "100 kW – A200d 2.1 (OM651)", "130 kW – A220d 2.1 (OM651)"] },
      { label: "A-Class W177 (2018–současnost)", powers: ["80 kW – A160 1.3 (M282)", "100 kW – A180 1.3 (M282)", "120 kW – A200 1.3 (M282)", "165 kW – A250 2.0 (M260)", "225 kW – A35 AMG 2.0 (M260)", "306 kW – A45 S AMG 2.0 (M139)", "85 kW – A180d 1.5 (OM608)", "110 kW – A200d 2.0 (OM654)", "140 kW – A220d 2.0 (OM654)"] },

      // ── B-Class ────────────────────────────────────────────────────────────────
      { group: "B-Class" },
      { label: "B-Class W245 (2005–2011)" },
      { label: "B-Class W246 (2011–2018)", powers: ["75 kW – B160 1.6 (M270)", "90 kW – B180 1.6 (M270)", "115 kW – B200 1.6 (M270)", "155 kW – B250 2.0 (M270)", "80 kW – B160d 1.5 (OM607)", "80 kW – B180d 1.5 (OM607)", "100 kW – B180d 1.5 (OM607)", "100 kW – B200d 2.1 (OM651)", "130 kW – B220d 2.1 (OM651)"] },
      { label: "B-Class W247 (2018–současnost)", powers: ["80 kW – B160 1.3 (M282)", "100 kW – B180 1.3 (M282)", "120 kW – B200 1.3 (M282)", "165 kW – B250 2.0 (M260)", "85 kW – B180d 1.5 (OM608)", "110 kW – B200d 2.0 (OM654)", "140 kW – B220d 2.0 (OM654)"] },

      // ── C-Class ────────────────────────────────────────────────────────────────
      { group: "C-Class" },
      { label: "C-Class W203 (2000–2007)" },
      { label: "C-Class SportCoupé C203 (2001–2008)" },
      { label: "C-Class W204 (2007–2014)", powers: ["115 kW – C180 1.8 K (M271)", "135 kW – C200 1.8 K (M271)", "125 kW – C200 CGI 1.8 (M271)", "150 kW – C250 CGI 1.8 (M271)", "170 kW – C300 3.0 (M272)", "170 kW – C350 3.5 (M272)", "336 kW – C63 AMG 6.2 (M156)", "350 kW – C63 AMG FL 6.2 (M156)", "100 kW – C200 CDI 2.1 (OM651)", "125 kW – C220 CDI 2.1 (OM651)", "150 kW – C250 CDI 2.1 (OM651)", "150 kW – C250 BlueTEC 2.1 (OM651)", "170 kW – C300 CDI 3.0 (OM642)"] },
      { label: "C-Class Coupé C204 (2011–2015)" },
      { label: "CLC CL203 (2008–2011)" },
      { label: "C-Class W205 (2014–2021)", powers: ["115 kW – C180 1.6 (M274)", "135 kW – C200 2.0 (M274)", "155 kW – C250 2.0 (M274)", "180 kW – C300 2.0 (M274)", "270 kW – C43 AMG 3.0 V6 (M276)", "350 kW – C63 AMG 4.0 V8 (M177)", "375 kW – C63 S AMG 4.0 V8 (M177)", "90 kW – C160d 1.6 (OM626)", "100 kW – C180d 1.6 (OM626)", "125 kW – C220d 2.0 (OM654)", "143 kW – C220d FL 2.0 (OM654)", "140 kW – C250d 2.1 (OM651)", "173 kW – C300d 2.0 (OM654)", "190 kW – C300de 2.0 PHEV (OM654)"] },
      { label: "C-Class W206 (2021–současnost)", powers: ["125 kW – C180 1.5 (M254)", "150 kW – C200 1.5 (M254)", "190 kW – C300 2.0 (M254)", "280 kW – C43 AMG 2.0 (M139)", "350 kW – C63 S AMG 2.0 PHEV (M139)", "125 kW – C200d 2.0 (OM654M)", "147 kW – C220d 2.0 (OM654M)", "195 kW – C300d 2.0 (OM654M)", "230 kW – C300de 2.0 PHEV (OM654M)"] },

      // ── E-Class ────────────────────────────────────────────────────────────────
      { group: "E-Class" },
      { label: "E-Class W211 (2002–2009)" },
      { label: "E-Class W212 (2009–2016)", powers: ["135 kW – E200 1.8 CGI (M271)", "150 kW – E250 1.8 CGI (M271)", "155 kW – E250 2.0 (M274)", "185 kW – E300 3.5 (M276)", "225 kW – E400 3.0 V6 (M276)", "300 kW – E500 4.7 V8 (M278)", "386 kW – E63 AMG 5.5 V8 (M157)", "100 kW – E200 CDI 2.1 (OM651)", "125 kW – E220 CDI 2.1 (OM651)", "150 kW – E250 CDI 2.1 (OM651)", "150 kW – E250 BlueTEC 2.1 (OM651)", "170 kW – E300 BlueTEC 3.0 (OM642)", "190 kW – E350 BlueTEC 3.0 (OM642)"] },
      { label: "E-Class W213 (2016–současnost)", powers: ["135 kW – E200 2.0 (M264)", "145 kW – E200 2.0 FL (M254)", "190 kW – E300 2.0 (M264)", "270 kW – E43 AMG 3.0 V6 (M276)", "310 kW – E53 AMG 3.0 I6 (M256)", "420 kW – E63 S AMG 4.0 V8 (M177)", "120 kW – E200d 2.0 (OM654)", "143 kW – E220d 2.0 (OM654)", "195 kW – E300d 2.0 (OM654)", "210 kW – E350d 3.0 (OM656)", "243 kW – E400d 3.0 (OM656)", "225 kW – E300de 2.0 PHEV (OM654)", "240 kW – E300e 2.0 PHEV (M254)"] },

      // ── GLA ────────────────────────────────────────────────────────────────────
      { group: "GLA" },
      { label: "GLA X156 (2013–2020)" },
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
      { label: "Sprinter VS30 (2018–současnost)" },
      { label: "Sprinter W907/W910 2.1 CDI (2018–současnost)", powers: ["84 kW – 211/311/411/511 CDI (OM651)", "105 kW – 214/314/414/514 CDI (OM651)", "120 kW – 216/316/416/516 CDI (OM651)", "140 kW – 219/319/419/519 CDI (OM651)"] },
      { label: "eSprinter Electric (2023–současnost)", powers: ["85 kW – eSprinter Electric", "100 kW – eSprinter Electric"] },

      // ── Vito ────────────────────────────────────────────────────────────────────
      { group: "Vito" },
      { label: "Vito / Viano W639 (2003–2014)" },
      { label: "Vito W447 (2014–současnost)", powers: ["65 kW – 109 CDI 1.6 (OM622)", "75 kW – 111 CDI 1.6 (OM622)", "100 kW – 114 CDI 2.1 (OM651)", "120 kW – 116 CDI 2.1 (OM651)", "140 kW – 119 CDI 2.1 (OM651)", "100 kW – 114 CDI 2.0 FL (OM654)", "120 kW – 116 CDI 2.0 FL (OM654)", "143 kW – 119 CDI 2.0 FL (OM654)", "150 kW – 124 CDI 2.0 FL (OM654)", "100 kW – eVito Electric"] },

      // ── CLA ────────────────────────────────────────────────────────────────────
      { group: "CLA" },
      { label: "CLA C117 (2013–2019)", powers: ["90 kW – CLA 180 1.6 (M270)", "115 kW – CLA 200 1.6 (M270)", "155 kW – CLA 250 2.0 (M270)", "265 kW – CLA 45 AMG 2.0 (M133)", "280 kW – CLA 45 AMG FL 2.0 (M133)", "80 kW – CLA 180d 1.5 (OM607)", "100 kW – CLA 200d 2.1 (OM651)", "130 kW – CLA 220d 2.1 (OM651)"] },
      { label: "CLA C118 (2019–současnost)", powers: ["100 kW – CLA 180 1.3 (M282)", "120 kW – CLA 200 1.3 (M282)", "165 kW – CLA 250 2.0 (M260)", "225 kW – CLA 35 AMG 2.0 (M260)", "306 kW – CLA 45 S AMG 2.0 (M139)", "85 kW – CLA 180d 1.5 (OM608)", "110 kW – CLA 200d 2.0 (OM654)", "140 kW – CLA 220d 2.0 (OM654)"] },

      // ── CLK / CLE / roadsters ───────────────────────────────────────────────
      { group: "CLK / CLE / roadsters" },
      { label: "CLK W209 (2002–2009)" },
      { label: "CLE C/A236 (2023–dosud)" },
        { label: "AMG GT C190 / R190 (2014–2021)" },
        { label: "AMG GT X290 (2018–současnost)" },
        { label: "SL R230 (2001–2011)" },
        { label: "SL R231 (2012–2020)" },
        { label: "SL R232 (2022–současnost)", powers: ["280 kW – SL 43 2.0 (M139)", "350 kW – SL 55 AMG 4.0 V8 (M177)", "430 kW – SL 63 AMG 4.0 V8 (M177)", "600 kW – SL 63 S E Performance 4.0 PHEV (M177)"] },
        { label: "SLK R171 (2004–2011)" },
        { label: "SLK R172 (2011–2016)" },
        { label: "SLC R172 (2016–2020)" },

      // ── CLS / CL / S-Class Coupé ────────────────────────────────────────────
      { group: "CLS / CL / S-Class Coupé" },
      { label: "CL C216 (2006–2013)" },
      { label: "CLS C219 (2004–2010)" },
      { label: "CLS C218 / X218 (2010–2018)" },
      { label: "CLS C257 (2018–2023)" },
      { label: "S-Class Coupé / Cabrio C/A217 (2014–2020)" },

        // ── R-Class / ML / GL / GLK ────────────────────────────────────────────
        { group: "R-Class / ML / GL / GLK" },
        { label: "R-Class W251 (2005–2013)" },
        { label: "ML-Class W164 (2005–2011)" },
        { label: "ML-Class W166 (2011–2015)" },
        { label: "GL-Class X164 (2006–2012)" },
        { label: "GLK X204 (2008–2015)" },

        // ── G-Class ───────────────────────────────────────────────────────────────
        { group: "G-Class" },
        { label: "G-Class W463 (2000–2018)" },
        { label: "G-Class W463A (2018–současnost)", powers: ["310 kW – G 500 / G 550 4.0 V8 (M176)", "430 kW – G 63 AMG 4.0 V8 (M177)", "432 kW – G 580 EQ Electric"] },

        // ── GLE ────────────────────────────────────────────────────────────────────
        { group: "GLE" },
        { label: "GLE W166/C292 (2015–2019)", powers: ["155 kW – GLE 250d 2.1 (OM651)", "150 kW – GLE 300d 2.0 (OM654)", "190 kW – GLE 350d 3.0 (OM642)", "200 kW – GLE 400 3.0 (M276)", "270 kW – GLE 43 AMG 3.0 (M276)", "375 kW – GLE 63 AMG 5.5 (M157)", "410 kW – GLE 63 S AMG 5.5 (M157)"] },
      { label: "GLE V167/C167 (2019–současnost)", powers: ["190 kW – GLE 300d 2.0 (OM654)", "210 kW – GLE 350d 3.0 (OM656)", "243 kW – GLE 400d 3.0 (OM656)", "200 kW – GLE 350 2.0 (M264)", "270 kW – GLE 450 3.0 (M256)", "280 kW – GLE 53 AMG 3.0 (M256)", "420 kW – GLE 63 S AMG 4.0 (M177)", "245 kW – GLE 350de PHEV (OM654)"] },

      // ── GLS ────────────────────────────────────────────────────────────────────
      { group: "GLS" },
      { label: "GL / GLS X166 (2012–2019)" },
      { label: "GLS X167 (2019–současnost)", powers: ["243 kW – GLS 400d 3.0 (OM656)", "270 kW – GLS 450 3.0 (M256)", "390 kW – GLS 580 4.0 (M176)", "450 kW – GLS 63 AMG 4.0 (M177)"] },

      // ── S-Class ────────────────────────────────────────────────────────────────
      { group: "S-Class" },
      { label: "S-Class W221 (2005–2013)", powers: ["200 kW – S350 3.5 (M272)", "285 kW – S500 5.5 (M273)", "380 kW – S63 AMG 6.2 (M156)", "450 kW – S65 AMG 6.0 (M275)", "173 kW – S320 CDI 3.0 (OM642)", "195 kW – S350 CDI 3.0 (OM642)", "250 kW – S350 BlueTEC 3.0 (OM642)", "310 kW – S500 4.7 (M278)"] },
      { label: "S-Class W222 (2013–2020)", powers: ["245 kW – S400 3.0 (M276)", "335 kW – S500 4.7 (M278)", "430 kW – S63 AMG 5.5 (M157)", "463 kW – S65 AMG 6.0 (M279)", "190 kW – S350d 2.9 (OM656)", "243 kW – S400d 2.9 (OM656)", "350 kW – S560 4.0 (M176)", "160 kW – S300h Hybrid (OM651)"] },
      { label: "S-Class W223 (2020–současnost)", powers: ["220 kW – S350d 2.9 (OM656)", "243 kW – S400d 2.9 (OM656)", "270 kW – S450 3.0 (M256)", "320 kW – S500 3.0 (M256)", "450 kW – S63 AMG E 4.0 PHEV (M177)", "380 kW – S580 4.0 (M176)"] },

      // ── V-Class ────────────────────────────────────────────────────────────────
      { group: "V-Class" },
      { label: "V-Class W447 (2014–současnost)", powers: ["100 kW – V200d 2.0 (OM654)", "120 kW – V220d 2.0 (OM654)", "143 kW – V250d 2.0 (OM654)", "150 kW – V300d 2.0 (OM654)", "100 kW – EQV Electric"] },

      // ── Vaneo ────────────────────────────────────────────────────────────────
      { group: "Vaneo" },
      { label: "Vaneo W414 (2001–2005)" },

      // ── Citan / T-Class ─────────────────────────────────────────────────────
      { group: "Citan / T-Class" },
      { label: "Citan I (2012–2021)", powers: ["55 kW – 108 CDI 1.5 (K9K)", "66 kW – 109 CDI 1.5 (K9K)", "81 kW – 111 CDI 1.5 (K9K)", "75 kW – 112 1.2 (H5Ft)"] },
      { label: "Citan / T-Class II (2022–současnost)", powers: ["75 kW – T160 1.3 (M282)", "96 kW – T180 1.3 (M282)", "85 kW – T160d 1.5 (OM608)", "70 kW – eCitan Electric", "90 kW – EQT Electric"] },

      // ── EQ (elektro) ───────────────────────────────────────────────────────
      { group: "EQ (elektro)" },
      { label: "EQA H243 (2021–současnost)", powers: ["140 kW – EQA 250", "168 kW – EQA 300 4MATIC", "215 kW – EQA 350 4MATIC"] },
      { label: "EQB X243 (2021–současnost)", powers: ["110 kW – EQB 250 Electric", "168 kW – EQB 300 Electric", "215 kW – EQB 350 Electric"] },
      { label: "EQC N293 (2019–2023)", powers: ["300 kW – EQC 400 4MATIC"] },
      { label: "EQE V295 (2022–současnost)", powers: ["215 kW – EQE 300", "292 kW – EQE 350+", "460 kW – EQE 53 AMG 4MATIC+"] },
      { label: "EQS V297 (2021–současnost)", powers: ["245 kW – EQS 350+", "265 kW – EQS 450+", "360 kW – EQS 580 4MATIC", "484 kW – EQS 53 AMG 4MATIC+"] },
    ],
  },

  {
    brand:     "Citroën",
    active:    true,
    expertise: "Citroën osobní a užitková vozidla hlavních post-2000 modelových řad (C2, C3, C3 Picasso, C3 Aircross, C4, C4 Picasso, C4 Cactus, C5, C5 Aircross, C6, C8, Berlingo, Nemo, Jumpy, Jumper, DS) — motory PureTech, VTi, THP, HDi, BlueHDi a elektrické pohony od roku 2002 do současnosti, EU spec (AdBlue, DPF Euro 5/6, SCR)",
    models: [
      // ── C1 ─────────────────────────────────────────────────────────────────────
      { group: "C1" },
      { label: "C1 I (2005–2014)", powers: ["50 kW – 1.0 VVT-i", "51 kW – 1.4 HDi"] },
      { label: "C1 II (2014–2022)", powers: ["51 kW – 1.0 VTi", "53 kW – 1.0 VTi", "60 kW – 1.2 PureTech"] },

      // ── C2 ─────────────────────────────────────────────────────────────────────
      { group: "C2" },
      { label: "C2 (2003–2009)", powers: ["44 kW – 1.1i", "54 kW – 1.4i", "66 kW – 1.6i 16V", "92 kW – 1.6 VTS", "50 kW – 1.4 HDi", "66 kW – 1.6 HDi"] },

      // ── C3 ─────────────────────────────────────────────────────────────────────
      { group: "C3" },
      { label: "C3 I (2002–2009)", powers: ["44 kW – 1.1i", "54 kW – 1.4i", "65 kW – 1.4 16V", "80 kW – 1.6 16V", "50 kW – 1.4 HDi", "66 kW – 1.4 HDi", "80 kW – 1.6 HDi"] },
      { label: "C3 II (2009–2016)", powers: ["54 kW – 1.0 VTi", "60 kW – 1.2 VTi", "70 kW – 1.4 VTi", "88 kW – 1.6 VTi", "68 kW – 1.4 HDi", "50 kW – 1.4 HDi", "66 kW – 1.6 HDi", "82 kW – 1.6 HDi", "55 kW – 1.4 e-HDi"] },
      { label: "C3 III (2016–současnost)", powers: ["60 kW – 1.2 PureTech", "68 kW – 1.2 PureTech", "81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "55 kW – 1.5 BlueHDi", "75 kW – 1.5 BlueHDi", "100 kW – ë-C3 Electric"] },

      // ── C3 Picasso ─────────────────────────────────────────────────────────────
      { group: "C3 Picasso" },
      { label: "C3 Picasso (2009–2017)", powers: ["70 kW – 1.4 VTi", "88 kW – 1.6 VTi", "68 kW – 1.6 HDi", "84 kW – 1.6 HDi", "85 kW – 1.6 e-HDi"] },

      // ── C3 Aircross ────────────────────────────────────────────────────────────
      { group: "C3 Aircross" },
      { label: "C3 Aircross (2017–současnost)", powers: ["60 kW – 1.2 PureTech", "81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "55 kW – 1.5 BlueHDi", "75 kW – 1.5 BlueHDi", "96 kW – 1.5 BlueHDi"] },

      // ── C4 ─────────────────────────────────────────────────────────────────────
      { group: "C4" },
      { label: "C4 I (2004–2010)", powers: ["65 kW – 1.4i 16V", "80 kW – 1.6i 16V", "105 kW – 2.0i 16V", "66 kW – 1.6 HDi", "80 kW – 2.0 HDi", "100 kW – 2.0 HDi"] },
      { label: "C4 II (2010–2018)", powers: ["70 kW – 1.4 VTi", "88 kW – 1.6 VTi", "110 kW – 1.6 THP", "115 kW – 1.6 THP", "68 kW – 1.6 HDi", "82 kW – 1.6 HDi", "84 kW – 1.6 BlueHDi", "73 kW – 1.6 e-HDi", "100 kW – 2.0 HDi", "110 kW – 2.0 BlueHDi"] },
      { label: "C4 III / ë-C4 (2020–současnost)", powers: ["75 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "114 kW – 1.2 PureTech", "96 kW – 1.5 BlueHDi", "100 kW – ë-C4 Electric", "115 kW – ë-C4 Electric"] },

      // ── C4 Picasso / SpaceTourer ──────────────────────────────────────────────
      { group: "C4 Picasso / SpaceTourer" },
      { label: "C4 Picasso / Grand C4 Picasso I (2006–2013)", powers: ["88 kW – 1.6 VTi", "103 kW – 1.8i 16V", "105 kW – 2.0i 16V", "80 kW – 1.6 HDi", "100 kW – 2.0 HDi", "110 kW – 2.0 HDi"] },
      { label: "C4 Picasso / Grand C4 Picasso II / SpaceTourer (2013–2022)", powers: ["88 kW – 1.6 VTi", "121 kW – 1.6 THP", "96 kW – 1.2 PureTech", "73 kW – 1.6 e-HDi", "88 kW – 1.6 BlueHDi", "110 kW – 2.0 BlueHDi"] },

      // ── C4 Cactus ──────────────────────────────────────────────────────────────
      { group: "C4 Cactus" },
      { label: "C4 Cactus (2014–2020)", powers: ["55 kW – 1.2 PureTech", "60 kW – 1.2 PureTech", "68 kW – 1.2 PureTech", "81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "73 kW – 1.5 BlueHDi", "68 kW – 1.6 BlueHDi", "75 kW – 1.6 BlueHDi"] },

      // ── C5 Aircross ────────────────────────────────────────────────────────────
      { group: "C5 Aircross" },
      { label: "C5 Aircross (2018–současnost)", powers: ["96 kW – 1.2 PureTech", "114 kW – 1.2 PureTech", "132 kW – 1.6 PureTech", "165 kW – 1.6 PHEV Hybrid", "225 kW – 1.6 PHEV Hybrid4", "96 kW – 1.5 BlueHDi", "118 kW – 2.0 BlueHDi", "130 kW – 2.0 BlueHDi"] },

      // ── C6 / C8 / C-Crosser ───────────────────────────────────────────────────
      { group: "C6 / C8 / C-Crosser" },
      { label: "C6 (2005–2012)", powers: ["155 kW – 3.0 V6 petrol", "150 kW – 2.7 V6 HDi", "177 kW – 3.0 V6 HDi"] },
      { label: "C8 (2002–2014)", powers: ["100 kW – 2.0 16V", "103 kW – 2.0 Turbo", "118 kW – 3.0 V6", "79 kW – 2.0 HDi", "94 kW – 2.2 HDi", "125 kW – 2.2 HDi", "150 kW – 2.2 HDi"] },
      { label: "C-Crosser (2007–2012)", powers: ["108 kW – 2.4i 16V", "115 kW – 2.2 HDi", "130 kW – 2.2 HDi"] },

      // ── C5 III ───────────────────────────────────────────────────────────────
      { group: "C5 III" },
      { label: "C5 III (2008–2017)", powers: ["115 kW – 1.6 THP", "121 kW – 1.6 THP", "110 kW – 1.6 VTi", "100 kW – 1.6 HDi", "82 kW – 1.6 e-HDi", "100 kW – 2.0 HDi", "110 kW – 2.0 HDi", "120 kW – 2.0 HDi", "133 kW – 2.0 BlueHDi", "150 kW – 2.2 HDi", "155 kW – 3.0 V6 HDi"] },

      // ── C5 X ─────────────────────────────────────────────────────────────────
      { group: "C5 X" },
      { label: "C5 X (2022–současnost)", powers: ["96 kW – 1.2 PureTech", "132 kW – 1.6 PureTech", "165 kW – 1.6 PHEV Hybrid", "225 kW – 1.6 PHEV Hybrid4", "96 kW – 1.5 BlueHDi"] },

      // ── Berlingo ───────────────────────────────────────────────────────────────
      { group: "Berlingo" },
      { label: "Berlingo II (2008–2018)", powers: ["54 kW – 1.4 (TU3)", "72 kW – 1.6 VTi", "88 kW – 1.6 VTi", "50 kW – 1.6 HDi", "55 kW – 1.6 HDi", "66 kW – 1.6 HDi", "68 kW – 1.6 HDi", "82 kW – 1.6 BlueHDi", "73 kW – 1.5 BlueHDi", "75 kW – 1.5 BlueHDi"] },
      { label: "Berlingo III (2018–současnost)", powers: ["81 kW – 1.2 PureTech", "96 kW – 1.2 PureTech", "55 kW – 1.5 BlueHDi", "75 kW – 1.5 BlueHDi", "96 kW – 1.5 BlueHDi", "100 kW – ë-Berlingo Electric"] },

      // ── Nemo ───────────────────────────────────────────────────────────────────
      { group: "Nemo" },
      { label: "Nemo / Nemo Multispace (2008–2017)", powers: ["54 kW – 1.4i", "54 kW – 1.4i Natural Power", "50 kW – 1.3 HDi", "55 kW – 1.3 HDi"] },

      // ── Jumpy (Dispatch) ───────────────────────────────────────────────────────
      { group: "Jumpy" },
      { label: "Jumpy II (2007–2016)", powers: ["66 kW – 1.6 HDi", "88 kW – 2.0 HDi", "100 kW – 2.0 HDi", "120 kW – 2.0 HDi"] },
      { label: "Jumpy III (2016–současnost)", powers: ["75 kW – 1.5 BlueHDi", "88 kW – 1.5 BlueHDi", "110 kW – 2.0 BlueHDi", "130 kW – 2.0 BlueHDi", "100 kW – ë-Jumpy Electric"] },

      // ── Jumper (Relay) ─────────────────────────────────────────────────────────
      { group: "Jumper" },
      { label: "Jumper III 2.2 HDi (2006–2016)", powers: ["74 kW – 2.2 HDi", "88 kW – 2.2 HDi", "96 kW – 2.2 HDi", "110 kW – 2.2 HDi", "120 kW – 3.0 HDi"] },
      { label: "Jumper III 2.0/2.2 BlueHDi (2016–současnost)", powers: ["81 kW – 2.0 BlueHDi", "88 kW – 2.2 BlueHDi", "103 kW – 2.2 BlueHDi", "121 kW – 2.2 BlueHDi", "100 kW – ë-Jumper Electric"] },

      // ── DS (Citroën era) ──────────────────────────────────────────────────────
      { group: "DS (Citroën era)" },
      { label: "DS3 (2010–2019)", powers: ["60 kW – 1.2 VTi", "70 kW – 1.6 VTi", "88 kW – 1.6 VTi", "115 kW – 1.6 THP", "152 kW – 1.6 THP Racing", "68 kW – 1.6 HDi", "82 kW – 1.6 e-HDi"] },
      { label: "DS4 (2011–2018)", powers: ["88 kW – 1.6 VTi", "115 kW – 1.6 THP", "147 kW – 1.6 THP", "82 kW – 1.6 e-HDi", "88 kW – 1.6 BlueHDi", "120 kW – 2.0 BlueHDi"] },
      { label: "DS5 (2011–2018)", powers: ["115 kW – 1.6 THP", "147 kW – 1.6 THP", "120 kW – 2.0 HDi", "133 kW – 2.0 BlueHDi", "147 kW – 2.0 Hybrid4"] },
    ],
  },

  {
    brand:     "Nissan",
    active:    true,
    expertise: "Nissan osobní a užitková vozidla hlavních post-2000 modelových řad (Almera, Primera, Micra, Note, Juke, Qashqai, X-Trail, Murano, Leaf, Ariya, Navara, Patrol, 350Z/370Z/Z, GT-R, Pulsar, Tiida, NV200, NV300) — motory QG/QR/HR/MR/VQ/VR/YD/K9K/R9M benzín a diesel, e-POWER a elektrické pohony, EU a hlavní globální specifikace od roku 2000 do současnosti",
    models: [
      // ── Almera / Primera ──────────────────────────────────────────────────────
      { group: "Almera / Primera" },
      { label: "Almera N16 (2000–2006)", powers: ["66 kW – 1.5 QG15DE", "84 kW – 1.8 QG18DE", "81 kW – 2.2 Di YD22DDTi", "100 kW – 2.2 dCi YD22DDTi"] },
      { label: "Almera Tino V10 (2000–2006)", powers: ["84 kW – 1.8 QG18DE", "100 kW – 2.0 QR20DE", "81 kW – 2.2 Di YD22DDTi", "100 kW – 2.2 dCi YD22DDTi"] },
      { label: "Primera P12 (2001–2007)", powers: ["80 kW – 1.6 QG16DE", "85 kW – 1.8 QG18DE", "103 kW – 2.0 QR20DE", "93 kW – 2.2 dCi YD22DDTi", "102 kW – 2.2 dCi YD22DDTi"] },

      // ── Micra ──────────────────────────────────────────────────────────────────
      { group: "Micra" },
      { label: "Micra K12 (2002–2010)", powers: ["48 kW – 1.2 CR12DE", "59 kW – 1.2 CR12DE", "65 kW – 1.4 CR14DE", "81 kW – 1.6 HR16DE", "60 kW – 1.5 dCi K9K"] },
      { label: "Micra K13 (2010–2017)", powers: ["54 kW – 1.2 HR12DE", "72 kW – 1.2 DIG-S HR12DDR", "48 kW – 1.5 dCi K9K"] },
      { label: "Micra K14 (2017–současnost)", powers: ["52 kW – 0.9 IG-T H4Bt", "71 kW – 0.9 IG-T H4Bt", "73 kW – 1.0 IG-T HR10DET", "86 kW – 1.0 IG-T HR10DET", "55 kW – 1.5 dCi K9K"] },

      // ── Note ───────────────────────────────────────────────────────────────────
      { group: "Note" },
      { label: "Note E11 (2006–2013)", powers: ["65 kW – 1.4 CR14DE", "81 kW – 1.6 HR16DE", "50 kW – 1.5 dCi K9K", "63 kW – 1.5 dCi K9K"] },
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
      { label: "X-Trail T30 (2001–2007)", powers: ["103 kW – 2.0 QR20DE", "121 kW – 2.5 QR25DE", "84 kW – 2.2 Di YD22DDTi", "100 kW – 2.2 dCi YD22DDTi"] },
      { label: "X-Trail T31 (2007–2013)", powers: ["104 kW – 2.0 MR20DE", "124 kW – 2.5 QR25DE", "110 kW – 2.0 dCi M9R", "127 kW – 2.0 dCi M9R"] },
      { label: "X-Trail T32 (2014–2021)", powers: ["120 kW – 1.6 DIG-T MR16DDT", "126 kW – 2.0 MR20DD", "96 kW – 1.6 dCi R9M", "130 kW – 2.0 dCi M9R"] },
      { label: "X-Trail T33 (2022–současnost)", powers: ["110 kW – 1.5 VC-Turbo KR15DDT", "150 kW – 1.5 VC-Turbo e-POWER", "157 kW – 1.5 VC-Turbo e-POWER e-4ORCE"] },

      // ── Z / GT-R ───────────────────────────────────────────────────────────────
      { group: "Z / GT-R" },
      { label: "350Z Z33 (2002–2009)", powers: ["206 kW – 3.5 V6 VQ35DE", "221 kW – 3.5 V6 VQ35HR", "230 kW – 3.5 V6 VQ35HR Nismo"] },
      { label: "370Z Z34 (2009–2020)", powers: ["241 kW – 3.7 V6 VQ37VHR", "253 kW – 3.7 V6 VQ37VHR Nismo"] },
      { label: "Z RZ34 (2022–současnost)", powers: ["298 kW – 3.0 V6 VR30DDTT", "309 kW – 3.0 V6 VR30DDTT Nismo"] },
      { label: "GT-R R35 (2007–současnost)", powers: ["353 kW – 3.8 V6 VR38DETT", "390 kW – 3.8 V6 VR38DETT", "419 kW – 3.8 V6 VR38DETT Nismo", "447 kW – 3.8 V6 VR38DETT Nismo"] },

      // ── Murano / Tiida / Pulsar / Patrol ─────────────────────────────────────
      { group: "Murano / Tiida / Pulsar / Patrol" },
      { label: "Murano Z50 (2002–2008)", powers: ["172 kW – 3.5 V6 VQ35DE"] },
      { label: "Murano Z51 (2008–2014)", powers: ["188 kW – 3.5 V6 VQ35DE", "140 kW – 2.5 dCi YD25DDTi"] },
      { label: "Tiida C11 (2004–2012)", powers: ["81 kW – 1.6 HR16DE", "93 kW – 1.8 MR18DE", "63 kW – 1.5 dCi K9K"] },
      { label: "Pulsar C13 (2014–2018)", powers: ["85 kW – 1.2 DIG-T HRA2DDT", "140 kW – 1.6 DIG-T MR16DDT", "81 kW – 1.5 dCi K9K"] },
      { label: "Patrol Y62 (2010–současnost)", powers: ["298 kW – 5.6 V8 VK56VD"] },

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

      // ── Ariya ─────────────────────────────────────────────────────────────────
      { group: "Ariya" },
      { label: "Ariya (2022–současnost)", powers: ["160 kW – Electric 63 kWh", "178 kW – Electric 87 kWh", "225 kW – Electric e-4ORCE 87 kWh", "290 kW – Electric e-4ORCE Performance"] },

      // ── Navara ────────────────────────────────────────────────────────────────
      { group: "Navara" },
      { label: "Navara D40 (2006–2015)", powers: ["106 kW – 2.5 dCi YD25DDTi", "126 kW – 2.5 dCi YD25DDTi", "140 kW – 2.5 dCi YD25DDTi", "128 kW – 3.0 dCi V9X"] },
      { label: "Navara D23 (2015–současnost)", powers: ["118 kW – 2.3 dCi M9T", "140 kW – 2.3 dCi M9T BiTurbo"] },
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

      // ── Bravo ───────────────────────────────────────────────────────────────────
      { group: "Bravo" },
      { label: "Bravo II (2007–2014)", powers: ["66 kW – 1.4 FIRE", "88 kW – 1.4 T-Jet", "110 kW – 1.4 T-Jet", "150 kW – 1.4 T-Jet", "77 kW – 1.6 MultiJet", "88 kW – 1.6 MultiJet", "103 kW – 2.0 MultiJet", "120 kW – 2.0 MultiJet"] },

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

  {
    brand:     "Opel",
    active:    true,
    expertise: "Opel osobní a lehká užitková vozidla hlavních post-2000 EU modelových řad (Corsa, Astra, Vectra, Signum, Insignia, Meriva, Antara, Mokka, Crossland, Grandland, Combo, Vivaro, Zafira, Movano, ADAM, KARL, Cascada) — motory Ecotec, Turbo, CDTI, Hybrid a elektrické pohony od roku 2000 do současnosti, EU spec (Euro 4–6d, DPF, SCR, 48V hybridy)",
    models: [
      // ── Corsa ─────────────────────────────────────────────────────────────────
      { group: "Corsa" },
      { label: "Corsa C (2000–2006)", powers: ["44 kW – 1.0 12V", "55 kW – 1.2 16V", "66 kW – 1.4 16V", "92 kW – 1.8 GSi", "48 kW – 1.3 CDTI", "51 kW – 1.7 DI", "74 kW – 1.7 CDTI"] },
      { label: "Corsa D (2006–2014)", powers: ["44 kW – 1.0", "59 kW – 1.2", "66 kW – 1.4", "110 kW – 1.6 Turbo OPC", "55 kW – 1.3 CDTI", "70 kW – 1.3 CDTI", "96 kW – 1.7 CDTI"] },
      { label: "Corsa E (2014–2019)", powers: ["51 kW – 1.2", "66 kW – 1.4", "74 kW – 1.0 Turbo", "85 kW – 1.0 Turbo", "152 kW – 1.6 Turbo OPC", "55 kW – 1.3 CDTI", "70 kW – 1.3 CDTI", "70 kW – 1.4 LPG"] },
      { label: "Corsa F (2019–dosud)", powers: ["55 kW – 1.2", "74 kW – 1.2 Turbo", "96 kW – 1.2 Turbo", "74 kW – 1.2 Hybrid", "100 kW – 1.2 Hybrid", "100 kW – Electric", "115 kW – Electric"] },

      // ── Astra ─────────────────────────────────────────────────────────────────
      { group: "Astra" },
      { label: "Astra H (2004–2010)", powers: ["66 kW – 1.4", "77 kW – 1.6 Twinport", "103 kW – 1.8", "147 kW – 2.0 Turbo OPC", "66 kW – 1.3 CDTI", "74 kW – 1.7 CDTI", "88 kW – 1.9 CDTI", "110 kW – 1.9 CDTI"] },
      { label: "Astra J (2009–2015)", powers: ["74 kW – 1.4 Turbo", "103 kW – 1.4 Turbo", "85 kW – 1.6", "132 kW – 1.6 Turbo", "206 kW – 2.0 Turbo OPC", "70 kW – 1.3 CDTI", "81 kW – 1.7 CDTI", "96 kW – 2.0 CDTI", "121 kW – 2.0 CDTI"] },
      { label: "Astra K (2015–2021)", powers: ["77 kW – 1.0 Turbo", "110 kW – 1.4 Turbo", "147 kW – 1.6 Turbo", "100 kW – 1.6 CDTI"] },
      { label: "Astra L (2021–dosud)", powers: ["81 kW – 1.2 Turbo", "96 kW – 1.2 Turbo", "96 kW – 1.5 Diesel", "133 kW – 1.6 Plug-in Hybrid", "165 kW – 1.6 Plug-in Hybrid GSe", "115 kW – Electric"] },

      // ── Insignia / Signum / Vectra ───────────────────────────────────────────
      { group: "Insignia / Signum / Vectra" },
      { label: "Vectra C (2002–2008)", powers: ["74 kW – 1.6", "90 kW – 1.8", "103 kW – 2.2", "147 kW – 2.0 Turbo", "129 kW – 2.8 V6 Turbo", "74 kW – 1.9 CDTI", "88 kW – 1.9 CDTI", "110 kW – 3.0 V6 CDTI"] },
      { label: "Signum (2003–2008)", powers: ["90 kW – 1.8", "114 kW – 2.2 Direct", "129 kW – 2.8 V6 Turbo", "110 kW – 3.0 V6 CDTI", "88 kW – 1.9 CDTI", "110 kW – 1.9 CDTI"] },
      { label: "Insignia A (2008–2017)", powers: ["103 kW – 1.8", "103 kW – 1.6 Turbo", "125 kW – 1.6 Turbo", "162 kW – 2.0 Turbo", "191 kW – 2.8 V6 Turbo OPC", "81 kW – 2.0 CDTI", "96 kW – 2.0 CDTI", "118 kW – 2.0 CDTI", "143 kW – 2.0 BiTurbo CDTI"] },
      { label: "Insignia B (2017–2022)", powers: ["103 kW – 1.5 Turbo", "147 kW – 2.0 Turbo", "121 kW – 1.6 Diesel", "125 kW – 2.0 Diesel", "154 kW – 2.0 BiTurbo Diesel"] },

      // ── Meriva / Mokka / Antara ──────────────────────────────────────────────
      { group: "Meriva / Mokka / Antara" },
      { label: "Meriva A (2003–2010)", powers: ["55 kW – 1.4", "66 kW – 1.6", "92 kW – 1.8", "74 kW – 1.7 CDTI"] },
      { label: "Meriva B (2010–2017)", powers: ["74 kW – 1.4 Turbo", "88 kW – 1.4 Turbo", "103 kW – 1.4 Turbo", "70 kW – 1.3 CDTI", "81 kW – 1.7 CDTI", "96 kW – 1.7 CDTI"] },
      { label: "Antara (2006–2015)", powers: ["103 kW – 2.4", "123 kW – 3.2 V6", "110 kW – 2.0 CDTI", "120 kW – 2.2 CDTI", "135 kW – 2.2 CDTI"] },
      { label: "Mokka A (2012–2016)", powers: ["85 kW – 1.6", "103 kW – 1.4 Turbo", "100 kW – 1.7 CDTI"] },
      // ── Mokka ────────────────────────────────────────────────────────────────
      { group: "Mokka" },
      { label: "Mokka X (2016–2020)", powers: ["88 kW – 1.4 Turbo", "103 kW – 1.4 Turbo", "100 kW – 1.6 Diesel"] },
      { label: "Mokka B (2021–dosud)", powers: ["100 kW – 1.2 Turbo", "100 kW – 1.2 Hybrid", "100 kW – Electric", "115 kW – Electric"] },

      // ── Crossland ────────────────────────────────────────────────────────────
      { group: "Crossland" },
      { label: "Crossland X (2017–2020)", powers: ["60 kW – 1.2 LPG", "61 kW – 1.2", "81 kW – 1.2 Turbo", "96 kW – 1.2 Turbo", "88 kW – 1.5 Diesel"] },
      { label: "Crossland (2020–2024)", powers: ["61 kW – 1.2", "81 kW – 1.2 Turbo", "96 kW – 1.2 Turbo", "81 kW – 1.5 Diesel", "88 kW – 1.5 Diesel"] },

      // ── Grandland ────────────────────────────────────────────────────────────
      { group: "Grandland" },
      { label: "Grandland I (2017–2024)", powers: ["96 kW – 1.2 Turbo", "88 kW – 1.6 Diesel", "96 kW – 1.5 Diesel", "133 kW – 1.6 Turbo", "165 kW – 1.6 Plug-in Hybrid", "221 kW – Hybrid4"] },
      { label: "Grandland II (2024–dosud)", powers: ["100 kW – 1.2 Hybrid", "143 kW – Plug-in Hybrid", "157 kW – Electric"] },

      // ── Combo ────────────────────────────────────────────────────────────────
      { group: "Combo" },
      { label: "Combo C (2001–2011)", powers: ["66 kW – 1.4", "74 kW – 1.6", "47 kW – 1.3 CDTI", "55 kW – 1.3 CDTI", "74 kW – 1.7 CDTI"] },
      { label: "Combo D (2011–2018)", powers: ["70 kW – 1.4 Turbo", "88 kW – 1.4 Turbo", "66 kW – 1.3 CDTI", "77 kW – 1.6 CDTI", "88 kW – 1.6 CDTI"] },
      { label: "Combo E (2018–dosud)", powers: ["56 kW – 1.5 Diesel", "75 kW – 1.5 Diesel", "96 kW – 1.2 Turbo", "96 kW – 1.5 Diesel", "100 kW – Electric"] },

      // ── Vivaro ───────────────────────────────────────────────────────────────
      { group: "Vivaro" },
      { label: "Vivaro A (2001–2014)", powers: ["66 kW – 1.9 DTI", "74 kW – 1.9 DTI", "84 kW – 2.0 CDTI", "107 kW – 2.5 CDTI"] },
      { label: "Vivaro B (2014–2019)", powers: ["66 kW – 1.6 CDTI", "88 kW – 1.6 CDTI", "103 kW – 1.6 CDTI", "107 kW – 1.6 BiTurbo CDTI"] },
      { label: "Vivaro C (2019–dosud)", powers: ["75 kW – 1.5 Diesel", "88 kW – 1.5 Diesel", "90 kW – 2.0 Diesel", "110 kW – 2.0 Diesel", "130 kW – 2.0 Diesel", "132 kW – 2.2 Diesel", "100 kW – Electric"] },

      // ── Zafira ───────────────────────────────────────────────────────────────
      { group: "Zafira" },
      { label: "Zafira B (2005–2014)", powers: ["77 kW – 1.6", "103 kW – 1.8", "147 kW – 2.0 Turbo OPC", "74 kW – 1.7 CDTI", "88 kW – 1.9 CDTI", "110 kW – 1.9 CDTI"] },
      { label: "Zafira Tourer / Zafira C (2011–2019)", powers: ["88 kW – 1.4 Turbo", "103 kW – 1.4 Turbo", "125 kW – 1.6 Turbo", "81 kW – 1.6 CDTI", "100 kW – 2.0 CDTI", "121 kW – 2.0 BiTurbo CDTI"] },
      { label: "Zafira Life / Zafira Electric (2019–dosud)", powers: ["132 kW – 2.2 Diesel", "100 kW – Electric 50", "100 kW – Electric 75"] },

      // ── ADAM / KARL / Cascada ───────────────────────────────────────────────
      { group: "ADAM / KARL / Cascada" },
      { label: "ADAM (2013–2019)", powers: ["51 kW – 1.2", "64 kW – 1.4", "74 kW – 1.0 Turbo", "85 kW – 1.0 Turbo", "110 kW – 1.4 Turbo S"] },
      { label: "KARL (2015–2019)", powers: ["55 kW – 1.0", "73 kW – 1.0 ecoFLEX"] },
      { label: "Cascada (2013–2019)", powers: ["88 kW – 1.4 Turbo", "103 kW – 1.6 SIDI Turbo", "125 kW – 1.6 SIDI Turbo", "143 kW – 2.0 CDTI", "125 kW – 2.0 BiTurbo CDTI"] },

      // ── Movano ───────────────────────────────────────────────────────────────
      { group: "Movano" },
      { label: "Movano B 2.3 CDTI (2010–2021)", powers: ["74 kW – 2.3 CDTI", "92 kW – 2.3 CDTI", "100 kW – 2.3 CDTI", "107 kW – 2.3 CDTI", "125 kW – 2.3 CDTI"] },
      { label: "Movano C 2.2 Diesel (2021–dosud)", powers: ["88 kW – 2.2 Diesel", "103 kW – 2.2 Diesel", "121 kW – 2.2 Diesel"] },
      { label: "Movano Electric (2021–dosud)", powers: ["90 kW – Electric", "205 kW – Electric"] },
    ],
  },

  {
    brand:     "Mazda",
    active:    true,
    expertise: "Mazda osobní vozy hlavních EU modelových řad (Mazda2 Hybrid, Mazda3, CX-30, CX-5, CX-60) — benzínové e-SKYACTIV jednotky, Mazda M Hybrid a plug-in hybridy od roku 2019 do současnosti, EU spec",
    models: [
      // ── Mazda2 Hybrid ────────────────────────────────────────────────────────
      { group: "Mazda2 Hybrid" },
      { label: "Mazda2 Hybrid (2022–dosud)", powers: ["85 kW – 1.5 Hybrid"] },

      // ── Mazda3 ───────────────────────────────────────────────────────────────
      { group: "Mazda3" },
      { label: "Mazda3 BP (2019–dosud)", powers: ["103 kW – 2.5 e-SKYACTIV G140", "137 kW – 2.0 e-SKYACTIV X186"] },

      // ── CX-30 ────────────────────────────────────────────────────────────────
      { group: "CX-30" },
      { label: "CX-30 DM (2019–dosud)", powers: ["103 kW – 2.5 e-SKYACTIV G140", "137 kW – 2.0 e-SKYACTIV X186"] },

      // ── CX-5 ─────────────────────────────────────────────────────────────────
      { group: "CX-5" },
      { label: "CX-5 KF FL (2022–dosud)", powers: ["121 kW – 2.0 e-SKYACTIV G"] },

      // ── CX-60 ────────────────────────────────────────────────────────────────
      { group: "CX-60" },
      { label: "CX-60 (2022–dosud)", powers: ["241 kW – 2.5 e-SKYACTIV PHEV"] },
    ],
  },

  {
    brand:     "Cupra",
    active:    true,
    expertise: "Cupra osobní vozy hlavních EU modelových řad (Ateca, Leon, Leon Sportstourer, Formentor, Born, Tavascan, Terramar) — motory TSI, eTSI, e-HYBRID a elektrické pohony od roku 2018 do současnosti, EU spec",
    models: [
      // ── Ateca ────────────────────────────────────────────────────────────────
      { group: "Ateca" },
      { label: "Ateca (2018–dosud)", powers: ["221 kW – 2.0 TSI VZ"] },

      // ── Leon ────────────────────────────────────────────────────────────────
      { group: "Leon" },
      { label: "Leon / Leon Sportstourer (2020–dosud)", powers: ["110 kW – 1.5 TSI", "150 kW – 1.5 e-HYBRID", "200 kW – 1.5 e-HYBRID VZ", "221 kW – 2.0 TSI VZ"] },

      // ── Formentor ───────────────────────────────────────────────────────────
      { group: "Formentor" },
      { label: "Formentor (2020–dosud)", powers: ["110 kW – 1.5 TSI", "150 kW – 1.5 e-HYBRID", "195 kW – 2.0 TSI 4Drive VZ", "200 kW – 1.5 e-HYBRID VZ", "245 kW – 2.0 TSI 4Drive VZ"] },

      // ── Born ────────────────────────────────────────────────────────────────
      { group: "Born" },
      { label: "Born (2022–dosud)", powers: ["170 kW – Electric e-Boost", "240 kW – Electric VZ"] },

      // ── Tavascan ────────────────────────────────────────────────────────────
      { group: "Tavascan" },
      { label: "Tavascan (2024–dosud)", powers: ["210 kW – Electric RWD", "250 kW – Electric AWD VZ"] },

      // ── Terramar ────────────────────────────────────────────────────────────
      { group: "Terramar" },
      { label: "Terramar (2025–dosud)", powers: ["110 kW – 1.5 eTSI", "150 kW – 1.5 e-HYBRID", "150 kW – 2.0 TSI 4Drive", "195 kW – 2.0 TSI 4Drive VZ", "200 kW – 1.5 e-HYBRID VZ"] },
    ],
  },

  {
    brand:     "Volvo",
    active:    true,
    expertise: "Volvo elektrifikované osobní vozy hlavních EU modelových řad (EX30, EX40, EC40, XC60, XC90) — mild hybrid, plug-in hybrid a elektrické pohony od roku 2021 do současnosti, EU spec",
    models: [
      // ── EX30 ────────────────────────────────────────────────────────────────
      { group: "EX30" },
      { label: "EX30 (2024–dosud)", powers: ["200 kW – Single Motor", "315 kW – Twin Motor Performance"] },

      // ── EX40 ────────────────────────────────────────────────────────────────
      { group: "EX40" },
      { label: "XC40 Recharge / EX40 (2021–dosud)", powers: ["175 kW – Single Motor", "185 kW – Single Motor Extended Range", "300 kW – Twin Motor", "325 kW – Twin Motor Performance"] },

      // ── EC40 ────────────────────────────────────────────────────────────────
      { group: "EC40" },
      { label: "C40 Recharge / EC40 (2022–dosud)", powers: ["175 kW – Single Motor", "185 kW – Single Motor Extended Range", "300 kW – Twin Motor", "325 kW – Twin Motor Performance"] },

      // ── XC60 ────────────────────────────────────────────────────────────────
      { group: "XC60" },
      { label: "XC60 (2025–dosud)", powers: ["184 kW – B5 AWD Mild Hybrid", "247 kW – T6 AWD Plug-in Hybrid", "299 kW – T8 AWD Plug-in Hybrid"] },

      // ── XC90 ────────────────────────────────────────────────────────────────
      { group: "XC90" },
      { label: "XC90 (2025–dosud)", powers: ["184 kW – B5 AWD Mild Hybrid"] },
    ],
  },

  {
    brand:     "Suzuki",
    active:    true,
    expertise: "Suzuki osobní vozy hlavních EU modelových řad (Swift, Ignis, Vitara, S-Cross, e Vitara) — motory DualJet, BoosterJet hybridy a elektrické pohony od roku 2020 do současnosti, EU spec",
    models: [
      // ── Swift ───────────────────────────────────────────────────────────────
      { group: "Swift" },
      { label: "Swift VI Hybrid (2024–dosud)", powers: ["61 kW – 1.2 Mild Hybrid"] },

      // ── Ignis ───────────────────────────────────────────────────────────────
      { group: "Ignis" },
      { label: "Ignis Hybrid (2020–2024)", powers: ["61 kW – 1.2 DualJet Hybrid"] },

      // ── Vitara ──────────────────────────────────────────────────────────────
      { group: "Vitara" },
      { label: "Vitara Hybrid (2024–dosud)", powers: ["85 kW – 1.5 Full Hybrid", "95 kW – 1.4 BoosterJet Mild Hybrid"] },

      // ── S-Cross ─────────────────────────────────────────────────────────────
      { group: "S-Cross" },
      { label: "S-Cross Hybrid (2024–dosud)", powers: ["85 kW – 1.5 Full Hybrid", "95 kW – 1.4 BoosterJet Mild Hybrid"] },

      // ── e Vitara ────────────────────────────────────────────────────────────
      { group: "e Vitara" },
      { label: "e Vitara (2025–dosud)", powers: ["106 kW – Electric 49 kWh FWD", "128 kW – Electric 61 kWh FWD", "135 kW – Electric 61 kWh ALLGRIP-e"] },
    ],
  },

  // ── US Market brands ─────────────────────────────────────────────────────────
  ...VEHICLE_CATALOG_US,
]

