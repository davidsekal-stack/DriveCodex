// ── GearBrain i18n — Čeština (CS) ────────────────────────────────────────────

export const strings = {
  // App — general
  'app.loading':          'Načítám...',
  'app.subtitle':         'AI DIAGNOSTIKA VOZIDEL',
  'app.casesCount':       '{count} případů',
  'app.cloudOk':          'cloud ✓',
  'app.cloudOffline':     'cloud offline',
  'app.cloudIdle':        'cloud —',
  'app.lightMode':        '☀️ Světlý',
  'app.darkMode':         '🌙 Tmavý',
  'app.logout':           'Odhlásit',

  // App — sidebar
  'app.newCase':          '+ NOVÝ PŘÍPAD',
  'app.noCases':          'Žádné případy.',
  'app.noCasesHint':      'Klikněte na NOVÝ PŘÍPAD.',
  'app.cloudCount':       'Databáze: {count} případů',
  'app.cloudEmpty':       'Databáze: prázdná',
  'app.ragActive':        'Cloud RAG aktivní',
  'app.ragUnavailable':   'Cloud nedostupný',
  'app.ragConnecting':    'Cloud: připojuji...',
  'app.syncIdle':         'Případy: bez změn',
  'app.syncSyncing':      'Případy: synchronizuji...',
  'app.syncSynced':       'Případy uložené',
  'app.syncError':        'Uložení do cloudu selhalo',
  'app.syncWarning':      'Některé změny se nemusely uložit.',

  // App — welcome
  'app.welcomeText':      'Vyberte případ ze seznamu vlevo',
  'app.welcomeHint':      'nebo vytvořte novou diagnostiku',

  // App — new case
  'app.newCaseTitle':     'NOVÝ DIAGNOSTICKÝ PŘÍPAD',
  'app.newCaseSubtitle':  'Zadejte informace o vozidle a první příznaky závady',
  'app.vehicleBrand':     'ZNAČKA VOZIDLA',
  'app.vehicleModel':     'MODEL VOZIDLA',
  'app.selectModel':      '— Vyberte model —',
  'app.enginePower':      'VÝKON MOTORU',
  'app.optional':         '— Nepovinné —',
  'app.defaultBrandHint':  'Nastavit jako výchozí značku',
  'app.mileageKm':        'NÁJEZD (KM)',
  'app.identLabel':       'SPZ / VIN',
  'app.identPlate':       'SPZ',
  'app.identPlaceholder': 'SPZ nebo VIN (nepovinné)',
  'app.identHistory':     '📋 {count} předchozích případů pro toto vozidlo',
  'app.identShowHistory': 'Zobrazit historii',
  'app.startDiag':        'ZAHÁJIT DIAGNOSTIKU',

  // App — diagnosis
  'app.tokenLimit':       'Případ dosáhl limitu {limit} tokenů. Uzavřete případ a výsledky shrňte do poznámky.',
  'app.aiError':          'AI vrátilo chybu.',
  'app.aiNoResponse':     'AI nevrátilo odpověď. Zkuste to znovu.',
  'app.aiUnreadable':     'AI nevrátilo čitelný výsledek. Zkuste přidat více příznaků.',
  'app.noFaults':         'Nebyly nalezeny odpovídající závady.',
  'app.defaultVehicle':   'Vozidlo',
  'app.errorPrefix':      'Chyba: ',

  // App — session
  'app.caseReady':        'Případ připraven — zadejte příznaky níže a spusťte diagnostiku',
  'app.inputRound':       'Vstup #{num} · {date}',
  'app.aiProcessing':     '◈ AI DIAGNOSTIKA PROBÍHÁ ◈',
  'app.aiProcessingSub':  'Prohledávám databázi servisu · Analyzuji příznaky...',
  'app.caseClosed':       '✓ PŘÍPAD UZAVŘEN · {date}',
  'app.firstDiag':        'PRVNÍ DIAGNOSTIKA — zadejte příznaky',
  'app.runDiag':          'SPUSTIT DIAGNOSTIKU',
  'app.addInfo':          'DOPLNIT INFORMACE',

  // App — close case modal
  'app.closeCaseTitle':   '✓ UZAVŘÍT PŘÍPAD',
  'app.closeCaseHelp':    'Popište provedenou opravu. Tato informace bude uložena do databáze servisu a pomůže při budoucích diagnostikách.',
  'app.repairLabel':      'PROVEDENÁ OPRAVA *',
  'app.repairPlaceholder':'např. Vyměněn EGR ventil + EGR chladič. Po vyčištění sání a regeneraci DPF vozidlo jede bez závad. Kód P0401 vymazán, nevrátil se.',
  'app.closeCaseHelpSmart':'Vyberte co bylo provedeno. Tato informace bude uložena do databáze servisu.',
  'app.closeSelectResolution':'CO BYLO PROVEDENO *',
  'app.closeOther':       'Jiné:',
  'app.closeCustomPlaceholder':'Co bylo skutečnou příčinou / co bylo provedeno?',
  'app.cancel':           'Zrušit',
  'app.confirm':          '✓ Potvrdit',

  // App — delete case modal
  'app.deleteCaseTitle':  'SMAZAT PŘÍPAD',
  'app.deleteClosedMsg':  'Opravdu smazat tento případ? Akce je nevratná.\n⚠ Případ je uzavřen a je součástí databáze servisu.',
  'app.deleteOpenMsg':    'Opravdu smazat tento případ? Akce je nevratná.',
  'app.deleteBtn':        '✕ Smazat',
  'app.closeBtn':         '✓ UZAVŘÍT',
  'app.deleteLabel':      '✕ SMAZAT',

  // App — user prompt labels (sent to AI)
  'app.userVehicle':      'Vozidlo',
  'app.userMileage':      'Nájezd',
  'app.userSymptoms':     'Příznaky',
  'app.userObd':          'OBD kódy',
  'app.userMechDesc':     'Popis mechanika',

  // GDPR consent
  'consent.title':        'Ochrana osobních údajů',
  'consent.text':         'Tato aplikace ukládá vaše diagnostické případy do anonymní databáze, ze které se učí a zlepšuje výsledky pro všechny uživatele. Osobní údaje (email) slouží pouze k přihlášení. Žádná data neprodáváme třetím stranám.',
  'consent.declineNote':  'Pokud odmítnete, aplikace bude fungovat normálně, ale vaše uzavřené případy nebudou přispívat do sdílené databáze a AI nebude moci využívat zkušenosti ostatních mechaniků.',
  'consent.accept':       'Souhlasím',
  'consent.decline':      'Odmítnout',

  // Feedback
  'app.feedback':         '✉ Zpětná vazba',
  'app.feedbackSubject':  'GearBrain — Zpětná vazba',
  'app.feedbackPlaceholder': 'Zpětná vazba...',
  'app.feedbackSend':     'Odeslat',
  'app.feedbackSent':     'Odesláno, děkujeme!',
  'app.feedbackError':    'Nepodařilo se odeslat',

  // Status
  'status.closed':        '✓ UZAVŘENÝ',
  'status.active':        '● AKTIVNÍ',

  // Login
  'login.subtitle':           'AI DIAGNOSTIKA · WEB',
  'login.verifyTitle':        'OVĚŘTE SVŮJ EMAIL',
  'login.verifyMsg':          'Na adresu {email} jsme odeslali ověřovací odkaz. Klikněte na něj a poté se přihlaste.',
  'login.backToLogin':        'ZPĚT NA PŘIHLÁŠENÍ',
  'login.loginTitle':         'PŘIHLÁŠENÍ',
  'login.registerTitle':      'REGISTRACE',
  'login.google':             'Pokračovat přes Google',
  'login.or':                 'NEBO',
  'login.email':              'EMAIL',
  'login.emailPlaceholder':   'vas@email.cz',
  'login.password':           'HESLO',
  'login.passwordPlaceholder':'min. 6 znaků',
  'login.processing':         'Zpracovávám...',
  'login.loginBtn':           'PŘIHLÁSIT SE',
  'login.registerBtn':        'ZAREGISTROVAT SE',
  'login.noAccount':          'Nemáte účet?',
  'login.register':           'Zaregistrujte se',
  'login.hasAccount':         'Máte účet?',
  'login.login':              'Přihlaste se',
  'login.invalidCredentials': 'Neplatný email nebo heslo.',
  'login.alreadyRegistered':  'Tento email je již registrován. Přihlaste se.',

  // InputForm
  'input.symptomsTab':        '⚡ PŘÍZNAKY',
  'input.obdTab':             '📡 OBD',
  'input.textTab':            '✍️ POPIS',
  'input.selectedCount':      '{count} vyb.',
  'input.codesCount':         '{count} kódů',
  'input.obdPlaceholder':     'P0401, P2263...',
  'input.commonCodes':        'OBECNÉ OBD KÓDY',
  'input.engineCodes':        'DLE MOTORU',
  'input.brandCodes':         '{brand} — SPECIFICKÉ',
  'input.describeFault':      "Popište závadu vlastními slovy... např. 'Po nastartování přešel do nouzového režimu, černý kouř, svítí kontrolka motoru a DPF...'",
  'input.enterHint':          'Zadejte příznaky nebo OBD kódy',
  'input.analyzing':          'Analyzuji...',
  'input.followupPlaceholder':'Popište nové zjištění nebo doplňte informace... (Enter = odeslat, Shift+Enter = nový řádek)',
  'input.send':               '▶ Odeslat',

  // DiagCard
  'diag.title':               'AI DIAGNOSTIKA',
  'diag.probability':         'PRAVDĚP.',
  'diag.repairProcedure':     'POSTUP OPRAVY',
  'diag.ragInfo':             '◈ Databáze servisu: {count} podobných případů zohledněno',
  'diag.sourceDb':            'DATABÁZE',
  'diag.sourceAi':            'AI ANALÝZA',
  'diag.dbCases':             '{count} shod',
  'diag.additionalCause':     'Další možná příčina #{num}',
  'diag.additionalCauseDesc': 'AI model neidentifikoval dostatek alternativních příčin. Doporučujeme konzultovat s technikem.',
  'diag.additionalCauseNote': 'Doplněno automaticky — AI vrátil méně než 3 závady.',
  'diag.recommendedTests':    'DOPORUČENÉ TESTY',
  'diag.notes':               'POZNÁMKY',

  // ConfirmModal
  'confirm.cancel':           'Zrušit',

  // ErrorBoundary
  'error.title':              'NEOČEKÁVANÁ CHYBA',
  'error.description':        'Aplikace narazila na neočekávaný problém. Zkuste ji restartovat.',
  'error.unknown':            'Neznámá chyba',
  'error.restart':            '↺ RESTARTOVAT',

  // Validation
  'validation.resolutionEmpty':     'Chybí popis provedené opravy.',
  'validation.resolutionTooShort':  'Popis opravy je příliš krátký ({length} znaků, minimum {min}).',
  'validation.resolutionTooLong':   'Popis opravy je příliš dlouhý ({length} znaků, maximum {max}).',
  'validation.resolutionRepeating': 'Popis opravy obsahuje opakující se znaky.',
  'validation.resolutionTerse':     'Popis opravy je příliš stručný — přidejte alespoň 2 různá slova.',

  // AI
  'ai.topicIrrelevant':  'Popis neobsahuje žádný technický údaj (OBD kód, zkratku jako DPF/EGR/ABS, nebo měřenou hodnotu). Popište technický problém nebo příznaky závady.',

  // PDF export
  'pdf.title':            'DIAGNOSTICKÝ PROTOKOL',
  'pdf.vehicle':          'VOZIDLO',
  'pdf.inputRound':       'VSTUP #{num}',
  'pdf.diagnosis':        'DIAGNÓZA #{num}',
  'pdf.summary':          'SHRNUTÍ',
  'pdf.resolution':       'PROVEDENÁ OPRAVA',
  'pdf.generated':        'Vygenerováno',
  'pdf.page':             'Strana',
  'pdf.variant.service':       'Servisní protokol',
  'pdf.variant.service.desc':  'Styl autoservisu — tabulka, pruhy, boxy',
  'pdf.variant.technical':     'Technická zpráva',
  'pdf.variant.technical.desc':'Formální — tabulky, karty s rámečkem',
  'pdf.variant.minimalist':    'Minimalistický',
  'pdf.variant.minimalist.desc':'Čistý, hodně bílého prostoru',

  // Symptom categories
  'sym.cat.engine':       'Motor & Výkon',
  'sym.cat.transmission': 'Převodovka & Spojka',
  'sym.cat.brakes':       'Brzdy & Podvozek',
  'sym.cat.steering':     'Řízení',
  'sym.cat.electrical':   'Elektrika & Elektronika',
  'sym.cat.exhaust':      'Výfuk & Emise',

  // Symptoms — Engine & Power
  'sym.lossOfPower':      'Ztráta výkonu',
  'sym.blackSmoke':       'Černý kouř z výfuku',
  'sym.whiteSmoke':       'Bílý kouř z výfuku',
  'sym.excessFuel':       'Nadměrná spotřeba paliva',
  'sym.roughIdle':        'Hrubý volnoběh',
  'sym.stalling':         'Motor zhasíná',
  'sym.hardStart':        'Obtížné startování',
  'sym.noStart':          'Motor se nepodaří nastartovat',
  'sym.limpMode':         'Nouzový režim',
  'sym.overheating':      'Přehřívání motoru',
  'sym.oilConsumption':   'Nadměrná spotřeba oleje',

  // Symptoms — Transmission & Clutch
  'sym.shiftVibration':   'Vibrace při řazení',
  'sym.hardShifting':     'Obtížné řazení',
  'sym.clutchSlip':       'Spojka klouže',
  'sym.shiftJerks':       'Rázy při řazení',
  'sym.gearboxNoise':     'Hluk z převodovky',
  'sym.accelDropout':     'Výpadky při akceleraci',

  // Symptoms — Brakes & Chassis
  'sym.absLight':         'ABS kontrolka svítí',
  'sym.brakePulse':       'Pulzování brzd',
  'sym.brakePull':        'Táhnutí na stranu při brzdění',
  'sym.chassisNoise':     'Hluk z podvozku',
  'sym.steeringVibration':'Vibrace volantu',
  'sym.unevenTyreWear':   'Nerovnoměrné opotřebení pneumatik',

  // Symptoms — Steering
  'sym.heavySteering':    'Těžké řízení',
  'sym.steeringPlay':     'Vůle ve volantu',
  'sym.steeringClick':    'Klikání při otáčení volantu',
  'sym.pullingSide':      'Táhnutí na stranu při jízdě',
  'sym.steeringLight':    'Kontrolka řízení svítí',

  // Symptoms — Electrical & Electronics
  'sym.milLight':         'Kontrolka motoru (MIL) svítí',
  'sym.electricalDropout':'Výpadky elektriky',
  'sym.alternatorIssue':  'Problémy s alternátorem',
  'sym.batteryDrain':     'Vybíjení baterie',
  'sym.centralLockIssue': 'Problémy s centrálním zamykáním',
  'sym.dashErrors':       'Chyby na palubním počítači',

  // Symptoms — Exhaust & Emissions
  'sym.dpfLight':         'DPF kontrolka svítí',
  'sym.adblueWarning':    'AdBlue varování',
  'sym.exhaustSmell':     'Zápach z výfuku',
  'sym.accelSmoke':       'Kouř při akceleraci',
  'sym.dpfRegenFail':     'Nefunkční regenerace DPF',
}
