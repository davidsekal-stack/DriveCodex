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
    expertise: "Chevrolet full lineup — Silverado, Colorado, Equinox, Traverse, Tahoe/Suburban, Camaro, Corvette, Malibu, Trailblazer — EcoTec3 V6/V8 engines, Duramax Diesel, 2.7L Turbo, LT1/LT2/LS engine family, GM 6L80/10L80 transmissions, stabilitrak, AFM/DFM cylinder deactivation, 2007–present US spec",
    models: [
      // ── Silverado 1500 ────────────────────────────────────────────────────
      { group: "Silverado 1500" },
      { label: "Silverado 1500 (2007–2013)", powers: ["195 hp – 4.3L V6", "295 hp – 4.8L V8", "315 hp – 5.3L EcoTec V8", "367 hp – 6.0L V8", "403 hp – 6.2L V8"] },
      { label: "Silverado 1500 (2014–2018)", powers: ["285 hp – 4.3L EcoTec3 V6", "355 hp – 5.3L EcoTec3 V8", "420 hp – 6.2L EcoTec3 V8"] },
      { label: "Silverado 1500 (2019–present)", powers: ["285 hp – 4.3L EcoTec3 V6", "310 hp – 2.7L Turbo I4", "355 hp – 5.3L EcoTec3 V8", "277 hp – 3.0L Duramax Diesel I6", "420 hp – 6.2L EcoTec3 V8"] },

      // ── Silverado HD ──────────────────────────────────────────────────────
      { group: "Silverado HD (2500/3500)" },
      { label: "Silverado HD (2011–2019)", powers: ["360 hp – 6.0L V8", "445 hp – 6.6L Duramax LML/L5P Diesel"] },
      { label: "Silverado HD (2020–present)", powers: ["401 hp – 6.6L V8 Gasoline", "445 hp – 6.6L Duramax L5P Diesel", "470 hp – 6.6L Duramax L5P Diesel (2021+)"] },

      // ── Colorado ──────────────────────────────────────────────────────────
      { group: "Colorado" },
      { label: "Colorado (2015–2022)", powers: ["200 hp – 2.5L I4", "308 hp – 3.6L V6", "186 hp – 2.8L Duramax Diesel I4"] },
      { label: "Colorado (2023–present)", powers: ["237 hp – 2.7L Turbo I4", "310 hp – 2.7L Turbo High-Output I4"] },

      // ── Equinox ───────────────────────────────────────────────────────────
      { group: "Equinox" },
      { label: "Equinox (2010–2017)", powers: ["182 hp – 2.4L I4 DOHC", "301 hp – 3.6L V6"] },
      { label: "Equinox (2018–present)", powers: ["170 hp – 1.5L Turbo I4", "252 hp – 2.0L Turbo I4", "137 hp – 1.6L Diesel (2018–20)"] },

      // ── Traverse ─────────────────────────────────────────────────────────
      { group: "Traverse" },
      { label: "Traverse (2009–2017)", powers: ["281 hp – 3.6L V6 SIDI"] },
      { label: "Traverse (2018–present)", powers: ["193 hp – 2.5L I4", "310 hp – 3.6L V6"] },

      // ── Tahoe / Suburban ─────────────────────────────────────────────────
      { group: "Tahoe / Suburban" },
      { label: "Tahoe/Suburban (2007–2014)", powers: ["315 hp – 5.3L EcoTec V8", "403 hp – 6.2L V8"] },
      { label: "Tahoe/Suburban (2015–2020)", powers: ["355 hp – 5.3L EcoTec3 V8"] },
      { label: "Tahoe/Suburban (2021–present)", powers: ["355 hp – 5.3L EcoTec3 V8", "277 hp – 3.0L Duramax Diesel I6", "420 hp – 6.2L EcoTec3 V8"] },

      // ── Trailblazer ───────────────────────────────────────────────────────
      { group: "Trailblazer" },
      { label: "Trailblazer (2021–present)", powers: ["137 hp – 1.2L Turbo I3", "155 hp – 1.3L Turbo I3"] },

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
      { label: "Corvette C8 Stingray (2020–present)", powers: ["490 hp – 6.2L LT2 V8", "495 hp – 6.2L LT2 V8 (Z51)", "670 hp – 5.5L LT6 NA V8 Z06", "655 hp – 6.6L Twin Turbo E-Ray Hybrid"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "GMC",
    active:    true,
    expertise: "GMC trucks and SUVs — Sierra 1500/HD, Canyon, Terrain, Acadia, Yukon/Yukon XL — EcoTec3 V6/V8, Duramax Diesel, 2.7L Turbo, GM 6L80/10L80/10L1000 transmissions, 2007–present US spec. Shares most platforms and powertrains with Chevrolet",
    models: [
      // ── Sierra 1500 ───────────────────────────────────────────────────────
      { group: "Sierra 1500" },
      { label: "Sierra 1500 (2007–2013)", powers: ["195 hp – 4.3L V6", "295 hp – 4.8L V8", "315 hp – 5.3L EcoTec V8", "367 hp – 6.0L V8", "403 hp – 6.2L V8"] },
      { label: "Sierra 1500 (2014–2018)", powers: ["285 hp – 4.3L EcoTec3 V6", "355 hp – 5.3L EcoTec3 V8", "420 hp – 6.2L EcoTec3 V8"] },
      { label: "Sierra 1500 (2019–present)", powers: ["285 hp – 4.3L EcoTec3 V6", "310 hp – 2.7L Turbo I4", "355 hp – 5.3L EcoTec3 V8", "277 hp – 3.0L Duramax Diesel I6", "420 hp – 6.2L EcoTec3 V8"] },

      // ── Sierra HD ─────────────────────────────────────────────────────────
      { group: "Sierra HD (2500/3500)" },
      { label: "Sierra HD (2011–2019)", powers: ["360 hp – 6.0L V8", "445 hp – 6.6L Duramax LML/L5P Diesel"] },
      { label: "Sierra HD (2020–present)", powers: ["401 hp – 6.6L V8 Gasoline", "445 hp – 6.6L Duramax L5P Diesel", "470 hp – 6.6L Duramax L5P Diesel (2021+)"] },

      // ── Canyon ────────────────────────────────────────────────────────────
      { group: "Canyon" },
      { label: "Canyon (2015–2022)", powers: ["200 hp – 2.5L I4", "308 hp – 3.6L V6", "186 hp – 2.8L Duramax Diesel I4"] },
      { label: "Canyon (2023–present)", powers: ["237 hp – 2.7L Turbo I4", "310 hp – 2.7L Turbo High-Output I4"] },

      // ── Terrain ───────────────────────────────────────────────────────────
      { group: "Terrain" },
      { label: "Terrain (2010–2017)", powers: ["182 hp – 2.4L I4 DOHC", "301 hp – 3.6L V6"] },
      { label: "Terrain (2018–present)", powers: ["170 hp – 1.5L Turbo I4", "252 hp – 2.0L Turbo I4"] },

      // ── Acadia ────────────────────────────────────────────────────────────
      { group: "Acadia" },
      { label: "Acadia (2007–2016)", powers: ["281 hp – 3.6L V6 SIDI"] },
      { label: "Acadia (2017–2023)", powers: ["193 hp – 2.5L I4", "310 hp – 3.6L V6"] },
      { label: "Acadia (2024–present)", powers: ["228 hp – 2.0L Turbo I4", "328 hp – 2.5L Turbo I4"] },

      // ── Yukon / Yukon XL ─────────────────────────────────────────────────
      { group: "Yukon / Yukon XL" },
      { label: "Yukon/Yukon XL (2007–2014)", powers: ["315 hp – 5.3L EcoTec V8", "403 hp – 6.2L V8"] },
      { label: "Yukon/Yukon XL (2015–2020)", powers: ["355 hp – 5.3L EcoTec3 V8"] },
      { label: "Yukon/Yukon XL (2021–present)", powers: ["355 hp – 5.3L EcoTec3 V8", "277 hp – 3.0L Duramax Diesel I6", "420 hp – 6.2L EcoTec3 V8"] },
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
      { label: "Ram 1500 TRX (2021–present)", powers: ["702 hp – 6.2L Supercharged HEMI V8"] },

      // ── Ram 2500 ──────────────────────────────────────────────────────────
      { group: "Ram 2500" },
      { label: "Ram 2500 (2010–2018)", powers: ["383 hp – 5.7L HEMI V8", "410 hp – 6.4L HEMI V8", "370 hp – 6.7L Cummins Diesel I6"] },
      { label: "Ram 2500 (2019–present)", powers: ["410 hp – 6.4L HEMI V8", "370 hp – 6.7L Cummins Diesel I6", "400 hp – 6.7L Cummins HO Diesel I6"] },

      // ── Ram 3500 ──────────────────────────────────────────────────────────
      { group: "Ram 3500" },
      { label: "Ram 3500 (2013–2018)", powers: ["383 hp – 5.7L HEMI V8", "410 hp – 6.4L HEMI V8", "350 hp – 6.7L Cummins Diesel I6", "385 hp – 6.7L Cummins HO Diesel I6"] },
      { label: "Ram 3500 (2019–present)", powers: ["410 hp – 6.4L HEMI V8", "370 hp – 6.7L Cummins Diesel I6", "400 hp – 6.7L Cummins HO Diesel I6"] },

      // ── ProMaster ─────────────────────────────────────────────────────────
      { group: "ProMaster" },
      { label: "ProMaster (2014–present)", powers: ["280 hp – 3.6L Pentastar V6", "140 hp – 3.0L VM Diesel I4"] },
      { label: "ProMaster City (2015–present)", powers: ["178 hp – 2.4L I4 Tigershark"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Jeep",
    active:    true,
    expertise: "Jeep SUVs and trucks — Wrangler JK/JL, Grand Cherokee WK2/WL, Cherokee KL, Compass, Renegade, Gladiator — 3.6L Pentastar V6, 2.0L Hurricane Turbo, 5.7L/6.4L HEMI, 3.0L EcoDiesel, 4xe PHEV, Dana axles, NV transfer cases, Rock-Trac 4WD, 2007–present US spec",
    models: [
      // ── Wrangler ─────────────────────────────────────────────────────────
      { group: "Wrangler" },
      { label: "Wrangler JK (2007–2011)", powers: ["202 hp – 3.8L V6"] },
      { label: "Wrangler JK (2012–2018)", powers: ["285 hp – 3.6L Pentastar V6"] },
      { label: "Wrangler JL (2018–present)", powers: ["270 hp – 2.0L Hurricane Turbo I4", "285 hp – 3.6L Pentastar V6 eTorque", "260 hp – 3.0L EcoDiesel V6", "375 hp – 2.0L 4xe PHEV", "470 hp – 6.4L HEMI V8 392"] },

      // ── Grand Cherokee ────────────────────────────────────────────────────
      { group: "Grand Cherokee" },
      { label: "Grand Cherokee WK2 (2011–2021)", powers: ["290 hp – 3.6L Pentastar V6", "357 hp – 5.7L HEMI V8", "475 hp – 6.4L HEMI SRT V8", "707 hp – 6.2L Supercharged Trackhawk V8", "240 hp – 3.0L EcoDiesel V6"] },
      { label: "Grand Cherokee WL (2021–present)", powers: ["270 hp – 2.0L Hurricane Turbo I4", "293 hp – 3.6L Pentastar V6", "357 hp – 5.7L HEMI V8", "375 hp – 2.0L 4xe PHEV", "510 hp – 6.2L Supercharged 4xe PHEV"] },

      // ── Cherokee ──────────────────────────────────────────────────────────
      { group: "Cherokee" },
      { label: "Cherokee KL (2014–2023)", powers: ["180 hp – 2.4L Tigershark I4", "271 hp – 3.2L Pentastar V6", "270 hp – 2.0L Hurricane Turbo I4"] },

      // ── Compass ───────────────────────────────────────────────────────────
      { group: "Compass" },
      { label: "Compass (2017–present)", powers: ["177 hp – 2.4L Tigershark I4", "200 hp – 1.3L Turbo I4"] },

      // ── Renegade ─────────────────────────────────────────────────────────
      { group: "Renegade" },
      { label: "Renegade (2015–present)", powers: ["160 hp – 1.4L MultiAir Turbo I4", "180 hp – 2.4L Tigershark I4", "180 hp – 1.3L Turbo I4"] },

      // ── Gladiator ─────────────────────────────────────────────────────────
      { group: "Gladiator" },
      { label: "Gladiator (2020–present)", powers: ["285 hp – 3.6L Pentastar V6", "260 hp – 3.0L EcoDiesel V6"] },
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
      { label: "Charger (2015–present)", powers: ["292 hp – 3.6L Pentastar V6", "300 hp – 3.6L Pentastar V6 AWD", "370 hp – 5.7L HEMI R/T V8", "485 hp – 6.4L HEMI 392 V8", "707 hp – 6.2L Supercharged Hellcat V8", "797 hp – 6.2L Supercharged Hellcat Redeye V8"] },

      // ── Durango ───────────────────────────────────────────────────────────
      { group: "Durango" },
      { label: "Durango (2011–2020)", powers: ["293 hp – 3.6L Pentastar V6", "360 hp – 5.7L HEMI V8", "475 hp – 6.4L HEMI SRT V8"] },
      { label: "Durango (2021–present)", powers: ["293 hp – 3.6L Pentastar V6", "357 hp – 5.7L HEMI V8", "475 hp – 6.4L HEMI SRT V8", "710 hp – 6.2L Supercharged Hellcat V8"] },
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
      { label: "Civic 11th gen (2022–present)", powers: ["158 hp – 2.0L DOHC I4 (LX/Sport)", "192 hp – 1.5L VTEC Turbo I4", "200 hp – 1.5L VTEC Turbo Si", "315 hp – 2.0L DOHC Turbo Type R"] },

      // ── Accord ────────────────────────────────────────────────────────────
      { group: "Accord" },
      { label: "Accord 8th gen (2008–2012)", powers: ["177 hp – 2.4L i-VTEC I4", "271 hp – 3.5L i-VTEC V6"] },
      { label: "Accord 9th gen (2013–2017)", powers: ["185 hp – 2.4L i-VTEC I4", "278 hp – 3.5L i-VTEC V6", "196 hp – 2.0L IMA Hybrid"] },
      { label: "Accord 10th gen (2018–2022)", powers: ["192 hp – 1.5L Turbo I4", "252 hp – 2.0L Turbo I4", "212 hp – 2.0L Hybrid i-MMD"] },
      { label: "Accord 11th gen (2023–present)", powers: ["192 hp – 1.5L Turbo I4", "204 hp – 2.0L Hybrid i-MMD"] },

      // ── CR-V ──────────────────────────────────────────────────────────────
      { group: "CR-V" },
      { label: "CR-V 3rd gen (2007–2011)", powers: ["166 hp – 2.4L DOHC i-VTEC I4"] },
      { label: "CR-V 4th gen (2012–2016)", powers: ["185 hp – 2.4L DOHC i-VTEC I4"] },
      { label: "CR-V 5th gen (2017–2022)", powers: ["190 hp – 1.5L VTEC Turbo I4", "184 hp – 2.4L DOHC I4 (2017)"] },
      { label: "CR-V 6th gen (2023–present)", powers: ["190 hp – 1.5L Turbo I4", "204 hp – 2.0L Hybrid i-MMD"] },

      // ── Pilot ─────────────────────────────────────────────────────────────
      { group: "Pilot" },
      { label: "Pilot 2nd gen (2009–2015)", powers: ["250 hp – 3.5L SOHC i-VTEC V6"] },
      { label: "Pilot 3rd gen (2016–2022)", powers: ["280 hp – 3.5L i-VTEC V6 Direct Injection"] },
      { label: "Pilot 4th gen (2023–present)", powers: ["285 hp – 3.5L i-VTEC V6", "285 hp – 3.5L V6 TrailSport"] },

      // ── Odyssey ───────────────────────────────────────────────────────────
      { group: "Odyssey" },
      { label: "Odyssey (2011–2017)", powers: ["248 hp – 3.5L i-VTEC V6"] },
      { label: "Odyssey (2018–present)", powers: ["280 hp – 3.5L SOHC i-VTEC V6"] },

      // ── HR-V ──────────────────────────────────────────────────────────────
      { group: "HR-V" },
      { label: "HR-V 1st gen (2016–2022)", powers: ["141 hp – 1.8L SOHC i-VTEC I4"] },
      { label: "HR-V 2nd gen (2023–present)", powers: ["158 hp – 2.0L DOHC i-VTEC I4"] },

      // ── Ridgeline ─────────────────────────────────────────────────────────
      { group: "Ridgeline" },
      { label: "Ridgeline (2017–present)", powers: ["280 hp – 3.5L i-VTEC V6"] },

      // ── Passport ──────────────────────────────────────────────────────────
      { group: "Passport" },
      { label: "Passport (2019–present)", powers: ["280 hp – 3.5L i-VTEC V6"] },
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
      { label: "Outback 6th gen (2020–present)", powers: ["182 hp – 2.5L DOHC Boxer H4", "260 hp – 2.4L Turbocharged Boxer H4"] },

      // ── Forester ──────────────────────────────────────────────────────────
      { group: "Forester" },
      { label: "Forester 3rd gen (2009–2013)", powers: ["170 hp – 2.5L SOHC Boxer H4", "224 hp – 2.5L Turbo XT Boxer H4"] },
      { label: "Forester 4th gen (2014–2018)", powers: ["170 hp – 2.5L DOHC Boxer H4", "250 hp – 2.0L Turbo XT Boxer H4"] },
      { label: "Forester 5th gen (2019–present)", powers: ["182 hp – 2.5L DOHC Boxer H4", "182 hp – 2.5L e-Boxer Hybrid (2022+)"] },

      // ── Crosstrek ─────────────────────────────────────────────────────────
      { group: "Crosstrek" },
      { label: "Crosstrek (2013–2023)", powers: ["148 hp – 2.0L Boxer H4", "152 hp – 2.0L Boxer H4 (2018+)", "137 hp – 2.0L PHEV Plug-in Hybrid"] },
      { label: "Crosstrek (2024–present)", powers: ["182 hp – 2.5L DOHC Boxer H4"] },

      // ── Legacy ────────────────────────────────────────────────────────────
      { group: "Legacy" },
      { label: "Legacy (2015–2019)", powers: ["175 hp – 2.5L DOHC Boxer H4", "256 hp – 3.6L DOHC Boxer H6"] },
      { label: "Legacy (2020–present)", powers: ["182 hp – 2.5L DOHC Boxer H4", "260 hp – 2.4L Turbo Boxer H4"] },

      // ── Ascent ────────────────────────────────────────────────────────────
      { group: "Ascent" },
      { label: "Ascent (2019–present)", powers: ["260 hp – 2.4L Turbocharged Boxer H4"] },

      // ── WRX ───────────────────────────────────────────────────────────────
      { group: "WRX" },
      { label: "WRX (2015–2021)", powers: ["268 hp – 2.0L Turbocharged EJ20/FA20 Boxer H4", "305 hp – 2.5L Turbocharged EJ25 STI Boxer H4"] },
      { label: "WRX (2022–present)", powers: ["271 hp – 2.4L Turbocharged Boxer H4", "275 hp – 2.4L Turbocharged Boxer H4 (GT)"] },

      // ── BRZ ───────────────────────────────────────────────────────────────
      { group: "BRZ" },
      { label: "BRZ 1st gen (2013–2021)", powers: ["205 hp – 2.0L Boxer H4 FA20"] },
      { label: "BRZ 2nd gen (2022–present)", powers: ["228 hp – 2.4L Boxer H4 FA24"] },

      // ── Impreza ───────────────────────────────────────────────────────────
      { group: "Impreza" },
      { label: "Impreza (2017–2023)", powers: ["152 hp – 2.0L DOHC Boxer H4"] },
      { label: "Impreza (2024–present)", powers: ["182 hp – 2.5L DOHC Boxer H4"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Mazda",
    active:    true,
    expertise: "Mazda vehicles — Mazda3, Mazda6, CX-5, CX-9, CX-50, MX-5 Miata — SkyActiv-G naturally aspirated, SkyActiv-X SPCCI, SkyActiv-D Diesel, Turbo variants, 6-speed AT/MT/manual, GVC torque vectoring, i-Activ AWD, 2012–present US spec",
    models: [
      // ── Mazda3 ────────────────────────────────────────────────────────────
      { group: "Mazda3" },
      { label: "Mazda3 (2010–2013)", powers: ["148 hp – 2.0L DOHC I4", "167 hp – 2.5L DOHC I4"] },
      { label: "Mazda3 (2014–2018)", powers: ["155 hp – 2.0L SkyActiv-G I4", "184 hp – 2.5L SkyActiv-G I4"] },
      { label: "Mazda3 (2019–present)", powers: ["155 hp – 2.0L SkyActiv-G I4", "186 hp – 2.5L SkyActiv-G I4", "227 hp – 2.5L Turbo SkyActiv-G I4 AWD"] },

      // ── Mazda6 ────────────────────────────────────────────────────────────
      { group: "Mazda6" },
      { label: "Mazda6 (2014–2021)", powers: ["184 hp – 2.5L SkyActiv-G I4", "250 hp – 2.5L Turbo SkyActiv-G I4"] },

      // ── CX-5 ──────────────────────────────────────────────────────────────
      { group: "CX-5" },
      { label: "CX-5 1st gen (2013–2016)", powers: ["155 hp – 2.0L SkyActiv-G I4", "184 hp – 2.5L SkyActiv-G I4"] },
      { label: "CX-5 2nd gen (2017–present)", powers: ["187 hp – 2.5L SkyActiv-G I4", "187 hp – 2.5L SkyActiv-G AWD", "227 hp – 2.5L Turbo SkyActiv-G I4", "256 hp – 2.5L Turbo SkyActiv-G (93 oct)"] },

      // ── CX-50 ─────────────────────────────────────────────────────────────
      { group: "CX-50" },
      { label: "CX-50 (2023–present)", powers: ["187 hp – 2.5L SkyActiv-G I4", "256 hp – 2.5L Turbo SkyActiv-G I4"] },

      // ── CX-9 ──────────────────────────────────────────────────────────────
      { group: "CX-9" },
      { label: "CX-9 (2016–2023)", powers: ["227 hp – 2.5L Turbo SkyActiv-G I4", "250 hp – 2.5L Turbo SkyActiv-G (93 oct)"] },

      // ── MX-5 Miata ────────────────────────────────────────────────────────
      { group: "MX-5 Miata" },
      { label: "MX-5 Miata NC (2006–2015)", powers: ["158 hp – 2.0L DOHC I4 MZR"] },
      { label: "MX-5 Miata ND (2016–2018)", powers: ["155 hp – 2.0L SkyActiv-G I4"] },
      { label: "MX-5 Miata ND (2019–present)", powers: ["181 hp – 2.0L SkyActiv-G I4"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Cadillac",
    active:    true,
    expertise: "Cadillac luxury vehicles — Escalade, XT4, XT5, XT6, CT4, CT5 — 2.0L Turbo, 2.7L Turbo, 3.0L Twin Turbo, 6.2L LT1/LT4 V8, 3.0L Duramax Diesel, 10-speed automatic, Super Cruise semi-autonomous driving, Magnetic Ride Control, Blackwing performance variants, 2007–present US spec",
    models: [
      // ── Escalade ──────────────────────────────────────────────────────────
      { group: "Escalade" },
      { label: "Escalade (2007–2014)", powers: ["403 hp – 6.2L EcoTec V8"] },
      { label: "Escalade (2015–2020)", powers: ["420 hp – 6.2L EcoTec3 V8"] },
      { label: "Escalade (2021–present)", powers: ["420 hp – 6.2L EcoTec3 V8", "277 hp – 3.0L Duramax Diesel I6", "682 hp – 6.2L Supercharged V-Series V8"] },

      // ── XT4 ───────────────────────────────────────────────────────────────
      { group: "XT4" },
      { label: "XT4 (2019–present)", powers: ["237 hp – 2.0L Turbo I4"] },

      // ── XT5 ───────────────────────────────────────────────────────────────
      { group: "XT5" },
      { label: "XT5 (2017–present)", powers: ["310 hp – 3.6L V6 SIDI", "237 hp – 2.0L Turbo I4 (2021+)"] },

      // ── XT6 ───────────────────────────────────────────────────────────────
      { group: "XT6" },
      { label: "XT6 (2020–present)", powers: ["310 hp – 3.6L V6 SIDI", "237 hp – 2.0L Turbo I4 (2022+)"] },

      // ── CT4 ───────────────────────────────────────────────────────────────
      { group: "CT4" },
      { label: "CT4 (2020–present)", powers: ["237 hp – 2.0L Turbo I4", "325 hp – 2.7L Turbo I4 V-Series", "472 hp – 3.6L Twin Turbo Blackwing V6"] },

      // ── CT5 ───────────────────────────────────────────────────────────────
      { group: "CT5" },
      { label: "CT5 (2020–present)", powers: ["237 hp – 2.0L Turbo I4", "335 hp – 3.0L Twin Turbo V6 V-Series", "668 hp – 6.2L Supercharged Blackwing V8"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Lincoln",
    active:    true,
    expertise: "Lincoln premium vehicles — Navigator, Aviator, Corsair, Nautilus, MKZ — 2.0L/2.7L EcoBoost Turbo, 3.0L Twin Turbo, 3.5L EcoBoost, PHEV/Hybrid variants, 10R80 10-speed automatic, air suspension, CoPilot360 driver assist, 2007–present US spec",
    models: [
      // ── Navigator ─────────────────────────────────────────────────────────
      { group: "Navigator" },
      { label: "Navigator (2007–2014)", powers: ["310 hp – 5.4L V8"] },
      { label: "Navigator (2015–2017)", powers: ["380 hp – 3.5L EcoBoost V6"] },
      { label: "Navigator (2018–present)", powers: ["450 hp – 3.5L Twin Turbo EcoBoost V6"] },

      // ── Aviator ───────────────────────────────────────────────────────────
      { group: "Aviator" },
      { label: "Aviator (2020–present)", powers: ["400 hp – 3.0L Twin Turbo V6", "494 hp – 3.0L Twin Turbo PHEV V6"] },

      // ── Corsair ───────────────────────────────────────────────────────────
      { group: "Corsair" },
      { label: "Corsair (2020–present)", powers: ["247 hp – 2.0L EcoBoost Turbo I4", "266 hp – 2.5L PHEV Hybrid I4"] },

      // ── Nautilus ──────────────────────────────────────────────────────────
      { group: "Nautilus" },
      { label: "Nautilus (2019–2023)", powers: ["250 hp – 2.0L EcoBoost Turbo I4", "335 hp – 2.7L EcoBoost Turbo V6"] },
      { label: "Nautilus (2024–present)", powers: ["328 hp – 2.7L EcoBoost Turbo V6"] },

      // ── MKZ ───────────────────────────────────────────────────────────────
      { group: "MKZ" },
      { label: "MKZ (2013–2020)", powers: ["245 hp – 2.0L EcoBoost Turbo I4", "400 hp – 3.0L Twin Turbo V6", "188 hp – 2.0L Hybrid"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Chrysler",
    active:    true,
    expertise: "Chrysler minivans and sedans — Pacifica, 300 — 3.6L Pentastar V6, 5.7L/6.4L HEMI V8, Pacifica Hybrid plug-in, ZF 9-speed/8-speed automatic, Stow 'n Go seating, 2011–present US spec",
    models: [
      // ── Pacifica ──────────────────────────────────────────────────────────
      { group: "Pacifica" },
      { label: "Pacifica (2017–present)", powers: ["287 hp – 3.6L Pentastar V6", "260 hp – 3.6L Pentastar Hybrid PHEV"] },

      // ── Chrysler 300 ──────────────────────────────────────────────────────
      { group: "300" },
      { label: "Chrysler 300 (2011–2023)", powers: ["292 hp – 3.6L Pentastar V6", "363 hp – 5.7L HEMI V8", "485 hp – 6.4L HEMI SRT8 V8"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Buick",
    active:    true,
    expertise: "Buick luxury-entry vehicles — Encore, Encore GX, Envision, Enclave — 1.2L/1.3L/1.4L Turbo I3/I4, 2.0L Turbo, 3.6L V6 SIDI, Active Noise Cancellation, 2013–present US spec. Shares GM platforms with Chevrolet/GMC",
    models: [
      // ── Encore ────────────────────────────────────────────────────────────
      { group: "Encore" },
      { label: "Encore (2013–2019)", powers: ["138 hp – 1.4L Turbo I4 Ecotec", "153 hp – 1.4L Turbo Sport I4"] },
      { label: "Encore (2020–present)", powers: ["137 hp – 1.2L Turbo I3", "155 hp – 1.3L Turbo I3 AWD"] },

      // ── Encore GX ─────────────────────────────────────────────────────────
      { group: "Encore GX" },
      { label: "Encore GX (2020–present)", powers: ["137 hp – 1.2L Turbo I3", "155 hp – 1.3L Turbo I3"] },

      // ── Envision ──────────────────────────────────────────────────────────
      { group: "Envision" },
      { label: "Envision (2016–2020)", powers: ["197 hp – 1.5L Turbo I4", "252 hp – 2.0L Turbo I4"] },
      { label: "Envision (2021–present)", powers: ["228 hp – 2.0L Turbo I4"] },

      // ── Enclave ───────────────────────────────────────────────────────────
      { group: "Enclave" },
      { label: "Enclave (2008–2017)", powers: ["281 hp – 3.6L V6 SIDI"] },
      { label: "Enclave (2018–present)", powers: ["310 hp – 3.6L V6 SIDI"] },
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
      { label: "MDX 4th gen (2022–present)", powers: ["290 hp – 3.5L SOHC V6 Turbo", "355 hp – 3.0L Twin Turbo Type S V6"] },

      // ── RDX ───────────────────────────────────────────────────────────────
      { group: "RDX" },
      { label: "RDX (2013–2018)", powers: ["279 hp – 3.5L SOHC V6"] },
      { label: "RDX (2019–present)", powers: ["272 hp – 2.0L VTEC Turbo I4"] },

      // ── TLX ───────────────────────────────────────────────────────────────
      { group: "TLX" },
      { label: "TLX (2015–2020)", powers: ["206 hp – 2.4L DOHC i-VTEC I4", "290 hp – 3.5L SOHC V6 SH-AWD"] },
      { label: "TLX (2021–present)", powers: ["272 hp – 2.0L Turbo I4", "355 hp – 3.0L Twin Turbo Type S V6"] },

      // ── Integra ───────────────────────────────────────────────────────────
      { group: "Integra" },
      { label: "Integra (2023–present)", powers: ["200 hp – 1.5L VTEC Turbo I4", "320 hp – 1.5L VTEC Turbo Type S I4"] },

      // ── ILX ───────────────────────────────────────────────────────────────
      { group: "ILX" },
      { label: "ILX (2013–2022)", powers: ["201 hp – 2.4L DOHC i-VTEC I4"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Lexus",
    active:    true,
    expertise: "Lexus luxury vehicles — RX, NX, GX, LX, ES, IS, LS, GS — 2.0L Turbo, 2.5L/3.5L V6, 4.6L/5.0L V8, multi-stage Hybrid Drive, Lexus Safety System+, air suspension, Variable Gear Ratio Steering, 2006–present US spec",
    models: [
      // ── RX ────────────────────────────────────────────────────────────────
      { group: "RX" },
      { label: "RX 350/400h (2007–2009)", powers: ["270 hp – 3.5L V6 2GR-FE", "268 hp – 3.3L Hybrid V6"] },
      { label: "RX 350/450h (2010–2015)", powers: ["275 hp – 3.5L V6 2GR-FE", "295 hp – 3.5L Hybrid V6"] },
      { label: "RX 350/450h (2016–2022)", powers: ["295 hp – 3.5L V6 2GR-FKS", "308 hp – 3.5L Hybrid V6"] },
      { label: "RX 350/500h/350h (2023–present)", powers: ["275 hp – 2.4L Turbo I4", "366 hp – 2.4L Turbo Hybrid", "246 hp – 2.5L FHEV Hybrid"] },

      // ── NX ────────────────────────────────────────────────────────────────
      { group: "NX" },
      { label: "NX 200t/300 (2015–2021)", powers: ["235 hp – 2.0L Turbo I4"] },
      { label: "NX 250/350/350h/450h+ (2022–present)", powers: ["203 hp – 2.5L NA I4", "275 hp – 2.4L Turbo I4", "243 hp – 2.5L FHEV Hybrid", "306 hp – 2.5L PHEV"] },

      // ── GX ────────────────────────────────────────────────────────────────
      { group: "GX" },
      { label: "GX 460 (2010–2023)", powers: ["301 hp – 4.6L V8 1UR-FE"] },
      { label: "GX 550 (2024–present)", powers: ["349 hp – 3.4L Twin Turbo V6", "406 hp – 3.4L Twin Turbo Hybrid V6"] },

      // ── LX ────────────────────────────────────────────────────────────────
      { group: "LX" },
      { label: "LX 570 (2008–2021)", powers: ["383 hp – 5.7L V8 3UR-FE"] },
      { label: "LX 600 (2022–present)", powers: ["409 hp – 3.4L Twin Turbo V6", "457 hp – 3.4L Twin Turbo Hybrid V6"] },

      // ── ES ────────────────────────────────────────────────────────────────
      { group: "ES" },
      { label: "ES 350/300h (2013–2018)", powers: ["268 hp – 3.5L V6 2GR-FE", "200 hp – 2.5L Hybrid"] },
      { label: "ES 350/300h (2019–present)", powers: ["302 hp – 3.5L V6 2GR-FKS", "215 hp – 2.5L FHEV Hybrid"] },

      // ── IS ────────────────────────────────────────────────────────────────
      { group: "IS" },
      { label: "IS 250/350 (2006–2013)", powers: ["204 hp – 2.5L V6", "306 hp – 3.5L V6 2GR-FSE"] },
      { label: "IS 200t/300/350 (2014–2020)", powers: ["241 hp – 2.0L Turbo I4", "260 hp – 3.5L V6 AWD", "311 hp – 3.5L V6 RWD"] },
      { label: "IS 300/350/500 (2021–present)", powers: ["260 hp – 3.5L V6 AWD", "311 hp – 3.5L V6 RWD", "472 hp – 5.0L V8 IS 500"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    brand:     "Infiniti",
    active:    true,
    expertise: "Infiniti luxury vehicles — QX60, QX80, QX50, Q50, Q60 — 2.0L VC-Turbo (Variable Compression), 3.0L Twin Turbo V6, 3.5L V6 Hybrid, 5.6L V8 Endurance, ProPILOT Assist, Dynamic Digital Suspension, 2007–present US spec",
    models: [
      // ── QX60 ──────────────────────────────────────────────────────────────
      { group: "QX60" },
      { label: "QX60 (2013–2021)", powers: ["265 hp – 2.5L Supercharged Hybrid I4", "295 hp – 3.5L V6 VQ35DE"] },
      { label: "QX60 (2022–present)", powers: ["295 hp – 3.5L V6 VQ35DD"] },

      // ── QX80 ──────────────────────────────────────────────────────────────
      { group: "QX80" },
      { label: "QX80 (2014–present)", powers: ["400 hp – 5.6L V8 Endurance VK56VD"] },

      // ── QX50 ──────────────────────────────────────────────────────────────
      { group: "QX50" },
      { label: "QX50 (2019–present)", powers: ["268 hp – 2.0L VC-Turbo Variable Compression I4"] },

      // ── Q50 ───────────────────────────────────────────────────────────────
      { group: "Q50" },
      { label: "Q50 (2014–2015)", powers: ["208 hp – 2.0L Turbo I4", "328 hp – 3.7L V6 VQ37VHR", "360 hp – 3.5L Hybrid V6"] },
      { label: "Q50 (2016–present)", powers: ["208 hp – 2.0L Turbo I4", "300 hp – 3.0L Twin Turbo V6", "400 hp – 3.0L Twin Turbo V6 Red Sport"] },

      // ── Q60 ───────────────────────────────────────────────────────────────
      { group: "Q60" },
      { label: "Q60 (2017–present)", powers: ["208 hp – 2.0L Turbo I4", "300 hp – 3.0L Twin Turbo V6", "400 hp – 3.0L Twin Turbo V6 Red Sport"] },
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
      { label: "GV80 (2021–present)", powers: ["300 hp – 2.5L Turbo I4", "375 hp – 3.5L Twin Turbo V6", "278 hp – 3.0L Turbo Diesel (international)"] },

      // ── GV70 ──────────────────────────────────────────────────────────────
      { group: "GV70" },
      { label: "GV70 (2022–present)", powers: ["300 hp – 2.5L Turbo I4", "375 hp – 3.5L Twin Turbo V6"] },
      { label: "GV70 Electrified (2023–present)", powers: ["429 hp – Dual Motor Electric AWD", "429 hp – Dual Motor EV Boost 483 hp"] },

      // ── GV60 ──────────────────────────────────────────────────────────────
      { group: "GV60" },
      { label: "GV60 (2023–present)", powers: ["314 hp – Single Motor RWD Electric", "429 hp – Dual Motor AWD Electric", "429 hp – Performance Boost 483 hp Electric"] },

      // ── G80 ───────────────────────────────────────────────────────────────
      { group: "G80" },
      { label: "G80 (2017–2020)", powers: ["311 hp – 3.8L V6 Lambda", "365 hp – 5.0L V8 Tau", "245 hp – 2.0L Turbo I4"] },
      { label: "G80 (2021–present)", powers: ["300 hp – 2.5L Turbo I4", "375 hp – 3.5L Twin Turbo V6"] },
      { label: "G80 Electrified (2023–present)", powers: ["365 hp – Dual Motor AWD Electric"] },

      // ── G70 ───────────────────────────────────────────────────────────────
      { group: "G70" },
      { label: "G70 (2019–present)", powers: ["252 hp – 2.0L Turbo I4", "365 hp – 3.3L Twin Turbo V6"] },

      // ── G90 ───────────────────────────────────────────────────────────────
      { group: "G90" },
      { label: "G90 (2017–2022)", powers: ["311 hp – 3.3L Twin Turbo V6", "420 hp – 5.0L V8 Tau"] },
      { label: "G90 (2023–present)", powers: ["375 hp – 3.5L Twin Turbo V6"] },
    ],
  },

]
