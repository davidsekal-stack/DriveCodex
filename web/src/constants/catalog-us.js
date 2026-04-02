// ── US Market Vehicle Catalog ─────────────────────────────────────────────────
//
// 16 top brands for the North American market.
// Power values in hp (US convention) — format: "NNN hp – displacement Engine"
// Sources verified: OEM specs, NHTSA, Mitchell1, AllData, CarMD OBD data
//

export const VEHICLE_CATALOG_US = [

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Chevrolet",
    active:    true,
    expertise: "Chevrolet full lineup — Silverado, Silverado EV, Colorado, Express, Equinox, Traverse, Tahoe/Suburban, Camaro, Corvette, Malibu, Trailblazer — EcoTec3 V6/V8 engines, Duramax Diesel, 2.7L Turbo, LT1/LT2/LS engine family, Ultium EV, GM 6L80/10L80 transmissions, stabilitrak, AFM/DFM cylinder deactivation, 2007–present US spec",
    models: [
      // ── Silverado 1500 ────────────────────────────────────────────────────
      { group: "Silverado 1500" },
      { label: "Silverado 1500 (2007–2013)", powers: ["195 hp – 4.3L V6", "295 hp – 4.8L V8", "315 hp – 5.3L EcoTec V8", "367 hp – 6.0L V8", "403 hp – 6.2L V8"] },
      { label: "Silverado 1500 (2014–2018)", powers: ["285 hp – 4.3L EcoTec3 V6", "355 hp – 5.3L EcoTec3 V8", "420 hp – 6.2L EcoTec3 V8"] },
      { label: "Silverado 1500 (2019–)", powers: ["285 hp – 4.3L EcoTec3 V6", "310 hp – 2.7L Turbo I4", "355 hp – 5.3L EcoTec3 V8", "277 hp – 3.0L Duramax Diesel I6", "420 hp – 6.2L EcoTec3 V8"] },

      // ── Silverado HD ──────────────────────────────────────────────────────
      { group: "Silverado HD (2500/3500)" },
      { label: "Silverado HD (2011–2019)", powers: ["360 hp – 6.0L V8", "445 hp – 6.6L Duramax LML/L5P Diesel"] },
      { label: "Silverado HD (2020–)", powers: ["401 hp – 6.6L V8 Gasoline", "445 hp – 6.6L Duramax L5P Diesel", "470 hp – 6.6L Duramax L5P Diesel (2021+)"] },

      // ── Colorado ──────────────────────────────────────────────────────────
      { group: "Colorado" },
      { label: "Colorado (2015–2022)", powers: ["200 hp – 2.5L I4", "308 hp – 3.6L V6", "186 hp – 2.8L Duramax Diesel I4"] },
      { label: "Colorado (2023–)", powers: ["237 hp – 2.7L Turbo I4", "310 hp – 2.7L Turbo High-Output I4"] },

      // ── Express ───────────────────────────────────────────────────────────
      { group: "Express" },
      { label: "Express (2003–present)", powers: ["276 hp – 4.3L V6", "401 hp – 6.6L V8"] },

      // ── Equinox ───────────────────────────────────────────────────────────
      { group: "Equinox" },
      { label: "Equinox (2010–2017)", powers: ["182 hp – 2.4L I4 DOHC", "301 hp – 3.6L V6"] },
      { label: "Equinox (2018–)", powers: ["170 hp – 1.5L Turbo I4", "252 hp – 2.0L Turbo I4", "137 hp – 1.6L Diesel (2018–20)"] },

      // ── Traverse ─────────────────────────────────────────────────────────
      { group: "Traverse" },
      { label: "Traverse (2009–2017)", powers: ["281 hp – 3.6L V6 SIDI"] },
      { label: "Traverse (2018–)", powers: ["193 hp – 2.5L I4", "310 hp – 3.6L V6"] },

      // ── Tahoe / Suburban ─────────────────────────────────────────────────
      { group: "Tahoe / Suburban" },
      { label: "Tahoe/Suburban (2007–2014)", powers: ["315 hp – 5.3L EcoTec V8", "403 hp – 6.2L V8"] },
      { label: "Tahoe/Suburban (2015–2020)", powers: ["355 hp – 5.3L EcoTec3 V8"] },
      { label: "Tahoe/Suburban (2021–)", powers: ["355 hp – 5.3L EcoTec3 V8", "277 hp – 3.0L Duramax Diesel I6", "420 hp – 6.2L EcoTec3 V8"] },

      // ── Trailblazer ───────────────────────────────────────────────────────
      { group: "Trailblazer" },
      { label: "Trailblazer (2021–)", powers: ["137 hp – 1.2L Turbo I3", "155 hp – 1.3L Turbo I3"] },

      // ── Malibu ────────────────────────────────────────────────────────────
      { group: "Malibu" },
      { label: "Malibu (2013–2015)", powers: ["160 hp – 2.5L I4", "259 hp – 2.0L Turbo I4"] },
      { label: "Malibu (2016–2024)", powers: ["160 hp – 1.5L Turbo I4", "250 hp – 2.0L Turbo I4", "182 hp – 1.8L Hybrid"] },

      // ── Camaro ────────────────────────────────────────────────────────────
      { group: "Camaro" },
      { label: "Camaro (2010–2015)", powers: ["312 hp – 3.6L V6", "426 hp – 6.2L LS3 V8", "580 hp – 6.2L Supercharged ZL1"] },
      { label: "Camaro (2016–2024)", powers: ["275 hp – 2.0L Turbo I4", "335 hp – 3.6L V6", "455 hp – 6.2L LT1 V8", "650 hp – 6.2L Supercharged ZL1"] },

      // ── Corvette ──────────────────────────────────────────────────────────
      { group: "Corvette" },
      { label: "Corvette C7 Stingray (2014–2019)", powers: ["455 hp – 6.2L LT1 V8", "460 hp – 6.2L LT1 V8 (Z51)", "650 hp – 6.2L LT4 Supercharged Z06", "755 hp – 6.2L Supercharged ZR1"] },
      { label: "Corvette C8 Stingray (2020–present)", powers: ["490 hp – 6.2L LT2 V8", "495 hp – 6.2L LT2 V8 (Z51)", "670 hp – 5.5L LT6 NA V8 Z06", "655 hp – 6.2L LT2 V8 + Electric E-Ray Hybrid"] },

      // ── Bolt EV / Bolt EUV ───────────────────────────────────────────────
      { group: "Bolt EV / EUV" },
      { label: "Bolt EV (2017–2023)", powers: ["200 hp – Electric 60/65 kWh"] },
      { label: "Bolt EUV (2022–2023)", powers: ["200 hp – Electric 65 kWh"] },

      // ── Blazer ───────────────────────────────────────────────────────────
      { group: "Blazer" },
      { label: "Blazer (2019–present)", powers: ["228 hp – 2.0L Turbo I4", "308 hp – 3.6L V6"] },
      { label: "Blazer EV (2024–present)", powers: ["287 hp – Electric RWD", "557 hp – Electric SS AWD"] },

      // ── Trax ─────────────────────────────────────────────────────────────
      { group: "Trax" },
      { label: "Trax (2015–2022)", powers: ["138 hp – 1.4L Turbo Ecotec I4"] },
      { label: "Trax (2024–present)", powers: ["137 hp – 1.2L Turbo I3"] },

      // ── Equinox EV ───────────────────────────────────────────────────────
      { group: "Equinox EV" },
      { label: "Equinox EV (2024–present)", powers: ["213 hp – Electric RWD eAWD", "288 hp – Electric AWD", "303 hp – Electric RS AWD"] },

      // ── Silverado EV ─────────────────────────────────────────────────────
      { group: "Silverado EV" },
      { label: "Silverado EV (2024–present)", powers: ["510 hp – Dual Motor Electric WT", "645 hp – Dual Motor Electric LT/RST", "760 hp – Dual Motor Electric Max Power"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "GMC",
    active:    true,
    expertise: "GMC trucks, vans and SUVs — Sierra 1500/HD plus Sierra EV, Canyon, Savana, Terrain, Acadia, Yukon/Yukon XL — EcoTec3 V6/V8, Duramax Diesel, 2.7L Turbo, 4.3L V6, 6.6L V8, Ultium EV, GM 6L80/10L80/10L1000 transmissions, 2007–present US spec. Shares most platforms and powertrains with Chevrolet",
    models: [
      // ── Sierra 1500 ───────────────────────────────────────────────────────
      { group: "Sierra 1500" },
      { label: "Sierra 1500 (2007–2013)", powers: ["195 hp – 4.3L V6", "295 hp – 4.8L V8", "315 hp – 5.3L EcoTec V8", "367 hp – 6.0L V8", "403 hp – 6.2L V8"] },
      { label: "Sierra 1500 (2014–2018)", powers: ["285 hp – 4.3L EcoTec3 V6", "355 hp – 5.3L EcoTec3 V8", "420 hp – 6.2L EcoTec3 V8"] },
      { label: "Sierra 1500 (2019–)", powers: ["285 hp – 4.3L EcoTec3 V6", "310 hp – 2.7L Turbo I4", "355 hp – 5.3L EcoTec3 V8", "277 hp – 3.0L Duramax Diesel I6", "420 hp – 6.2L EcoTec3 V8"] },

      // ── Sierra HD ─────────────────────────────────────────────────────────
      { group: "Sierra HD (2500/3500)" },
      { label: "Sierra HD (2011–2019)", powers: ["360 hp – 6.0L V8", "445 hp – 6.6L Duramax LML/L5P Diesel"] },
      { label: "Sierra HD (2020–)", powers: ["401 hp – 6.6L V8 Gasoline", "445 hp – 6.6L Duramax L5P Diesel", "470 hp – 6.6L Duramax L5P Diesel (2021+)"] },

      // ── Canyon ────────────────────────────────────────────────────────────
      { group: "Canyon" },
      { label: "Canyon (2015–2022)", powers: ["200 hp – 2.5L I4", "308 hp – 3.6L V6", "186 hp – 2.8L Duramax Diesel I4"] },
      { label: "Canyon (2023–)", powers: ["237 hp – 2.7L Turbo I4", "310 hp – 2.7L Turbo High-Output I4"] },

      // ── Savana ────────────────────────────────────────────────────────────
      { group: "Savana" },
      { label: "Savana (2003–present)", powers: ["276 hp – 4.3L V6", "401 hp – 6.6L V8"] },

      // ── Terrain ───────────────────────────────────────────────────────────
      { group: "Terrain" },
      { label: "Terrain (2010–2017)", powers: ["182 hp – 2.4L I4 DOHC", "301 hp – 3.6L V6"] },
      { label: "Terrain (2018–)", powers: ["170 hp – 1.5L Turbo I4", "252 hp – 2.0L Turbo I4"] },

      // ── Acadia ────────────────────────────────────────────────────────────
      { group: "Acadia" },
      { label: "Acadia (2007–2016)", powers: ["281 hp – 3.6L V6 SIDI"] },
      { label: "Acadia (2017–2023)", powers: ["193 hp – 2.5L I4", "310 hp – 3.6L V6"] },
      { label: "Acadia (2024–)", powers: ["228 hp – 2.0L Turbo I4", "328 hp – 2.5L Turbo I4"] },

      // ── Yukon / Yukon XL ─────────────────────────────────────────────────
      { group: "Yukon / Yukon XL" },
      { label: "Yukon/Yukon XL (2007–2014)", powers: ["315 hp – 5.3L EcoTec V8", "403 hp – 6.2L V8"] },
      { label: "Yukon/Yukon XL (2015–2020)", powers: ["355 hp – 5.3L EcoTec3 V8"] },
      { label: "Yukon/Yukon XL (2021–present)", powers: ["355 hp – 5.3L EcoTec3 V8", "277 hp – 3.0L Duramax Diesel I6", "420 hp – 6.2L EcoTec3 V8"] },

      // ── Hummer EV ────────────────────────────────────────────────────────
      { group: "Hummer EV" },
      { label: "Hummer EV Pickup (2022–present)", powers: ["625 hp – Dual Motor Electric", "830 hp – Tri-Motor Electric Edition 1"] },
      { label: "Hummer EV SUV (2024–present)", powers: ["625 hp – Dual Motor Electric", "830 hp – Tri-Motor Electric"] },

      // ── Sierra EV ────────────────────────────────────────────────────────
      { group: "Sierra EV" },
      { label: "Sierra EV (2024–present)", powers: ["645 hp – Dual Motor Electric", "760 hp – Dual Motor Electric Max Power"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Hummer",
    active:    false,
    expertise: "Legacy HUMMER US SUVs and trucks — H2, H2 SUT, H3 and H3T/H3 SUT — GM Vortec V8 and Atlas I5 platforms, transfer-case and 4WD driveline diagnostics, 2003–2010 US spec",
    models: [
      { group: "H2 / H3" },
      { label: "H2 (2003–2010)", powers: ["316 hp – 6.0L Vortec V8", "393 hp – 6.2L Vortec V8"] },
      { label: "H2 SUT (2005–2009)", powers: ["316 hp – 6.0L Vortec V8", "393 hp – 6.2L Vortec V8"] },
      { label: "H3 (2006–2010)", powers: ["220 hp – 3.5L Atlas I5", "242 hp – 3.7L Atlas I5", "300 hp – 5.3L Vortec V8 Alpha"] },
      { label: "H3T / H3 SUT (2009–2010)", powers: ["239 hp – 3.7L Atlas I5", "300 hp – 5.3L Vortec V8 Alpha"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Pontiac",
    active:    false,
    expertise: "Legacy Pontiac passenger cars and crossover — Vibe, G6, G5, G8, GTO, Solstice, Torrent, G3 — GM Delta/Epsilon/Kappa/Zeta platforms plus Toyota co-developed Vibe, Ecotec I4, 3.4L/3.5L/3.6L V6 and LS-series V8, 2003–2010 North America spec",
    models: [
      { group: "Vibe / G-series" },
      { label: "Vibe (2003–2008)", powers: ["126 hp – 1.8L 1ZZ-FE I4", "180 hp – 1.8L 2ZZ-GE I4"] },
      { label: "Vibe (2009–2010)", powers: ["132 hp – 1.8L 2ZR-FE I4", "158 hp – 2.4L 2AZ-FE I4"] },
      { label: "G6 (2005–2010)", powers: ["164 hp – 2.4L Ecotec I4", "219 hp – 3.5L V6", "252 hp – 3.6L V6"] },
      { label: "G5 (2007–2010)", powers: ["148 hp – 2.2L Ecotec I4", "155 hp – 2.2L Ecotec I4 VVT", "171 hp – 2.4L Ecotec I4"] },
      { label: "G8 (2008–2009)", powers: ["256 hp – 3.6L V6", "361 hp – 6.0L V8", "402 hp – 6.2L V8"] },
      { label: "GTO (2004–2006)", powers: ["350 hp – 5.7L LS1 V8", "400 hp – 6.0L LS2 V8"] },
      { label: "G3 (2009–2010)", powers: ["106 hp – 1.6L I4"] },

      { group: "Solstice / Torrent" },
      { label: "Solstice (2006–2010)", powers: ["177 hp – 2.4L Ecotec I4", "260 hp – 2.0L Turbo Ecotec I4"] },
      { label: "Torrent (2006–2009)", powers: ["185 hp – 3.4L V6", "264 hp – 3.6L V6"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Saturn",
    active:    false,
    expertise: "Legacy Saturn passenger cars, roadster and crossovers — Vue, Outlook, Aura, Sky, Astra, Relay, Ion — Ecotec I4, Green Line hybrid, Honda-sourced 3.5L V6, GM 3.6L V6 and Kappa roadster platforms, 2002–2010 North America spec",
    models: [
      { group: "Ion / Aura / Astra" },
      { label: "Ion (2003–2007)", powers: ["140 hp – 2.2L Ecotec I4", "175 hp – 2.4L Ecotec I4", "205 hp – 2.0L Supercharged Ecotec I4"] },
      { label: "Aura (2007–2010)", powers: ["169 hp – 2.4L Ecotec I4", "219 hp – 3.5L V6", "252 hp – 3.6L V6"] },
      { label: "Aura Hybrid (2007–2009)", powers: ["169 hp – 2.4L Hybrid I4"] },
      { label: "Astra (2008–2009)", powers: ["138 hp – 1.8L Ecotec I4"] },

      { group: "Vue / Outlook / Relay" },
      { label: "Vue (2002–2007)", powers: ["143 hp – 2.2L Ecotec I4", "250 hp – 3.5L V6"] },
      { label: "Vue (2008–2010)", powers: ["169 hp – 2.4L Ecotec I4", "257 hp – 3.6L V6"] },
      { label: "Vue Hybrid (2007–2009)", powers: ["170 hp – 2.4L Green Line Hybrid I4"] },
      { label: "Outlook (2007–2010)", powers: ["281 hp – 3.6L V6", "288 hp – 3.6L V6 dual-exhaust"] },
      { label: "Relay (2005–2007)", powers: ["240 hp – 3.9L V6"] },

      { group: "Sky" },
      { label: "Sky (2007–2010)", powers: ["177 hp – 2.4L Ecotec I4", "260 hp – 2.0L Turbo Ecotec I4"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Saab",
    active:    false,
    expertise: "Legacy Saab US post-2000 niche models under the strict GearBrain cutoff — 9-2X, 9-4X and 9-7X — Subaru boxer and GM-derived V6/V8 platforms, AWD driveline and premium crossover diagnostics, 2005–2012 US spec",
    models: [
      { group: "9-2X / 9-4X / 9-7X" },
      { label: "9-2X (2005–2006)", powers: ["173 hp – 2.5L Boxer I4", "230 hp – 2.5L Turbo Boxer I4"] },
      { label: "9-7X (2005–2009)", powers: ["285 hp – 4.2L I6", "300 hp – 5.3L V8", "390 hp – 6.0L V8"] },
      { label: "9-4X (2011–2012)", powers: ["265 hp – 3.0L V6", "300 hp – 2.8L Turbo V6"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Ram",
    active:    true,
    expertise: "Ram trucks and vans — 1500, 2500, 3500, ProMaster — HEMI 5.7L/6.4L/6.2L, 6.7L Cummins Diesel, 3.6L Pentastar V6, 3.0L EcoDiesel, 3.0L Hurricane I6 Turbo, ZF 8HP/TorqueFlite 8 transmissions, MDS cylinder deactivation, 2009–present US spec",
    models: [
      // ── Ram 1500 ──────────────────────────────────────────────────────────
      { group: "Ram 1500" },
      { label: "Ram 1500 (2009–2018)", powers: ["305 hp – 3.6L Pentastar V6", "395 hp – 5.7L HEMI V8", "240 hp – 3.0L EcoDiesel V6"] },
      { label: "Ram 1500 Classic (2019–present)", powers: ["305 hp – 3.6L Pentastar V6", "395 hp – 5.7L HEMI V8"] },
      { label: "Ram 1500 (2019–present)", powers: ["305 hp – 3.6L Pentastar eTorque V6", "395 hp – 5.7L HEMI eTorque V8", "260 hp – 3.0L EcoDiesel V6", "420 hp – 3.0L Hurricane I6 Turbo", "510 hp – 3.0L Hurricane I6 HO Turbo"] },
      { label: "Ram 1500 TRX (2021–2024)", powers: ["702 hp – 6.2L Supercharged HEMI V8"] },

      // ── Ram 2500 ──────────────────────────────────────────────────────────
      { group: "Ram 2500" },
      { label: "Ram 2500 (2010–2018)", powers: ["383 hp – 5.7L HEMI V8", "410 hp – 6.4L HEMI V8", "370 hp – 6.7L Cummins Diesel I6"] },
      { label: "Ram 2500 (2019–)", powers: ["410 hp – 6.4L HEMI V8", "370 hp – 6.7L Cummins Diesel I6", "400 hp – 6.7L Cummins HO Diesel I6"] },

      // ── Ram 3500 ──────────────────────────────────────────────────────────
      { group: "Ram 3500" },
      { label: "Ram 3500 (2013–2018)", powers: ["383 hp – 5.7L HEMI V8", "410 hp – 6.4L HEMI V8", "350 hp – 6.7L Cummins Diesel I6", "385 hp – 6.7L Cummins HO Diesel I6"] },
      { label: "Ram 3500 (2019–)", powers: ["410 hp – 6.4L HEMI V8", "370 hp – 6.7L Cummins Diesel I6", "400 hp – 6.7L Cummins HO Diesel I6"] },

      // ── ProMaster ─────────────────────────────────────────────────────────
      { group: "ProMaster" },
      { label: "ProMaster (2014–)", powers: ["280 hp – 3.6L Pentastar V6", "140 hp – 3.0L VM Diesel I4"] },
      { label: "ProMaster City (2015–)", powers: ["178 hp – 2.4L I4 Tigershark"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Jeep",
    active:    true,
    expertise: "Jeep SUVs and trucks — Wrangler JK/JL and Wrangler 4xe, Grand Cherokee WK2/WL plus Grand Cherokee L and Grand Cherokee 4xe, Cherokee KL, Compass, Renegade, Gladiator, Wagoneer, Wagoneer S, Recon EV — 3.6L Pentastar V6, 2.0L Hurricane Turbo, 5.7L/6.4L HEMI, 3.0L EcoDiesel, 4xe PHEV, dual-motor EV, Dana axles, NV transfer cases, Rock-Trac 4WD, 2007–present US spec",
    models: [
      // ── Wrangler ─────────────────────────────────────────────────────────
      { group: "Wrangler" },
      { label: "Wrangler JK (2007–2011)", powers: ["202 hp – 3.8L V6"] },
      { label: "Wrangler JK (2012–2018)", powers: ["285 hp – 3.6L Pentastar V6"] },
      { label: "Wrangler JL (2018–)", powers: ["270 hp – 2.0L Hurricane Turbo I4", "285 hp – 3.6L Pentastar V6 eTorque", "260 hp – 3.0L EcoDiesel V6", "375 hp – 2.0L 4xe PHEV", "470 hp – 6.4L HEMI V8 392"] },
      { label: "Wrangler 4xe (2021–present)", powers: ["375 hp – 2.0L 4xe PHEV"] },

      // ── Grand Cherokee ────────────────────────────────────────────────────
      { group: "Grand Cherokee" },
      { label: "Grand Cherokee WK2 (2011–2021)", powers: ["290 hp – 3.6L Pentastar V6", "357 hp – 5.7L HEMI V8", "475 hp – 6.4L HEMI SRT V8", "707 hp – 6.2L Supercharged Trackhawk V8", "240 hp – 3.0L EcoDiesel V6"] },
      { label: "Grand Cherokee WL (2021–)", powers: ["270 hp – 2.0L Hurricane Turbo I4", "293 hp – 3.6L Pentastar V6", "357 hp – 5.7L HEMI V8", "375 hp – 2.0L 4xe PHEV", "510 hp – 6.2L Supercharged 4xe PHEV"] },
      { label: "Grand Cherokee L (2021–present)", powers: ["293 hp – 3.6L Pentastar V6", "357 hp – 5.7L HEMI V8"] },
      { label: "Grand Cherokee 4xe (2022–present)", powers: ["375 hp – 2.0L 4xe PHEV"] },

      // ── Cherokee ──────────────────────────────────────────────────────────
      { group: "Cherokee" },
      { label: "Cherokee KL (2014–2023)", powers: ["180 hp – 2.4L Tigershark I4", "271 hp – 3.2L Pentastar V6", "270 hp – 2.0L Hurricane Turbo I4"] },

      // ── Compass ───────────────────────────────────────────────────────────
      { group: "Compass" },
      { label: "Compass (2017–)", powers: ["177 hp – 2.4L Tigershark I4", "200 hp – 1.3L Turbo I4"] },

      // ── Renegade ─────────────────────────────────────────────────────────
      { group: "Renegade" },
      { label: "Renegade (2015–)", powers: ["160 hp – 1.4L MultiAir Turbo I4", "180 hp – 2.4L Tigershark I4", "180 hp – 1.3L Turbo I4"] },

      // ── Gladiator ─────────────────────────────────────────────────────────
      { group: "Gladiator" },
      { label: "Gladiator (2020–present)", powers: ["285 hp – 3.6L Pentastar V6", "260 hp – 3.0L EcoDiesel V6"] },

      // ── Wagoneer / Grand Wagoneer ───────────────────────────────────────
      { group: "Wagoneer / Grand Wagoneer" },
      { label: "Wagoneer (2022–present)", powers: ["420 hp – 3.0L Hurricane I6 Turbo", "510 hp – 3.0L Hurricane I6 HO Turbo"] },
      { label: "Grand Wagoneer (2022–present)", powers: ["420 hp – 3.0L Hurricane I6 Turbo", "510 hp – 3.0L Hurricane I6 HO Turbo"] },
      { label: "Wagoneer S (2024–present)", powers: ["600 hp – dual-motor EV"] },

      // ── Recon ────────────────────────────────────────────────────────────
      { group: "Recon" },
      { label: "Recon (2026–present)", powers: ["650 hp – dual-motor EV"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Dodge",
    active:    true,
    expertise: "Dodge performance cars and SUVs — Challenger, Charger, Durango — 3.6L Pentastar V6, 5.7L/6.4L HEMI, 6.2L Supercharged Hellcat, SRT performance variants, ZF 8HP transmission, MDS cylinder deactivation, Brembo brakes, 2011–present US spec",
    models: [
      // ── Challenger ────────────────────────────────────────────────────────
      { group: "Challenger" },
      { label: "Challenger (2009–2014)", powers: ["305 hp – 3.6L Pentastar V6", "375 hp – 5.7L HEMI V8", "470 hp – 6.4L HEMI SRT8 V8"] },
      { label: "Challenger (2015–2023)", powers: ["305 hp – 3.6L Pentastar V6", "375 hp – 5.7L HEMI R/T V8", "485 hp – 6.4L HEMI 392 V8", "717 hp – 6.2L Supercharged Hellcat V8", "797 hp – 6.2L Supercharged Hellcat Redeye V8", "807 hp – 6.2L Supercharged Demon 170 V8"] },

      // ── Charger ───────────────────────────────────────────────────────────
      { group: "Charger" },
      { label: "Charger (2011–2014)", powers: ["292 hp – 3.6L Pentastar V6", "370 hp – 5.7L HEMI R/T V8", "470 hp – 6.4L HEMI SRT8 V8"] },
      { label: "Charger (2015–)", powers: ["292 hp – 3.6L Pentastar V6", "300 hp – 3.6L Pentastar V6 AWD", "370 hp – 5.7L HEMI R/T V8", "485 hp – 6.4L HEMI 392 V8", "707 hp – 6.2L Supercharged Hellcat V8", "797 hp – 6.2L Supercharged Hellcat Redeye V8"] },

      // ── Durango ───────────────────────────────────────────────────────────
      { group: "Durango" },
      { label: "Durango (2011–2020)", powers: ["293 hp – 3.6L Pentastar V6", "360 hp – 5.7L HEMI V8", "475 hp – 6.4L HEMI SRT V8"] },
      { label: "Durango (2021–present)", powers: ["293 hp – 3.6L Pentastar V6", "357 hp – 5.7L HEMI V8", "475 hp – 6.4L HEMI SRT V8", "710 hp – 6.2L Supercharged Hellcat V8"] },

      // ── Hornet ───────────────────────────────────────────────────────────
      { group: "Hornet" },
      { label: "Hornet (2023–present)", powers: ["268 hp – 2.0L Hurricane I4 Turbo", "288 hp – 1.3L Turbo PHEV R/T"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Honda",
    active:    true,
    expertise: "Honda passenger cars and SUVs — Civic, Accord, CR-V, Pilot, Odyssey, Ridgeline, HR-V, Passport — 1.5L VTEC Turbo, 2.0L VTEC Turbo, K-series, 3.5L i-VTEC V6, Earth Dreams i-MMD Hybrid, CVT/6-speed AT, 2006–present US spec",
    models: [
      // ── Civic ─────────────────────────────────────────────────────────────
      { group: "Civic" },
      { label: "Civic 8th gen (2006–2011)", powers: ["140 hp – 1.8L SOHC i-VTEC I4", "197 hp – 2.0L DOHC i-VTEC Si I4"] },
      { label: "Civic 9th gen (2012–2015)", powers: ["143 hp – 1.8L i-VTEC I4", "205 hp – 2.4L i-VTEC Si I4", "110 hp – 1.5L IMA Hybrid"] },
      { label: "Civic 10th gen (2016–2021)", powers: ["158 hp – 2.0L DOHC I4 (Sedan/Coupe)", "174 hp – 1.5L VTEC Turbo I4", "180 hp – 1.5L VTEC Turbo I4 (Sport/Touring)", "205 hp – 1.5L VTEC Turbo Si", "306 hp – 2.0L DOHC Turbo Type R"] },
      { label: "Civic 11th gen (2022–)", powers: ["158 hp – 2.0L DOHC I4 (LX/Sport)", "192 hp – 1.5L VTEC Turbo I4", "200 hp – 1.5L VTEC Turbo Si", "315 hp – 2.0L DOHC Turbo Type R"] },

      // ── Accord ────────────────────────────────────────────────────────────
      { group: "Accord" },
      { label: "Accord 8th gen (2008–2012)", powers: ["177 hp – 2.4L i-VTEC I4", "271 hp – 3.5L i-VTEC V6"] },
      { label: "Accord 9th gen (2013–2017)", powers: ["185 hp – 2.4L i-VTEC I4", "278 hp – 3.5L i-VTEC V6", "196 hp – 2.0L IMA Hybrid"] },
      { label: "Accord 10th gen (2018–2022)", powers: ["192 hp – 1.5L Turbo I4", "252 hp – 2.0L Turbo I4", "212 hp – 2.0L Hybrid i-MMD"] },
      { label: "Accord 11th gen (2023–)", powers: ["192 hp – 1.5L Turbo I4", "204 hp – 2.0L Hybrid i-MMD"] },

      // ── CR-V ──────────────────────────────────────────────────────────────
      { group: "CR-V" },
      { label: "CR-V 3rd gen (2007–2011)", powers: ["166 hp – 2.4L DOHC i-VTEC I4"] },
      { label: "CR-V 4th gen (2012–2016)", powers: ["185 hp – 2.4L DOHC i-VTEC I4"] },
      { label: "CR-V 5th gen (2017–2022)", powers: ["190 hp – 1.5L VTEC Turbo I4", "184 hp – 2.4L DOHC I4 (2017)"] },
      { label: "CR-V 6th gen (2023–)", powers: ["190 hp – 1.5L Turbo I4", "204 hp – 2.0L Hybrid i-MMD"] },

      // ── Pilot ─────────────────────────────────────────────────────────────
      { group: "Pilot" },
      { label: "Pilot 2nd gen (2009–2015)", powers: ["250 hp – 3.5L SOHC i-VTEC V6"] },
      { label: "Pilot 3rd gen (2016–2022)", powers: ["280 hp – 3.5L i-VTEC V6 Direct Injection"] },
      { label: "Pilot 4th gen (2023–)", powers: ["285 hp – 3.5L i-VTEC V6", "285 hp – 3.5L V6 TrailSport"] },

      // ── Odyssey ───────────────────────────────────────────────────────────
      { group: "Odyssey" },
      { label: "Odyssey (2011–2017)", powers: ["248 hp – 3.5L i-VTEC V6"] },
      { label: "Odyssey (2018–)", powers: ["280 hp – 3.5L SOHC i-VTEC V6"] },

      // ── HR-V ──────────────────────────────────────────────────────────────
      { group: "HR-V" },
      { label: "HR-V 1st gen (2016–2022)", powers: ["141 hp – 1.8L SOHC i-VTEC I4"] },
      { label: "HR-V 2nd gen (2023–)", powers: ["158 hp – 2.0L DOHC i-VTEC I4"] },

      // ── Ridgeline ─────────────────────────────────────────────────────────
      { group: "Ridgeline" },
      { label: "Ridgeline (2017–)", powers: ["280 hp – 3.5L i-VTEC V6"] },

      // ── Passport ──────────────────────────────────────────────────────────
      { group: "Passport" },
      { label: "Passport (2019–present)", powers: ["280 hp – 3.5L i-VTEC V6"] },

      // ── Prologue ─────────────────────────────────────────────────────────
      { group: "Prologue" },
      { label: "Prologue (2024–present)", powers: ["287 hp – Electric RWD", "288 hp – Electric AWD"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Subaru",
    active:    true,
    expertise: "Subaru AWD vehicles — Outback, Forester, Crosstrek, Legacy, Ascent, BRZ, WRX, Impreza — Boxer H4 naturally aspirated and turbocharged, FA/EJ/FB engine families, Lineartronic CVT, Symmetrical AWD, EyeSight safety systems, oil consumption issues FA20, head gasket issues EJ25, 2007–present US spec",
    models: [
      // ── Outback ───────────────────────────────────────────────────────────
      { group: "Outback" },
      { label: "Outback 4th gen (2010–2014)", powers: ["170 hp – 2.5L SOHC Boxer H4", "256 hp – 3.6L DOHC Boxer H6"] },
      { label: "Outback 5th gen (2015–2019)", powers: ["175 hp – 2.5L DOHC Boxer H4", "256 hp – 3.6L DOHC Boxer H6"] },
      { label: "Outback 6th gen (2020–)", powers: ["182 hp – 2.5L DOHC Boxer H4", "260 hp – 2.4L Turbocharged Boxer H4"] },

      // ── Forester ──────────────────────────────────────────────────────────
      { group: "Forester" },
      { label: "Forester 3rd gen (2009–2013)", powers: ["170 hp – 2.5L SOHC Boxer H4", "224 hp – 2.5L Turbo XT Boxer H4"] },
      { label: "Forester 4th gen (2014–2018)", powers: ["170 hp – 2.5L DOHC Boxer H4", "250 hp – 2.0L Turbo XT Boxer H4"] },
      { label: "Forester 5th gen (2019–)", powers: ["182 hp – 2.5L DOHC Boxer H4", "182 hp – 2.5L e-Boxer Hybrid (2022+)"] },

      // ── Crosstrek ─────────────────────────────────────────────────────────
      { group: "Crosstrek" },
      { label: "Crosstrek (2013–2023)", powers: ["148 hp – 2.0L Boxer H4", "152 hp – 2.0L Boxer H4 (2018+)", "137 hp – 2.0L PHEV Plug-in Hybrid"] },
      { label: "Crosstrek (2024–)", powers: ["182 hp – 2.5L DOHC Boxer H4"] },

      // ── Legacy ────────────────────────────────────────────────────────────
      { group: "Legacy" },
      { label: "Legacy (2015–2019)", powers: ["175 hp – 2.5L DOHC Boxer H4", "256 hp – 3.6L DOHC Boxer H6"] },
      { label: "Legacy (2020–)", powers: ["182 hp – 2.5L DOHC Boxer H4", "260 hp – 2.4L Turbo Boxer H4"] },

      // ── Ascent ────────────────────────────────────────────────────────────
      { group: "Ascent" },
      { label: "Ascent (2019–)", powers: ["260 hp – 2.4L Turbocharged Boxer H4"] },

      // ── WRX ───────────────────────────────────────────────────────────────
      { group: "WRX" },
      { label: "WRX (2015–2021)", powers: ["268 hp – 2.0L Turbocharged EJ20/FA20 Boxer H4", "305 hp – 2.5L Turbocharged EJ25 STI Boxer H4"] },
      { label: "WRX (2022–)", powers: ["271 hp – 2.4L Turbocharged Boxer H4", "275 hp – 2.4L Turbocharged Boxer H4 (GT)"] },

      // ── BRZ ───────────────────────────────────────────────────────────────
      { group: "BRZ" },
      { label: "BRZ 1st gen (2013–2021)", powers: ["205 hp – 2.0L Boxer H4 FA20"] },
      { label: "BRZ 2nd gen (2022–)", powers: ["228 hp – 2.4L Boxer H4 FA24"] },

      // ── Impreza ───────────────────────────────────────────────────────────
      { group: "Impreza" },
      { label: "Impreza (2017–2023)", powers: ["152 hp – 2.0L DOHC Boxer H4"] },
      { label: "Impreza (2024–present)", powers: ["182 hp – 2.5L DOHC Boxer H4"] },

      // ── Solterra ─────────────────────────────────────────────────────────
      { group: "Solterra" },
      { label: "Solterra (2023–present)", powers: ["201 hp – Electric FWD", "214 hp – Electric AWD"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Mazda",
    active:    true,
    expertise: "Mazda vehicles — Mazda3, Mazda6, CX-3, CX-5, CX-9, CX-30, CX-50, CX-70, CX-90, MX-30, MX-5 Miata — SkyActiv-G naturally aspirated, SkyActiv-X SPCCI, SkyActiv-D Diesel, Turbo variants, 6-speed AT/MT/manual, GVC torque vectoring, i-Activ AWD, EV variants, 2007–present US spec",
    models: [
      // ── Mazda3 ────────────────────────────────────────────────────────────
      { group: "Mazda3" },
      { label: "Mazda3 (2010–2013)", powers: ["148 hp – 2.0L DOHC I4", "167 hp – 2.5L DOHC I4"] },
      { label: "Mazda3 (2014–2018)", powers: ["155 hp – 2.0L SkyActiv-G I4", "184 hp – 2.5L SkyActiv-G I4"] },
      { label: "Mazda3 (2019–)", powers: ["155 hp – 2.0L SkyActiv-G I4", "186 hp – 2.5L SkyActiv-G I4", "227 hp – 2.5L Turbo SkyActiv-G I4 AWD"] },

      // ── Mazda6 ────────────────────────────────────────────────────────────
      { group: "Mazda6" },
      { label: "Mazda6 (2014–2021)", powers: ["184 hp – 2.5L SkyActiv-G I4", "250 hp – 2.5L Turbo SkyActiv-G I4"] },

      // ── CX-3 ──────────────────────────────────────────────────────────────
      { group: "CX-3" },
      { label: "CX-3 (2016–2021)", powers: ["146 hp – 2.0L SkyActiv-G I4", "148 hp – 2.0L SkyActiv-G I4"] },

      // ── CX-5 ──────────────────────────────────────────────────────────────
      { group: "CX-5" },
      { label: "CX-5 1st gen (2013–2016)", powers: ["155 hp – 2.0L SkyActiv-G I4", "184 hp – 2.5L SkyActiv-G I4"] },
      { label: "CX-5 2nd gen (2017–)", powers: ["187 hp – 2.5L SkyActiv-G I4", "187 hp – 2.5L SkyActiv-G AWD", "227 hp – 2.5L Turbo SkyActiv-G I4", "256 hp – 2.5L Turbo SkyActiv-G (93 oct)"] },

      // ── CX-50 ─────────────────────────────────────────────────────────────
      { group: "CX-50" },
      { label: "CX-50 (2023–)", powers: ["187 hp – 2.5L SkyActiv-G I4", "256 hp – 2.5L Turbo SkyActiv-G I4"] },

      // ── CX-9 ──────────────────────────────────────────────────────────────
      { group: "CX-9" },
      { label: "CX-9 (2007–2015)", powers: ["273 hp – 3.7L DOHC V6"] },
      { label: "CX-9 (2016–2023)", powers: ["227 hp – 2.5L Turbo SkyActiv-G I4", "250 hp – 2.5L Turbo SkyActiv-G (93 oct)"] },

      // ── CX-30 ────────────────────────────────────────────────────────────
      { group: "CX-30" },
      { label: "CX-30 (2020–present)", powers: ["155 hp – 2.0L SkyActiv-G I4", "186 hp – 2.5L SkyActiv-G I4", "227 hp – 2.5L Turbo SkyActiv-G I4", "256 hp – 2.5L Turbo SkyActiv-G (93 oct)"] },

      // ── CX-70 ────────────────────────────────────────────────────────────
      { group: "CX-70" },
      { label: "CX-70 (2025–present)", powers: ["280 hp – 3.3L SkyActiv-G I6 Turbo", "323 hp – 3.3L SkyActiv-G I6 Turbo (93 oct)", "280 hp – 2.5L PHEV I4"] },

      // ── CX-90 ────────────────────────────────────────────────────────────
      { group: "CX-90" },
      { label: "CX-90 (2024–present)", powers: ["280 hp – 3.3L SkyActiv-G I6 Turbo", "323 hp – 3.3L SkyActiv-G I6 Turbo (93 oct)", "280 hp – 2.5L PHEV I4"] },

      // ── MX-30 ─────────────────────────────────────────────────────────────
      { group: "MX-30" },
      { label: "MX-30 (2022–2023)", powers: ["143 hp – e-Skyactiv EV"] },

      // ── MX-5 Miata ────────────────────────────────────────────────────────
      { group: "MX-5 Miata" },
      { label: "MX-5 Miata NC (2006–2015)", powers: ["158 hp – 2.0L DOHC I4 MZR"] },
      { label: "MX-5 Miata ND (2016–2018)", powers: ["155 hp – 2.0L SkyActiv-G I4"] },
      { label: "MX-5 Miata ND (2019–)", powers: ["181 hp – 2.0L SkyActiv-G I4"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Cadillac",
    active:    true,
    expertise: "Cadillac luxury vehicles — Escalade, Escalade ESV, XT4, XT5, XT6, CT4, CT5, CT6, XTS, ATS, CTS, SRX, Escalade IQ, OPTIQ, VISTIQ — 2.0L/2.7L Turbo I4, 3.0L Twin Turbo, 3.6L V6, 4.2L Blackwing V8, 6.2L LT1/LT4 V8, 3.0L Duramax Diesel, electric AWD variants, 10-speed automatic, Super Cruise semi-autonomous driving, Magnetic Ride Control, V-Series and Blackwing performance variants, 2007–present US spec",
    models: [
      // ── Escalade ──────────────────────────────────────────────────────────
      { group: "Escalade" },
      { label: "Escalade (2007–2014)", powers: ["403 hp – 6.2L EcoTec V8"] },
      { label: "Escalade (2015–2020)", powers: ["420 hp – 6.2L EcoTec3 V8"] },
      { label: "Escalade (2021–)", powers: ["420 hp – 6.2L EcoTec3 V8", "277 hp – 3.0L Duramax Diesel I6", "682 hp – 6.2L Supercharged V-Series V8"] },

      // ── Escalade ESV ──────────────────────────────────────────────────────
      { group: "Escalade ESV" },
      { label: "Escalade ESV (2007–2014)", powers: ["403 hp – 6.2L EcoTec V8"] },
      { label: "Escalade ESV (2015–2020)", powers: ["420 hp – 6.2L EcoTec3 V8"] },
      { label: "Escalade ESV (2021–present)", powers: ["420 hp – 6.2L EcoTec3 V8", "277 hp – 3.0L Duramax Diesel I6", "682 hp – 6.2L Supercharged V-Series V8"] },

      // ── XT4 ───────────────────────────────────────────────────────────────
      { group: "XT4" },
      { label: "XT4 (2019–)", powers: ["237 hp – 2.0L Turbo I4"] },

      // ── XT5 ───────────────────────────────────────────────────────────────
      { group: "XT5" },
      { label: "XT5 (2017–)", powers: ["310 hp – 3.6L V6 SIDI", "237 hp – 2.0L Turbo I4 (2021+)"] },

      // ── XT6 ───────────────────────────────────────────────────────────────
      { group: "XT6" },
      { label: "XT6 (2020–)", powers: ["310 hp – 3.6L V6 SIDI", "237 hp – 2.0L Turbo I4 (2022+)"] },

      // ── CT4 ───────────────────────────────────────────────────────────────
      { group: "CT4" },
      { label: "CT4 (2020–)", powers: ["237 hp – 2.0L Turbo I4", "325 hp – 2.7L Turbo I4 V-Series", "472 hp – 3.6L Twin Turbo Blackwing V6"] },

      // ── CT5 ───────────────────────────────────────────────────────────────
      { group: "CT5" },
      { label: "CT5 (2020–present)", powers: ["237 hp – 2.0L Turbo I4", "335 hp – 3.0L Twin Turbo V6 V-Series", "668 hp – 6.2L Supercharged Blackwing V8"] },

      // ── CT6 ───────────────────────────────────────────────────────────────
      { group: "CT6" },
      { label: "CT6 (2016–2020)", powers: ["265 hp – 2.0L Turbo I4", "335 hp – 3.6L V6", "404 hp – 3.0L Twin Turbo V6"] },

      // ── XTS ───────────────────────────────────────────────────────────────
      { group: "XTS" },
      { label: "XTS (2013–2019)", powers: ["304 hp – 3.6L V6", "410 hp – 3.6L Twin Turbo V-Sport V6"] },

      // ── ATS / ATS-V ───────────────────────────────────────────────────────
      { group: "ATS" },
      { label: "ATS (2013–2019)", powers: ["272 hp – 2.0L Turbo I4", "321 hp – 3.6L V6"] },
      { group: "ATS-V" },
      { label: "ATS-V (2016–2019)", powers: ["464 hp – 3.6L Twin Turbo V6"] },

      // ── CTS / CTS-V ───────────────────────────────────────────────────────
      { group: "CTS" },
      { label: "CTS (2014–2019)", powers: ["268 hp – 2.0L Turbo I4", "335 hp – 3.6L V6"] },
      { group: "CTS-V" },
      { label: "CTS-V (2016–2019)", powers: ["640 hp – 6.2L Supercharged V8"] },

      // ── SRX ───────────────────────────────────────────────────────────────
      { group: "SRX" },
      { label: "SRX (2010–2016)", powers: ["265 hp – 3.0L V6", "308 hp – 3.6L V6"] },

      // ── LYRIQ ────────────────────────────────────────────────────────────
      { group: "LYRIQ" },
      { label: "LYRIQ (2023–present)", powers: ["340 hp – Electric RWD", "500 hp – Electric AWD"] },

      // ── Escalade IQ ───────────────────────────────────────────────────────
      { group: "Escalade IQ" },
      { label: "Escalade IQ (2025–present)", powers: ["750 hp – Electric AWD"] },

      // ── OPTIQ ─────────────────────────────────────────────────────────────
      { group: "OPTIQ" },
      { label: "OPTIQ (2025–present)", powers: ["300 hp – Electric AWD"] },

      // ── VISTIQ ────────────────────────────────────────────────────────────
      { group: "VISTIQ" },
      { label: "VISTIQ (2026–present)", powers: ["615 hp – Electric AWD"] },
      ],
    },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Lincoln",
    active:    true,
    expertise: "Lincoln premium vehicles — Navigator, Aviator, Corsair, Nautilus, MKZ, MKC, MKX, Continental, MKT — 2.0L/2.3L/2.7L EcoBoost Turbo I4/V6, 3.0L Twin Turbo, 3.5L EcoBoost, PHEV/Hybrid variants, 10R80 10-speed automatic, air suspension, APIM/BCM module faults, CoPilot360 driver assist, 2007–present US spec",
    models: [
      // ── Navigator ─────────────────────────────────────────────────────────
      { group: "Navigator" },
      { label: "Navigator (2007–2014)", powers: ["310 hp – 5.4L V8"] },
      { label: "Navigator (2015–2017)", powers: ["380 hp – 3.5L EcoBoost V6"] },
      { label: "Navigator (2018–)", powers: ["450 hp – 3.5L Twin Turbo EcoBoost V6"] },

      // ── Aviator ───────────────────────────────────────────────────────────
      { group: "Aviator" },
      { label: "Aviator (2020–)", powers: ["400 hp – 3.0L Twin Turbo V6", "494 hp – 3.0L Twin Turbo PHEV V6"] },

      // ── Corsair ───────────────────────────────────────────────────────────
      { group: "Corsair" },
      { label: "Corsair (2020–)", powers: ["247 hp – 2.0L EcoBoost Turbo I4", "266 hp – 2.5L PHEV Hybrid I4"] },

      // ── Nautilus ──────────────────────────────────────────────────────────
      { group: "Nautilus" },
      { label: "Nautilus (2019–2023)", powers: ["250 hp – 2.0L EcoBoost Turbo I4", "335 hp – 2.7L EcoBoost Turbo V6"] },
      { label: "Nautilus (2024–)", powers: ["328 hp – 2.7L EcoBoost Turbo V6"] },

      // ── MKZ ───────────────────────────────────────────────────────────────
      { group: "MKZ" },
      { label: "MKZ (2013–2020)", powers: ["245 hp – 2.0L EcoBoost Turbo I4", "400 hp – 3.0L Twin Turbo V6", "188 hp – 2.0L Hybrid"] },

      // ── MKC ───────────────────────────────────────────────────────────────
      { group: "MKC" },
      { label: "MKC (2015–2019)", powers: ["245 hp – 2.0L EcoBoost Turbo I4", "285 hp – 2.3L EcoBoost Turbo I4"] },

      // ── MKX ───────────────────────────────────────────────────────────────
      { group: "MKX" },
      { label: "MKX (2016–2018)", powers: ["303 hp – 3.7L Ti-VCT V6", "335 hp – 2.7L EcoBoost Turbo V6"] },

      // ── Continental ───────────────────────────────────────────────────────
      { group: "Continental" },
      { label: "Continental (2017–2020)", powers: ["305 hp – 3.7L Ti-VCT V6", "335 hp – 2.7L EcoBoost Turbo V6", "400 hp – 3.0L Twin Turbo V6"] },

      // ── MKT ───────────────────────────────────────────────────────────────
      { group: "MKT" },
      { label: "MKT (2013–2019)", powers: ["365 hp – 3.5L EcoBoost V6"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Chrysler",
    active:    true,
    expertise: "Chrysler minivans and sedans — Pacifica, Voyager, 300 — 3.6L Pentastar V6, 5.7L/6.4L HEMI V8, Pacifica Hybrid plug-in, ZF 9-speed/8-speed automatic, Stow 'n Go seating, 2011–present US spec",
    models: [
      // ── Pacifica ──────────────────────────────────────────────────────────
      { group: "Pacifica" },
      { label: "Pacifica (2017–)", powers: ["287 hp – 3.6L Pentastar V6", "260 hp – 3.6L Pentastar Hybrid PHEV"] },

      // ── Voyager ───────────────────────────────────────────────────────────
      { group: "Voyager" },
      { label: "Voyager (2020–present)", powers: ["287 hp – 3.6L Pentastar V6"] },

      // ── Chrysler 300 ──────────────────────────────────────────────────────
      { group: "300" },
      { label: "Chrysler 300 (2011–2023)", powers: ["292 hp – 3.6L Pentastar V6", "363 hp – 5.7L HEMI V8", "485 hp – 6.4L HEMI SRT8 V8"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Buick",
    active:    true,
    expertise: "Buick luxury-entry vehicles — Encore, Encore GX, Envista, Envision, Enclave, Regal — 1.2L/1.3L/1.4L Turbo I3/I4, 2.0L Turbo, 2.5L/3.6L V6, Active Noise Cancellation, 2013–present US spec. Shares GM platforms with Chevrolet/GMC",
    models: [
        // ── Encore ────────────────────────────────────────────────────────────
        { group: "Encore" },
        { label: "Encore (2013–2022)", powers: ["138 hp – 1.4L Turbo I4 Ecotec", "153 hp – 1.4L Turbo Sport I4"] },

      // ── Encore GX ─────────────────────────────────────────────────────────
      { group: "Encore GX" },
      { label: "Encore GX (2020–present)", powers: ["137 hp – 1.2L Turbo I3", "155 hp – 1.3L Turbo I3"] },

      // ── Envista ───────────────────────────────────────────────────────────
      { group: "Envista" },
      { label: "Envista (2024–present)", powers: ["137 hp – 1.2L Turbo I3"] },

      // ── Envision ──────────────────────────────────────────────────────────
      { group: "Envision" },
      { label: "Envision (2016–2020)", powers: ["197 hp – 1.5L Turbo I4", "252 hp – 2.0L Turbo I4"] },
      { label: "Envision (2021–present)", powers: ["228 hp – 2.0L Turbo I4"] },

      // ── Enclave ───────────────────────────────────────────────────────────
      { group: "Enclave" },
      { label: "Enclave (2008–2017)", powers: ["281 hp – 3.6L V6 SIDI"] },
      { label: "Enclave (2018–present)", powers: ["310 hp – 3.6L V6 SIDI"] },

      // ── Regal ─────────────────────────────────────────────────────────────
      { group: "Regal" },
      { label: "Regal (2018–2020)", powers: ["250 hp – 2.0L Turbo I4", "310 hp – 3.6L V6 GS"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Acura",
    active:    true,
    expertise: "Acura luxury vehicles — MDX, RDX, TLX, Integra — 2.0L Turbo VTEC, 3.0L/3.5L/3.6L V6 VTEC, SH-AWD super handling all-wheel drive, Sport Hybrid SH-AWD, Type S performance variants, 10-speed DCT, 2007–present US spec",
    models: [
      // ── MDX ───────────────────────────────────────────────────────────────
      { group: "MDX" },
      { label: "MDX 3rd gen (2014–2020)", powers: ["290 hp – 3.5L SOHC i-VTEC V6", "321 hp – 3.5L Sport Hybrid SH-AWD V6"] },
      { label: "MDX 4th gen (2022–)", powers: ["290 hp – 3.5L SOHC V6 Turbo", "355 hp – 3.0L Twin Turbo Type S V6"] },

      // ── RDX ───────────────────────────────────────────────────────────────
      { group: "RDX" },
      { label: "RDX (2013–2018)", powers: ["279 hp – 3.5L SOHC V6"] },
      { label: "RDX (2019–)", powers: ["272 hp – 2.0L VTEC Turbo I4"] },

      // ── TLX ───────────────────────────────────────────────────────────────
      { group: "TLX" },
      { label: "TLX (2015–2020)", powers: ["206 hp – 2.4L DOHC i-VTEC I4", "290 hp – 3.5L SOHC V6 SH-AWD"] },
      { label: "TLX (2021–)", powers: ["272 hp – 2.0L Turbo I4", "355 hp – 3.0L Twin Turbo Type S V6"] },

      // ── Integra ───────────────────────────────────────────────────────────
      { group: "Integra" },
      { label: "Integra (2023–)", powers: ["200 hp – 1.5L VTEC Turbo I4", "320 hp – 1.5L VTEC Turbo Type S I4"] },

      // ── ILX ───────────────────────────────────────────────────────────────
      { group: "ILX" },
      { label: "ILX (2013–2022)", powers: ["201 hp – 2.4L DOHC i-VTEC I4"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Lexus",
    active:    true,
    expertise: "Lexus luxury vehicles — RX, NX, GX, LX, TX, ES, IS, LS, GS — 2.0L Turbo, 2.4L Turbo, 2.5L/3.5L V6, 4.6L/5.0L V8, multi-stage Hybrid Drive, Lexus Safety System+, air suspension, Variable Gear Ratio Steering, 2006–present US spec",
    models: [
      // ── RX ────────────────────────────────────────────────────────────────
      { group: "RX" },
      { label: "RX 350/400h (2007–2009)", powers: ["270 hp – 3.5L V6 2GR-FE", "268 hp – 3.3L Hybrid V6"] },
      { label: "RX 350/450h (2010–2015)", powers: ["275 hp – 3.5L V6 2GR-FE", "295 hp – 3.5L Hybrid V6"] },
      { label: "RX 350/450h (2016–2022)", powers: ["295 hp – 3.5L V6 2GR-FKS", "308 hp – 3.5L Hybrid V6"] },
      { label: "RX 350/500h/350h (2023–)", powers: ["275 hp – 2.4L Turbo I4", "366 hp – 2.4L Turbo Hybrid", "246 hp – 2.5L FHEV Hybrid"] },

      // ── NX ────────────────────────────────────────────────────────────────
      { group: "NX" },
      { label: "NX 200t/300 (2015–2021)", powers: ["235 hp – 2.0L Turbo I4"] },
      { label: "NX 250/350/350h/450h+ (2022–)", powers: ["203 hp – 2.5L NA I4", "275 hp – 2.4L Turbo I4", "243 hp – 2.5L FHEV Hybrid", "306 hp – 2.5L PHEV"] },

      // ── GX ────────────────────────────────────────────────────────────────
      { group: "GX" },
      { label: "GX 460 (2010–2023)", powers: ["301 hp – 4.6L V8 1UR-FE"] },
      { label: "GX 550 (2024–)", powers: ["349 hp – 3.4L Twin Turbo V6", "406 hp – 3.4L Twin Turbo Hybrid V6"] },

      // ── LX ────────────────────────────────────────────────────────────────
      { group: "LX" },
      { label: "LX 570 (2008–2021)", powers: ["383 hp – 5.7L V8 3UR-FE"] },
      { label: "LX 600 (2022–)", powers: ["409 hp – 3.4L Twin Turbo V6", "457 hp – 3.4L Twin Turbo Hybrid V6"] },

      // ── TX ────────────────────────────────────────────────────────────────
      { group: "TX" },
      { label: "TX 350/500h/550h+ (2024–present)", powers: ["275 hp – 2.4L Turbo I4", "366 hp – 2.4L Turbo Hybrid", "404 hp – 3.5L V6 Plug-in Hybrid"] },

      // ── ES ────────────────────────────────────────────────────────────────
      { group: "ES" },
      { label: "ES 350/300h (2013–2018)", powers: ["268 hp – 3.5L V6 2GR-FE", "200 hp – 2.5L Hybrid"] },
      { label: "ES 350/300h (2019–)", powers: ["302 hp – 3.5L V6 2GR-FKS", "215 hp – 2.5L FHEV Hybrid"] },

      // ── IS ────────────────────────────────────────────────────────────────
      { group: "IS" },
      { label: "IS 250/350 (2006–2013)", powers: ["204 hp – 2.5L V6", "306 hp – 3.5L V6 2GR-FSE"] },
      { label: "IS 200t/300/350 (2014–2020)", powers: ["241 hp – 2.0L Turbo I4", "260 hp – 3.5L V6 AWD", "311 hp – 3.5L V6 RWD"] },
      { label: "IS 300/350/500 (2021–)", powers: ["260 hp – 3.5L V6 AWD", "311 hp – 3.5L V6 RWD", "472 hp – 5.0L V8 IS 500"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Infiniti",
    active:    true,
    expertise: "Infiniti luxury vehicles — QX60, QX80, QX50, QX55, Q50, Q60, Q70 — 2.0L VC-Turbo (Variable Compression), 3.0L Twin Turbo V6, 3.5L V6 Hybrid, 5.6L V8 Endurance, ProPILOT Assist, Dynamic Digital Suspension, 2007–present US spec",
    models: [
      // ── QX60 ──────────────────────────────────────────────────────────────
      { group: "QX60" },
      { label: "QX60 (2013–2021)", powers: ["265 hp – 2.5L Supercharged Hybrid I4", "295 hp – 3.5L V6 VQ35DE"] },
      { label: "QX60 (2022–)", powers: ["295 hp – 3.5L V6 VQ35DD"] },

      // ── QX80 ──────────────────────────────────────────────────────────────
      { group: "QX80" },
      { label: "QX80 (2014–)", powers: ["400 hp – 5.6L V8 Endurance VK56VD"] },

      // ── QX50 ──────────────────────────────────────────────────────────────
      { group: "QX50" },
      { label: "QX50 (2019–present)", powers: ["268 hp – 2.0L VC-Turbo Variable Compression I4"] },
      { label: "QX55 (2022–present)", powers: ["268 hp – 2.0L VC-Turbo Variable Compression I4"] },

      // ── Q50 / Q60 / Q70 ───────────────────────────────────────────────────
      { group: "Q50" },
      { label: "Q50 (2014–2015)", powers: ["208 hp – 2.0L Turbo I4", "328 hp – 3.7L V6 VQ37VHR", "360 hp – 3.5L Hybrid V6"] },
      { label: "Q50 (2016–present)", powers: ["208 hp – 2.0L Turbo I4", "300 hp – 3.0L Twin Turbo V6", "400 hp – 3.0L Twin Turbo V6 Red Sport"] },

      // ── Q60 ───────────────────────────────────────────────────────────────
      { group: "Q60" },
      { label: "Q60 (2017–present)", powers: ["208 hp – 2.0L Turbo I4", "300 hp – 3.0L Twin Turbo V6", "400 hp – 3.0L Twin Turbo V6 Red Sport"] },
      { group: "Q70" },
      { label: "Q70 (2011–2019)", powers: ["330 hp – 3.7L V6 VQ37VHR", "420 hp – 5.6L V8 VK56VD", "360 hp – 3.5L Hybrid V6"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Genesis",
    active:    true,
    expertise: "Genesis luxury vehicles — GV80, GV70, GV60, G80, G70, G90 — 2.5L Turbo, 3.5L Twin Turbo, 2.5L Turbo Hybrid, 5.0L V8 Lambda, EV electric variants, 8-speed AT, Electronically Controlled Suspension, HTRAC AWD, 2017–present US spec",
    models: [
      // ── GV80 ──────────────────────────────────────────────────────────────
      { group: "GV80" },
      { label: "GV80 (2021–)", powers: ["300 hp – 2.5L Turbo I4", "375 hp – 3.5L Twin Turbo V6", "278 hp – 3.0L Turbo Diesel (international)"] },

      // ── GV70 ──────────────────────────────────────────────────────────────
      { group: "GV70" },
      { label: "GV70 (2022–)", powers: ["300 hp – 2.5L Turbo I4", "375 hp – 3.5L Twin Turbo V6"] },
      { label: "GV70 Electrified (2023–)", powers: ["429 hp – Dual Motor Electric AWD", "429 hp – Dual Motor EV Boost 483 hp"] },

      // ── GV60 ──────────────────────────────────────────────────────────────
      { group: "GV60" },
      { label: "GV60 (2023–)", powers: ["314 hp – Single Motor RWD Electric", "429 hp – Dual Motor AWD Electric", "429 hp – Performance Boost 483 hp Electric"] },

      // ── G80 ───────────────────────────────────────────────────────────────
      { group: "G80" },
      { label: "G80 (2017–2020)", powers: ["311 hp – 3.8L V6 Lambda", "365 hp – 5.0L V8 Tau", "245 hp – 2.0L Turbo I4"] },
      { label: "G80 (2021–)", powers: ["300 hp – 2.5L Turbo I4", "375 hp – 3.5L Twin Turbo V6"] },
      { label: "G80 Electrified (2023–)", powers: ["365 hp – Dual Motor AWD Electric"] },

      // ── G70 ───────────────────────────────────────────────────────────────
      { group: "G70" },
      { label: "G70 (2019–)", powers: ["252 hp – 2.0L Turbo I4", "365 hp – 3.3L Twin Turbo V6"] },

      // ── G90 ───────────────────────────────────────────────────────────────
      { group: "G90" },
      { label: "G90 (2017–2022)", powers: ["311 hp – 3.3L Twin Turbo V6", "420 hp – 5.0L V8 Tau"] },
      { label: "G90 (2023–)", powers: ["375 hp – 3.5L Twin Turbo V6"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Ford (US)",
    active:    true,
    expertise: "Ford US market — F-150, Super Duty, Explorer, Escape, Bronco, Bronco Sport, Edge, Maverick, Expedition, Mustang US, Mustang Mach-E, Transit US, E-Transit, EcoSport US — EcoBoost turbo engines, 5.0L Coyote V8, PowerBoost Hybrid, PowerStroke Diesel, 10R80 10-speed auto, EV platforms, 2006–present US spec",
    models: [
      // ── F-150 ────────────────────────────────────────────────────────────
      { group: "F-150" },
      { label: "F-150 12th gen (2009–2014)", powers: ["292 hp – 3.5L V6", "302 hp – 3.7L V6", "360 hp – 3.5L EcoBoost V6", "365 hp – 5.0L Coyote V8", "411 hp – 6.2L Boss V8"] },
      { label: "F-150 13th gen (2015–2020)", powers: ["282 hp – 3.3L V6", "275 hp – 2.7L EcoBoost V6", "325 hp – 2.7L EcoBoost V6 (2018+)", "365 hp – 3.5L EcoBoost V6", "375 hp – 3.5L EcoBoost V6 (2017+)", "385 hp – 5.0L Coyote V8", "395 hp – 5.0L Coyote V8 (2018+)", "450 hp – 3.5L EcoBoost HO Raptor V6", "250 hp – 3.0L Power Stroke Diesel V6"] },
      { label: "F-150 14th gen (2021–present)", powers: ["290 hp – 3.3L V6", "325 hp – 2.7L EcoBoost V6", "400 hp – 3.5L EcoBoost V6", "400 hp – 5.0L Coyote V8", "430 hp – 3.5L PowerBoost Hybrid V6", "450 hp – 3.5L EcoBoost HO Raptor V6", "700 hp – 5.2L Supercharged Raptor R V8"] },
      { label: "F-150 Lightning (2022–present)", powers: ["452 hp – Dual Motor Electric Standard", "580 hp – Dual Motor Electric Extended"] },

      // ── F-250/F-350 Super Duty ───────────────────────────────────────────
      { group: "Super Duty" },
      { label: "Super Duty (2011–2016)", powers: ["385 hp – 6.2L V8", "400 hp – 6.7L Power Stroke Diesel V8", "440 hp – 6.7L Power Stroke Diesel V8 (2015+)"] },
      { label: "Super Duty (2017–2022)", powers: ["385 hp – 6.2L V8", "430 hp – 6.7L Power Stroke Diesel V8", "475 hp – 7.3L Godzilla V8 (2020+)"] },
      { label: "Super Duty (2023–present)", powers: ["405 hp – 6.8L V8", "475 hp – 7.3L Godzilla V8", "500 hp – 6.7L Power Stroke Diesel V8"] },

      // ── Explorer ─────────────────────────────────────────────────────────
      { group: "Explorer" },
      { label: "Explorer 5th gen (2011–2019)", powers: ["240 hp – 2.0L EcoBoost I4", "280 hp – 3.5L Ti-VCT V6", "365 hp – 3.5L EcoBoost V6 Sport"] },
      { label: "Explorer 6th gen (2020–present)", powers: ["300 hp – 2.3L EcoBoost I4", "400 hp – 3.0L EcoBoost V6 ST", "318 hp – 3.3L Hybrid V6"] },

      // ── Escape ───────────────────────────────────────────────────────────
      { group: "Escape" },
      { label: "Escape 3rd gen (2013–2019)", powers: ["168 hp – 2.5L Duratec I4", "178 hp – 1.5L EcoBoost I4", "231 hp – 2.0L EcoBoost I4", "245 hp – 2.0L EcoBoost I4 (2017+)"] },
      { label: "Escape 4th gen (2020–present)", powers: ["181 hp – 1.5L EcoBoost I4", "250 hp – 2.0L EcoBoost I4", "200 hp – 2.5L Hybrid", "221 hp – 2.5L PHEV"] },

      // ── Bronco ───────────────────────────────────────────────────────────
      { group: "Bronco" },
      { label: "Bronco (2021–present)", powers: ["275 hp – 2.3L EcoBoost I4", "315 hp – 2.7L EcoBoost V6", "405 hp – 3.0L EcoBoost V6 Raptor"] },

      // ── Bronco Sport ─────────────────────────────────────────────────────
      { group: "Bronco Sport" },
      { label: "Bronco Sport (2021–present)", powers: ["181 hp – 1.5L EcoBoost I3", "245 hp – 2.0L EcoBoost I4"] },

      // ── Edge ─────────────────────────────────────────────────────────────
      { group: "Edge" },
      { label: "Edge (2015–2024)", powers: ["245 hp – 2.0L EcoBoost I4", "250 hp – 2.0L EcoBoost I4 (2019+)", "280 hp – 2.7L EcoBoost V6", "335 hp – 2.7L EcoBoost V6 ST"] },

      // ── Maverick ─────────────────────────────────────────────────────────
      { group: "Maverick" },
      { label: "Maverick (2022–present)", powers: ["191 hp – 2.0L EcoBoost I4", "250 hp – 2.5L Hybrid", "227 hp – 2.5L PHEV"] },

      // ── Expedition ───────────────────────────────────────────────────────
      { group: "Expedition" },
      { label: "Expedition (2007–2017)", powers: ["310 hp – 5.4L V8 Triton"] },
      { label: "Expedition (2018–present)", powers: ["375 hp – 3.5L EcoBoost V6", "400 hp – 3.5L EcoBoost V6 (2022+)", "440 hp – 3.5L EcoBoost HO V6 Timberline"] },

      // ── Ranger (US) ──────────────────────────────────────────────────────
      { group: "Ranger (US)" },
      { label: "Ranger (2019–2023)", powers: ["270 hp – 2.3L EcoBoost I4"] },
      { label: "Ranger (2024–present)", powers: ["270 hp – 2.3L EcoBoost I4", "315 hp – 2.7L EcoBoost V6 Raptor"] },

      // ── Mustang (US) ─────────────────────────────────────────────────────
      { group: "Mustang (US)" },
      { label: "Mustang S197 (2010–2014)", powers: ["305 hp – 3.7L V6", "412 hp – 5.0L Coyote V8 GT", "444 hp – 5.0L Coyote V8 Boss 302", "550 hp – 5.4L Supercharged Shelby GT500 V8", "662 hp – 5.8L Supercharged Shelby GT500 V8"] },
      { label: "Mustang S550 (2015–2023)", powers: ["310 hp – 2.3L EcoBoost I4", "460 hp – 5.0L Coyote V8 GT", "480 hp – 5.0L Coyote V8 Mach 1", "526 hp – 5.2L Voodoo V8 Shelby GT350", "760 hp – 5.2L Supercharged Shelby GT500 V8"] },
      { label: "Mustang S650 (2024–present)", powers: ["315 hp – 2.3L EcoBoost I4", "480 hp – 5.0L Coyote V8 GT", "500 hp – 5.0L Coyote V8 Dark Horse"] },

      // ── Mustang Mach-E (US) ─────────────────────────────────────────────
      { group: "Mustang Mach-E (US)" },
      { label: "Mustang Mach-E (2021–present)" },

      // ── Transit (US) ─────────────────────────────────────────────────────
      { group: "Transit (US)" },
      { label: "Transit (2015–present)", powers: ["275 hp – 3.5L V6 PFDI", "310 hp – 3.5L EcoBoost V6", "266 hp – 2.0L EcoBoost I4 (AWD)", "174 hp – E-Transit Electric"] },
      { label: "E-Transit (2022–present)" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Tesla (US)",
    active:    false,
    expertise: "Tesla US market — Model 3, Model Y, Model S, Model X, Cybertruck — electric drive units, high-voltage battery systems, thermal management, supercharging, OTA updates, 2012–present US spec",
    models: [
      { group: "Model 3" },
      { label: "Model 3 (2017–2023)" },
      { label: "Model 3 Highland (2024–present)" },

      { group: "Model Y" },
      { label: "Model Y (2020–2024)" },
      { label: "Model Y Juniper (2025–present)" },

      { group: "Model S" },
      { label: "Model S (2012–2020)" },
      { label: "Model S (2021–present)" },

      { group: "Model X" },
      { label: "Model X (2015–2020)" },
      { label: "Model X (2021–present)" },

      { group: "Cybertruck" },
      { label: "Cybertruck (2023–present)" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Toyota (US)",
    active:    true,
    expertise: "Toyota US market — Camry, Corolla, RAV4, Highlander, 4Runner, Tacoma, Tundra, Sienna, Venza, GR86, Supra, Sequoia, Land Cruiser — VVT-i, D-4S Direct Injection, Hybrid Synergy Drive, i-FORCE twin turbo V6, 2006–present US spec",
    models: [
      // ── Camry ────────────────────────────────────────────────────────────
      { group: "Camry" },
      { label: "Camry (2007–2011)", powers: ["158 hp – 2.4L I4 2AZ-FE", "268 hp – 3.5L V6 2GR-FE"] },
      { label: "Camry (2012–2017)", powers: ["178 hp – 2.5L I4 2AR-FE", "268 hp – 3.5L V6 2GR-FE", "200 hp – 2.5L Hybrid"] },
      { label: "Camry (2018–2024)", powers: ["203 hp – 2.5L I4 A25A-FKS", "301 hp – 3.5L V6 2GR-FKS", "208 hp – 2.5L Hybrid"] },
      { label: "Camry (2025–present)", powers: ["225 hp – 2.5L Hybrid i4"] },

      // ── Corolla (US) ─────────────────────────────────────────────────────
      { group: "Corolla (US)" },
      { label: "Corolla (2009–2013)", powers: ["132 hp – 1.8L I4 2ZR-FE"] },
      { label: "Corolla (2014–2019)", powers: ["132 hp – 1.8L I4 2ZR-FAE", "140 hp – 1.8L I4 Valvematic"] },
      { label: "Corolla (2020–present)", powers: ["139 hp – 1.8L I4", "169 hp – 2.0L I4 (SE/XSE)", "196 hp – 2.0L Hybrid", "300 hp – 1.6L Turbo GR Corolla"] },

      // ── RAV4 (US) ────────────────────────────────────────────────────────
      { group: "RAV4 (US)" },
      { label: "RAV4 (2006–2012)", powers: ["166 hp – 2.4L I4 2AZ-FE", "179 hp – 2.5L I4 (2009+)", "269 hp – 3.5L V6 2GR-FE"] },
      { label: "RAV4 (2013–2018)", powers: ["176 hp – 2.5L I4 2AR-FE", "194 hp – 2.5L Hybrid"] },
      { label: "RAV4 (2019–present)", powers: ["203 hp – 2.5L I4", "219 hp – 2.5L Hybrid", "302 hp – 2.5L Prime PHEV"] },

      // ── Highlander ───────────────────────────────────────────────────────
      { group: "Highlander" },
      { label: "Highlander (2008–2013)", powers: ["187 hp – 2.7L I4 1AR-FE", "270 hp – 3.5L V6 2GR-FE", "280 hp – 3.5L Hybrid V6"] },
      { label: "Highlander (2014–2019)", powers: ["185 hp – 2.7L I4 1AR-FE", "270 hp – 3.5L V6 2GR-FE", "280 hp – 3.5L Hybrid V6"] },
      { label: "Highlander (2020–present)", powers: ["265 hp – 2.5L Hybrid I4", "295 hp – 2.4L Turbo I4 (2024+)"] },

      // ── Tacoma ───────────────────────────────────────────────────────────
      { group: "Tacoma" },
      { label: "Tacoma (2005–2015)", powers: ["159 hp – 2.7L I4 2TR-FE", "236 hp – 4.0L V6 1GR-FE"] },
      { label: "Tacoma (2016–2023)", powers: ["159 hp – 2.7L I4 2TR-FE", "278 hp – 3.5L V6 2GR-FKS"] },
      { label: "Tacoma (2024–present)", powers: ["228 hp – 2.4L Turbo I4", "278 hp – 2.4L Turbo I4 (2024 TRD Pro)", "326 hp – 2.4L Turbo Hybrid I4 i-FORCE MAX"] },

      // ── Tundra ───────────────────────────────────────────────────────────
      { group: "Tundra" },
      { label: "Tundra (2007–2021)", powers: ["270 hp – 4.0L V6 1GR-FE", "310 hp – 4.6L V8 1UR-FE", "381 hp – 5.7L V8 3UR-FE"] },
      { label: "Tundra (2022–present)", powers: ["348 hp – 3.5L Twin Turbo V6 i-FORCE", "437 hp – 3.5L Twin Turbo Hybrid V6 i-FORCE MAX"] },

      // ── 4Runner ──────────────────────────────────────────────────────────
      { group: "4Runner" },
      { label: "4Runner 5th gen (2010–2024)", powers: ["270 hp – 4.0L V6 1GR-FE"] },
      { label: "4Runner 6th gen (2025–present)", powers: ["278 hp – 2.4L Turbo I4 i-FORCE", "326 hp – 2.4L Turbo Hybrid I4 i-FORCE MAX"] },

      // ── Sequoia ──────────────────────────────────────────────────────────
      { group: "Sequoia" },
      { label: "Sequoia 2nd gen (2008–2022)", powers: ["310 hp – 4.6L V8 1UR-FE", "381 hp – 5.7L V8 3UR-FE"] },
      { label: "Sequoia 3rd gen (2023–present)", powers: ["437 hp – 3.5L Twin Turbo Hybrid V6 i-FORCE MAX"] },

      // ── Sienna ───────────────────────────────────────────────────────────
      { group: "Sienna" },
      { label: "Sienna (2011–2020)", powers: ["266 hp – 2.7L I4 1AR-FE (2011)", "266 hp – 3.5L V6 2GR-FE"] },
      { label: "Sienna (2021–present)", powers: ["245 hp – 2.5L Hybrid I4"] },

      // ── Venza ────────────────────────────────────────────────────────────
      { group: "Venza" },
      { label: "Venza (2009–2015)", powers: ["182 hp – 2.7L I4 1AR-FE", "268 hp – 3.5L V6 2GR-FE"] },
      { label: "Venza (2021–present)", powers: ["219 hp – 2.5L Hybrid I4"] },

      // ── GR86 ─────────────────────────────────────────────────────────────
      { group: "GR86" },
      { label: "86 / FR-S / GR86 1st gen (2013–2020)", powers: ["200 hp – 2.0L Boxer H4 FA20"] },
      { label: "GR86 2nd gen (2022–present)", powers: ["228 hp – 2.4L Boxer H4 FA24"] },

      // ── Supra (US) ───────────────────────────────────────────────────────
      { group: "Supra (US)" },
      { label: "Supra (2020–present)", powers: ["255 hp – 2.0L Turbo I4", "382 hp – 3.0L Turbo I6 B58"] },

      // ── bZ4X (US) ────────────────────────────────────────────────────────
      { group: "bZ4X (US)" },
      { label: "bZ4X (2023–present)", powers: ["201 hp – Electric FWD", "214 hp – Electric AWD"] },

      // ── Land Cruiser (US) ────────────────────────────────────────────────
      { group: "Land Cruiser (US)" },
      { label: "Land Cruiser (2008–2021)", powers: ["381 hp – 5.7L V8 3UR-FE"] },
      { label: "Land Cruiser (2024–present)", powers: ["326 hp – 2.4L Turbo Hybrid I4 i-FORCE MAX"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Scion",
    active:    false,
    expertise: "Legacy Scion US sub-brand — iA and iM transition models later sold as Toyota Yaris iA and Corolla iM — Skyactiv-G and Toyota 2ZR-FE platforms, 2016–2018 US spec",
    models: [
      { group: "iA / iM" },
      { label: "iA / Yaris iA (2016–2018)", powers: ["106 hp – 1.5L Skyactiv-G I4"] },
      { label: "iM / Corolla iM (2016–2018)", powers: ["137 hp – 1.8L 2ZR-FAE I4"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Nissan (US)",
    active:    true,
    expertise: "Nissan US market — Altima, Rogue, Pathfinder, Frontier, Titan, Sentra, Kicks, Murano, Armada, Z — VQ/QR/MR engines, Xtronic CVT, e-POWER, ProPILOT Assist, 2007–present US spec",
    models: [
      // ── Altima ───────────────────────────────────────────────────────────
      { group: "Altima" },
      { label: "Altima (2013–2018)", powers: ["179 hp – 2.5L QR25DE I4", "270 hp – 3.5L VQ35DE V6"] },
      { label: "Altima (2019–present)", powers: ["188 hp – 2.5L QR25DE I4", "248 hp – 2.0L VC-Turbo I4"] },

      // ── Rogue ────────────────────────────────────────────────────────────
      { group: "Rogue" },
      { label: "Rogue (2014–2020)", powers: ["170 hp – 2.5L QR25DE I4", "176 hp – 2.0L Hybrid"] },
      { label: "Rogue (2021–present)", powers: ["201 hp – 1.5L VC-Turbo I3"] },

      // ── Pathfinder ───────────────────────────────────────────────────────
      { group: "Pathfinder" },
      { label: "Pathfinder (2013–2020)", powers: ["260 hp – 3.5L VQ35DE V6", "250 hp – 2.5L Supercharged Hybrid I4"] },
      { label: "Pathfinder (2022–present)", powers: ["284 hp – 3.5L VQ35DD V6"] },

      // ── Frontier ─────────────────────────────────────────────────────────
      { group: "Frontier" },
      { label: "Frontier (2005–2021)", powers: ["152 hp – 2.5L QR25DE I4", "261 hp – 4.0L VQ40DE V6"] },
      { label: "Frontier (2022–present)", powers: ["310 hp – 3.8L VQ38DD V6"] },

      // ── Titan ────────────────────────────────────────────────────────────
      { group: "Titan" },
      { label: "Titan (2017–present)", powers: ["400 hp – 5.6L Endurance V8 VK56VD"] },

      // ── Sentra ───────────────────────────────────────────────────────────
      { group: "Sentra" },
      { label: "Sentra (2013–2019)", powers: ["124 hp – 1.6L I4", "130 hp – 1.8L MRA8DE I4", "188 hp – 1.6L DIG-T Nismo I4"] },
      { label: "Sentra (2020–present)", powers: ["149 hp – 2.0L MR20DD I4"] },

      // ── Kicks ────────────────────────────────────────────────────────────
      { group: "Kicks" },
      { label: "Kicks (2018–present)", powers: ["122 hp – 1.6L HR16DE I4"] },

      // ── Murano ───────────────────────────────────────────────────────────
      { group: "Murano" },
      { label: "Murano (2009–2014)", powers: ["260 hp – 3.5L VQ35DE V6"] },
      { label: "Murano (2015–present)", powers: ["260 hp – 3.5L VQ35DE V6"] },

      // ── Armada ───────────────────────────────────────────────────────────
      { group: "Armada" },
      { label: "Armada (2017–present)", powers: ["400 hp – 5.6L Endurance V8 VK56VD"] },

      // ── Z ────────────────────────────────────────────────────────────────
      { group: "Z" },
      { label: "370Z (2009–2020)", powers: ["332 hp – 3.7L VQ37VHR V6", "350 hp – 3.7L NISMO V6"] },
      { label: "Z (2023–present)", powers: ["400 hp – 3.0L Twin Turbo VR30DDTT V6"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Hyundai (US)",
    active:    true,
    expertise: "Hyundai US market — Elantra, Sonata, Tucson, Santa Fe, Palisade, Venue, Kona, Santa Cruz, IONIQ 5/6 — Smartstream GDi/T-GDi/MPI, HEV/PHEV/EV powertrains, 8DCT/IVT/6AT transmissions, E-GMP platform, 2010–present US spec",
    models: [
      // ── Elantra ──────────────────────────────────────────────────────────
      { group: "Elantra" },
      { label: "Elantra (2011–2016)", powers: ["145 hp – 1.8L Nu MPI I4", "173 hp – 2.0L Nu GDi I4", "201 hp – 1.6L Gamma T-GDi Sport"] },
      { label: "Elantra (2017–2020)", powers: ["147 hp – 2.0L Nu MPI I4", "201 hp – 1.6L Gamma T-GDi Sport"] },
      { label: "Elantra (2021–present)", powers: ["147 hp – 2.0L Smartstream MPI I4", "201 hp – 1.6L Smartstream T-GDi N Line", "276 hp – 2.0L Smartstream T-GDi N", "139 hp – 1.6L Smartstream HEV"] },

      // ── Sonata ───────────────────────────────────────────────────────────
      { group: "Sonata" },
      { label: "Sonata (2011–2014)", powers: ["198 hp – 2.4L Theta GDi I4", "274 hp – 2.0L Theta T-GDi I4", "199 hp – 2.4L Hybrid"] },
      { label: "Sonata (2015–2019)", powers: ["185 hp – 2.4L Theta GDi I4", "245 hp – 2.0L Theta T-GDi I4", "193 hp – 2.0L Hybrid"] },
      { label: "Sonata (2020–present)", powers: ["191 hp – 2.5L Smartstream GDi I4", "290 hp – 1.6L Smartstream T-GDi I4", "192 hp – 2.0L Smartstream HEV"] },

      // ── Tucson (US) ──────────────────────────────────────────────────────
      { group: "Tucson (US)" },
      { label: "Tucson (2010–2015)", powers: ["165 hp – 2.0L GDi I4", "176 hp – 2.4L GDi I4"] },
      { label: "Tucson (2016–2021)", powers: ["164 hp – 2.0L MPI I4", "175 hp – 1.6L T-GDi I4"] },
      { label: "Tucson (2022–present)", powers: ["187 hp – 2.5L Smartstream GDi I4", "227 hp – 1.6L Smartstream T-GDi HEV", "261 hp – 1.6L Smartstream T-GDi PHEV"] },

      // ── Santa Fe (US) ────────────────────────────────────────────────────
      { group: "Santa Fe (US)" },
      { label: "Santa Fe (2010–2018)", powers: ["190 hp – 2.4L GDi I4", "264 hp – 2.0L T-GDi I4", "290 hp – 3.3L V6 GDi"] },
      { label: "Santa Fe (2019–2023)", powers: ["191 hp – 2.5L GDi I4", "281 hp – 2.5L T-GDi I4"] },
      { label: "Santa Fe (2024–present)", powers: ["277 hp – 2.5L T-GDi I4", "232 hp – 1.6L T-GDi HEV", "268 hp – 1.6L T-GDi PHEV"] },

      // ── Palisade ─────────────────────────────────────────────────────────
      { group: "Palisade" },
      { label: "Palisade (2020–present)", powers: ["291 hp – 3.8L Lambda V6 GDi", "277 hp – 2.5L T-GDi I4 (2026+)"] },

      // ── Kona (US) ────────────────────────────────────────────────────────
      { group: "Kona (US)" },
      { label: "Kona (2018–2023)", powers: ["147 hp – 2.0L MPI I4", "175 hp – 1.6L T-GDi I4", "201 hp – Electric 64 kWh"] },
      { label: "Kona (2024–present)", powers: ["190 hp – 2.0L MPI I4", "201 hp – Electric 64 kWh"] },

      // ── Venue ────────────────────────────────────────────────────────────
      { group: "Venue" },
      { label: "Venue (2020–present)", powers: ["121 hp – 1.6L Smartstream MPI I4"] },

      // ── Santa Cruz ───────────────────────────────────────────────────────
      { group: "Santa Cruz" },
      { label: "Santa Cruz (2022–present)", powers: ["191 hp – 2.5L Smartstream GDi I4", "281 hp – 2.5L Smartstream T-GDi I4"] },

      // ── IONIQ 5 / IONIQ 6 (US) ──────────────────────────────────────────
      { group: "IONIQ (US)" },
      { label: "IONIQ 5 (2022–present)", powers: ["168 hp – Standard Range RWD", "225 hp – Long Range RWD", "320 hp – Long Range AWD", "601 hp – N AWD"] },
      { label: "IONIQ 6 (2023–present)", powers: ["149 hp – Standard Range RWD", "225 hp – Long Range RWD", "320 hp – Long Range AWD"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Kia (US)",
    active:    true,
    expertise: "Kia US market — Forte, K5, Seltos, Sportage, Sorento, Telluride, Carnival, Soul, Niro, EV6, EV9 — Smartstream GDi/T-GDi, HEV/PHEV/EV powertrains, DCT/IVT/8AT transmissions, E-GMP platform, 2010–present US spec",
    models: [
      // ── Forte ────────────────────────────────────────────────────────────
      { group: "Forte" },
      { label: "Forte (2014–2018)", powers: ["164 hp – 2.0L Nu GDi I4", "201 hp – 1.6L Gamma T-GDi I4"] },
      { label: "Forte (2019–present)", powers: ["147 hp – 2.0L Smartstream MPI I4", "201 hp – 1.6L Smartstream T-GDi GT"] },

      // ── K5 (Optima) ──────────────────────────────────────────────────────
      { group: "K5" },
      { label: "Optima (2011–2020)", powers: ["185 hp – 2.4L Theta GDi I4", "245 hp – 2.0L Theta T-GDi I4", "193 hp – 2.0L Hybrid"] },
      { label: "K5 (2021–present)", powers: ["180 hp – 1.6L Smartstream T-GDi I4", "290 hp – 2.5L Smartstream T-GDi GT"] },

      // ── Seltos ───────────────────────────────────────────────────────────
      { group: "Seltos" },
      { label: "Seltos (2021–present)", powers: ["146 hp – 2.0L MPI I4", "175 hp – 1.6L T-GDi I4"] },

      // ── Sportage (US) ────────────────────────────────────────────────────
      { group: "Sportage (US)" },
      { label: "Sportage (2011–2016)", powers: ["176 hp – 2.4L GDi I4", "260 hp – 2.0L T-GDi I4"] },
      { label: "Sportage (2017–2022)", powers: ["181 hp – 2.4L GDi I4", "237 hp – 2.0L T-GDi I4"] },
      { label: "Sportage (2023–present)", powers: ["187 hp – 2.5L GDi I4", "227 hp – 1.6L T-GDi HEV", "261 hp – 1.6L T-GDi PHEV"] },

      // ── Sorento (US) ─────────────────────────────────────────────────────
      { group: "Sorento (US)" },
      { label: "Sorento (2011–2020)", powers: ["185 hp – 2.4L GDi I4", "290 hp – 3.3L V6 GDi"] },
      { label: "Sorento (2021–present)", powers: ["191 hp – 2.5L GDi I4", "281 hp – 2.5L T-GDi I4", "227 hp – 1.6L T-GDi HEV", "261 hp – 1.6L T-GDi PHEV"] },

      // ── Telluride ────────────────────────────────────────────────────────
      { group: "Telluride" },
      { label: "Telluride (2020–present)", powers: ["291 hp – 3.8L V6 GDi", "277 hp – 2.5L T-GDi I4 (2026+)"] },

      // ── Carnival ─────────────────────────────────────────────────────────
      { group: "Carnival" },
      { label: "Carnival (2022–present)", powers: ["290 hp – 3.5L V6 GDi"] },

      // ── Soul ─────────────────────────────────────────────────────────────
      { group: "Soul" },
      { label: "Soul (2014–2019)", powers: ["130 hp – 1.6L MPI I4", "164 hp – 2.0L GDi I4", "201 hp – 1.6L T-GDi I4", "109 hp – Electric 27 kWh"] },
      { label: "Soul (2020–present)", powers: ["147 hp – 2.0L MPI I4", "201 hp – Electric 64 kWh"] },

      // ── Niro (US) ───────────────────────────────────────────────────────
      { group: "Niro (US)" },
      { label: "Niro (2017–2022)", powers: ["139 hp – 1.6L GDi HEV", "139 hp – 1.6L GDi PHEV", "201 hp – Electric e-Niro"] },
      { label: "Niro (2023–present)", powers: ["139 hp – 1.6L GDi HEV", "180 hp – 1.6L GDi PHEV", "201 hp – Electric Niro EV", "253 hp – Electric Niro EV Wind/Wave+"] },

      // ── EV6 (US) ─────────────────────────────────────────────────────────
      { group: "EV6 (US)" },
      { label: "EV6 (2022–present)", powers: ["167 hp – Standard Range RWD", "225 hp – Long Range RWD", "320 hp – Long Range AWD", "576 hp – GT AWD"] },

      // ── EV9 (US) ─────────────────────────────────────────────────────────
      { group: "EV9 (US)" },
      { label: "EV9 (2024–present)", powers: ["201 hp – Standard Range RWD", "379 hp – Long Range AWD", "379 hp – GT-Line AWD"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Porsche",
    active:    false,
    expertise: "Porsche US market — 911, 718 Boxster/Cayman, Cayenne, Macan, Panamera, Taycan — turbocharged flat-six/four engines, PDK, AWD, PHEV and EV platforms, 2003–present US spec",
    models: [
      { group: "911" },
      { label: "911 (2005–2011)" },
      { label: "911 (2012–2018)" },
      { label: "911 (2019–present)" },
      { group: "718 / Boxster / Cayman" },
      { label: "Boxster / Cayman (2005–2012)" },
      { label: "Boxster / Cayman (2013–2016)" },
      { label: "718 Boxster / Cayman (2017–present)" },
      { group: "Cayenne" },
      { label: "Cayenne (2003–2010)" },
      { label: "Cayenne (2011–2017)" },
      { label: "Cayenne (2018–present)" },
      { group: "Panamera" },
      { label: "Panamera (2010–2016)" },
      { label: "Panamera (2017–2023)" },
      { label: "Panamera (2024–present)" },
      { group: "Macan / Taycan" },
      { label: "Macan (2015–2024)" },
      { label: "Macan Electric (2024–present)" },
      { label: "Taycan (2020–present)" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Land Rover",
    active:    false,
    expertise: "Land Rover US market — Defender, Discovery, Discovery Sport, Range Rover, Range Rover Sport, Range Rover Evoque, Range Rover Velar — Ingenium petrol/diesel, mild hybrid, PHEV and 4WD systems, 2003–present US spec",
    models: [
      { group: "Discovery / Discovery Sport" },
      { label: "Discovery / LR3 (2005–2009)" },
      { label: "Discovery / LR4 (2010–2016)" },
      { label: "Discovery (2017–present)" },
      { label: "Discovery Sport (2015–present)" },
      { group: "Range Rover Evoque / Velar" },
      { label: "Range Rover Evoque (2012–2018)" },
      { label: "Range Rover Evoque (2019–present)" },
      { label: "Range Rover Velar (2018–present)" },
      { group: "Range Rover / Sport / Defender" },
      { label: "Range Rover (2003–2012)" },
      { label: "Range Rover (2013–2021)" },
      { label: "Range Rover (2022–present)" },
      { label: "Range Rover Sport (2006–2013)" },
      { label: "Range Rover Sport (2014–2022)" },
      { label: "Range Rover Sport (2023–present)" },
      { label: "Defender (2020–present)" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Jaguar",
    active:    false,
    expertise: "Jaguar US market — XE, XF, XJ, F-PACE, E-PACE, I-PACE, F-TYPE — Ingenium petrol/diesel, supercharged V6/V8, PHEV and EV powertrains, 2003–present US spec",
    models: [
      { group: "Sedans" },
      { label: "XJ (2003–2009)" },
      { label: "XJ (2010–2019)" },
      { label: "XF (2009–2015)" },
      { label: "XF (2016–present)" },
      { label: "XE (2017–present)" },
      { group: "SUV / Sports" },
      { label: "F-PACE (2017–present)" },
      { label: "E-PACE (2018–present)" },
      { label: "I-PACE (2019–present)" },
      { label: "F-TYPE (2014–2024)" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Mitsubishi",
    active:    false,
    expertise: "Mitsubishi US market — Outlander, Outlander PHEV, Outlander Sport, Eclipse Cross, Mirage, Lancer — MIVEC petrol engines, S-AWC/AWC, PHEV and compact crossover platforms, 2003–present US spec",
    models: [
      { group: "Lancer" },
      { label: "Lancer (2003–2007)" },
      { label: "Lancer (2008–2017)" },
      { group: "Outlander / Eclipse Cross" },
      { label: "Outlander (2007–2013)" },
      { label: "Outlander (2014–2021)" },
      { label: "Outlander (2022–present)" },
      { label: "Outlander PHEV (2018–present)" },
      { label: "Outlander Sport / ASX (2011–2024)" },
      { label: "Eclipse Cross (2018–present)" },
      { group: "Mirage / EV" },
      { label: "Mirage / Mirage G4 (2014–2024)" },
      { label: "i-MiEV (2012–2017)" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Alfa Romeo",
    active:    false,
    expertise: "Alfa Romeo US market — Giulia, Stelvio, Tonale, 4C — turbo petrol and PHEV powertrains, ZF 8AT, Q4 AWD, 2015–present US spec",
    models: [
      { group: "Sedan / SUV" },
      { label: "Giulia (2017–present)" },
      { label: "Stelvio (2018–present)" },
      { label: "Tonale (2023–present)" },
      { group: "Sports" },
      { label: "4C (2015–2020)" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Bentley",
    active:    false,
    expertise: "Bentley US market — Continental GT, Continental GTC, Flying Spur, Bentayga, Mulsanne, Arnage — W12, V8 and hybrid luxury powertrains, AWD and grand touring platforms, 2001–present US spec",
    models: [
      { group: "Arnage / Mulsanne" },
      { label: "Arnage (2001–2009)" },
      { label: "Mulsanne (2010–2020)" },
      { group: "Continental / Flying Spur / Bentayga" },
      { label: "Continental GT (2004–2017)" },
      { label: "Continental GT (2018–present)" },
      { label: "Continental GTC (2005–2018)" },
      { label: "Continental GTC (2019–present)" },
      { label: "Flying Spur (2006–2019)" },
      { label: "Flying Spur (2020–present)" },
      { label: "Bentayga (2017–present)" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Maserati",
    active:    false,
    expertise: "Maserati US market — Ghibli, Quattroporte, Levante, Grecale, GranTurismo, MC20 — twin-turbo V6/V8, Nettuno V6 and EV variants, 2004–present US spec",
    models: [
      { group: "Sedan / SUV" },
      { label: "Quattroporte (2004–2012)" },
      { label: "Quattroporte (2013–2023)" },
      { label: "Ghibli (2014–2024)" },
      { label: "Levante (2017–2024)" },
      { label: "Grecale (2023–present)" },
      { group: "Sports" },
      { label: "GranTurismo (2008–2019)" },
      { label: "GranTurismo (2024–present)" },
      { label: "MC20 (2022–present)" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Volvo (US)",
    active:    false,
      expertise: "Volvo Cars US passenger lineup — S60, S90, V60, V60 Cross Country, V90, V90 Cross Country, XC40, XC60, XC90, EX30, EX40, EC40 and EX90 — B5/B6 mild hybrid, T8 plug-in hybrid and newer BEV drivetrains, 2016–present US spec",
    models: [
      { group: "S60" },
      { label: "S60 (2019–2025)", powers: ["247 hp – B5 AWD mild hybrid", "455 hp – T8 AWD plug-in hybrid"] },

      { group: "S90" },
      { label: "S90 (2017–present)", powers: ["295 hp – B6 AWD mild hybrid", "455 hp – T8 AWD plug-in hybrid"] },

        { group: "V60" },
        { label: "V60 (2019–2024)", powers: ["455 hp – T8 AWD plug-in hybrid"] },
        { label: "V60 Cross Country (2020–present)", powers: ["247 hp – B5 AWD mild hybrid"] },

        { group: "V90" },
        { label: "V90 (2017–present)", powers: ["295 hp – B6 AWD mild hybrid", "455 hp – T8 AWD plug-in hybrid"] },

        { group: "V90 Cross Country" },
        { label: "V90 Cross Country (2018–present)", powers: ["295 hp – B6 AWD mild hybrid"] },

      { group: "XC40" },
      { label: "XC40 (2019–present)", powers: ["247 hp – B5 AWD mild hybrid"] },
      { label: "XC40 Recharge / EX40 (2021–present)", powers: ["248 hp – Single Motor EV", "402 hp – Twin Motor EV AWD"] },

      { group: "EC40" },
      { label: "C40 Recharge / EC40 (2022–present)", powers: ["248 hp – Single Motor EV", "402 hp – Twin Motor EV AWD"] },

      { group: "XC60" },
      { label: "XC60 (2018–present)", powers: ["247 hp – B5 AWD mild hybrid", "455 hp – T8 AWD plug-in hybrid"] },

      { group: "XC90" },
      { label: "XC90 (2016–present)", powers: ["247 hp – B5 AWD mild hybrid", "455 hp – T8 AWD plug-in hybrid"] },

      { group: "EX30" },
      { label: "EX30 (2025–present)", powers: ["268 hp – Single Motor Extended Range EV", "422 hp – Twin Motor Performance EV"] },

      { group: "EX90" },
      { label: "EX90 (2025–present)", powers: ["402 hp – Twin Motor EV AWD", "510 hp – Twin Motor Performance EV AWD"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Polestar",
    active:    false,
    expertise: "Polestar EV lineup — Polestar 1, 2, 3 and 4 — dual-motor EV and performance hybrid architectures, OTA diagnostics, thermal management and charging systems, 2020–present US spec",
    models: [
      { group: "Polestar" },
      { label: "Polestar 1 (2020–2021)" },
      { label: "Polestar 2 (2021–present)" },
      { label: "Polestar 3 (2024–present)" },
      { label: "Polestar 4 (2025–present)" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "MINI",
    active:    false,
    expertise: "MINI US market — Cooper 2 Door/4 Door, Convertible, Clubman, Countryman — BMW-sourced turbo petrol engines and newer EV drivetrains, 2014–present US spec",
    models: [
      { group: "Cooper / Convertible" },
      { label: "Cooper 2 Door / 4 Door (2014–2024)" },
      { label: "Convertible (2016–present)" },
      { group: "Clubman / Countryman" },
      { label: "Clubman (2016–2024)" },
      { label: "Countryman (2017–2024)" },
      { label: "Countryman (2025–present)" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Maybach",
    active:    false,
    expertise: "Legacy standalone Maybach luxury sedans — 57 and 62 plus S variants — twin-turbo V12 powertrains, ABC suspension and comfort electronics, 2002–2012 US spec",
    models: [
      { group: "57 / 62" },
      { label: "57 / 62 (2002–2012)", powers: ["543 hp – 5.5L twin-turbo V12", "604 hp – 6.0L twin-turbo V12 S"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Smart",
    active:    false,
    expertise: "smart US microcars — fortwo coupe/cabrio and electric drive — rear-mounted 1.0L/0.9L petrol engines and ED EV drivetrains, 2008–2019 US spec",
    models: [
      { group: "fortwo" },
      { label: "fortwo 451 (2008–2015)", powers: ["70 hp – 1.0L M132 I3", "84 hp – 1.0L turbo I3"] },
      { label: "fortwo Electric Drive (2013–2015)", powers: ["74 hp – Electric Drive"] },
      { label: "fortwo 453 (2016–2019)", powers: ["89 hp – 0.9L turbo I3"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Rivian",
    active:    false,
    expertise: "Rivian EV lineup — R1T, R1S and commercial delivery van platforms — quad/dual-motor electric drivetrains, thermal management, air suspension, OTA updates, 2022–present US spec",
    models: [
      { group: "R1 / Commercial" },
      { label: "R1T (2022–present)" },
      { label: "R1S (2023–present)" },
      { label: "EDV / Commercial Van (2022–present)" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Lucid",
    active:    false,
    expertise: "Lucid EV lineup — Air and Gravity — high-voltage battery systems, drive units, thermal management, charging and OTA diagnostics, 2022–present US spec",
    models: [
      { group: "Lucid" },
      { label: "Air (2022–present)" },
      { label: "Gravity (2025–present)" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Volkswagen (US)",
    active:    true,
    expertise: "Volkswagen US market — Jetta, Tiguan, Atlas, Atlas Cross Sport, Taos, Arteon, Golf GTI/R, ID.4 — TSI turbo engines, 8AT/6MT/DSG, 4MOTION AWD, MEB EV platform, 2011–present US spec",
    models: [
      // ── Jetta (US) ──────────────────────────────────────────────────────
      { group: "Jetta (US)" },
      { label: "Jetta (2011–2018)", powers: ["115 hp – 2.0L NA I4", "150 hp – 1.4L TSI I4", "170 hp – 1.8L TSI I4", "210 hp – 2.0L TSI GLI"] },
      { label: "Jetta (2019–present)", powers: ["158 hp – 1.5L TSI I4", "228 hp – 2.0L TSI GLI"] },

      // ── Tiguan (US) ──────────────────────────────────────────────────────
      { group: "Tiguan (US)" },
      { label: "Tiguan (2009–2017)", powers: ["200 hp – 2.0L TSI I4"] },
      { label: "Tiguan (2018–present)", powers: ["184 hp – 2.0L TSI I4", "228 hp – 2.0L TSI R-Line (2024+)"] },

      // ── Atlas ────────────────────────────────────────────────────────────
      { group: "Atlas" },
      { label: "Atlas (2018–present)", powers: ["235 hp – 2.0L TSI I4", "269 hp – 3.6L VR6", "276 hp – 2.0L TSI (2024+)"] },

      // ── Atlas Cross Sport ────────────────────────────────────────────────
      { group: "Atlas Cross Sport" },
      { label: "Atlas Cross Sport (2020–present)", powers: ["235 hp – 2.0L TSI I4", "276 hp – 3.6L VR6", "276 hp – 2.0L TSI (2024+)"] },

      // ── Taos ─────────────────────────────────────────────────────────────
      { group: "Taos" },
      { label: "Taos (2022–present)", powers: ["158 hp – 1.5L TSI I4"] },

      // ── Arteon (US) ─────────────────────────────────────────────────────
      { group: "Arteon (US)" },
      { label: "Arteon (2019–2023)", powers: ["268 hp – 2.0L TSI I4", "300 hp – 2.0L TSI 4MOTION I4"] },

      // ── Golf GTI / Golf R (US) ──────────────────────────────────────────
      { group: "Golf GTI / R (US)" },
      { label: "Golf GTI (2015–2021)", powers: ["210 hp – 2.0L TSI EA888 I4", "228 hp – 2.0L TSI EA888 I4 (2018+)"] },
      { label: "Golf GTI (2022–present)", powers: ["241 hp – 2.0L TSI EA888 I4"] },
      { label: "Golf R (2015–2021)", powers: ["288 hp – 2.0L TSI EA888 I4", "292 hp – 2.0L TSI EA888 I4 (2018+)"] },
      { label: "Golf R (2022–present)", powers: ["315 hp – 2.0L TSI EA888 I4"] },

      // ── ID.4 (US) ────────────────────────────────────────────────────────
      { group: "ID.4 (US)" },
      { label: "ID.4 (2021–present)", powers: ["201 hp – Standard Range RWD", "275 hp – Pro S RWD", "295 hp – Pro S AWD", "335 hp – GTX AWD"] },
    ],
  },

]
