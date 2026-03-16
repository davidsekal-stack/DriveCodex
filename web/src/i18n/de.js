// ── GearBrain i18n — Deutsch (DE) ────────────────────────────────────────────

export const strings = {
  // App — general
  'app.loading':          'Laden...',
  'app.subtitle':         'AI-FAHRZEUGDIAGNOSE',
  'app.casesCount':       '{count} Fälle',
  'app.cloudOk':          'Cloud ✓',
  'app.cloudOffline':     'Cloud offline',
  'app.cloudIdle':        'Cloud —',
  'app.lightMode':        '☀️ Hell',
  'app.darkMode':         '🌙 Dunkel',
  'app.logout':           'Abmelden',

  // App — sidebar
  'app.newCase':          '+ NEUER FALL',
  'app.noCases':          'Keine Fälle.',
  'app.noCasesHint':      'Klicken Sie auf NEUER FALL.',
  'app.cloudCount':       'Cloud: {count} abgeschlossen',
  'app.cloudEmpty':       'Cloud: leer',
  'app.ragActive':        'Cloud RAG aktiv',
  'app.ragUnavailable':   'Cloud nicht verfügbar',
  'app.ragConnecting':    'Cloud: verbinde...',

  // App — welcome
  'app.welcomeText':      'Wählen Sie einen Fall aus der Liste',
  'app.welcomeHint':      'oder erstellen Sie eine neue Diagnose',

  // App — new case
  'app.newCaseTitle':     'NEUER DIAGNOSEFALL',
  'app.newCaseSubtitle':  'Geben Sie Fahrzeuginformationen und erste Fehlersymptome ein',
  'app.vehicleBrand':     'FAHRZEUGMARKE',
  'app.vehicleModel':     'FAHRZEUGMODELL',
  'app.selectModel':      '— Modell wählen —',
  'app.enginePower':      'MOTORLEISTUNG',
  'app.optional':         '— Optional —',
  'app.mileageKm':        'KILOMETERSTAND (KM)',
  'app.startDiag':        'DIAGNOSE STARTEN',

  // App — diagnosis
  'app.tokenLimit':       'Fall hat das Limit von {limit} Token erreicht. Schließen Sie den Fall und fassen Sie die Ergebnisse zusammen.',
  'app.aiError':          'AI hat einen Fehler zurückgegeben.',
  'app.aiNoResponse':     'AI hat keine Antwort zurückgegeben. Bitte versuchen Sie es erneut.',
  'app.aiUnreadable':     'AI hat kein lesbares Ergebnis zurückgegeben. Versuchen Sie, mehr Symptome hinzuzufügen.',
  'app.noFaults':         'Keine passenden Fehler gefunden.',
  'app.defaultVehicle':   'Fahrzeug',
  'app.errorPrefix':      'Fehler: ',

  // App — session
  'app.caseReady':        'Fall bereit — geben Sie unten Symptome ein und starten Sie die Diagnose',
  'app.inputRound':       'Eingabe #{num} · {date}',
  'app.aiProcessing':     '◈ AI-DIAGNOSE LÄUFT ◈',
  'app.aiProcessingSub':  'Durchsuche Servicedatenbank · Analysiere Symptome...',
  'app.caseClosed':       '✓ FALL ABGESCHLOSSEN · {date}',
  'app.firstDiag':        'ERSTE DIAGNOSE — Symptome eingeben',
  'app.runDiag':          'DIAGNOSE STARTEN',
  'app.addInfo':          'INFORMATIONEN ERGÄNZEN',

  // App — close case modal
  'app.closeCaseTitle':   '✓ FALL SCHLIESSEN',
  'app.closeCaseHelp':    'Beschreiben Sie die durchgeführte Reparatur. Diese Information wird in der Servicedatenbank gespeichert und hilft bei zukünftigen Diagnosen.',
  'app.repairLabel':      'DURCHGEFÜHRTE REPARATUR *',
  'app.repairPlaceholder':'z.B. EGR-Ventil + EGR-Kühler ersetzt. Nach Ansaugreinigung und DPF-Regeneration läuft das Fahrzeug fehlerfrei. Code P0401 gelöscht, nicht zurückgekehrt.',
  'app.cancel':           'Abbrechen',
  'app.confirm':          '✓ Bestätigen',

  // App — delete case modal
  'app.deleteCaseTitle':  'FALL LÖSCHEN',
  'app.deleteClosedMsg':  'Diesen Fall wirklich löschen? Diese Aktion ist unwiderruflich.\n⚠ Der Fall ist abgeschlossen und Teil der Servicedatenbank.',
  'app.deleteOpenMsg':    'Diesen Fall wirklich löschen? Diese Aktion ist unwiderruflich.',
  'app.deleteBtn':        '✕ Löschen',
  'app.closeBtn':         '✓ SCHLIESSEN',
  'app.deleteLabel':      '✕ LÖSCHEN',

  // App — user prompt labels (sent to AI)
  'app.userVehicle':      'Fahrzeug',
  'app.userMileage':      'Kilometerstand',
  'app.userSymptoms':     'Symptome',
  'app.userObd':          'OBD-Codes',
  'app.userMechDesc':     'Mechanikerbeschreibung',

  // Status
  'status.closed':        '✓ ABGESCHLOSSEN',
  'status.active':        '● AKTIV',

  // Login
  'login.subtitle':           'AI-DIAGNOSE · WEB',
  'login.verifyTitle':        'E-MAIL BESTÄTIGEN',
  'login.verifyMsg':          'Wir haben einen Bestätigungslink an {email} gesendet. Klicken Sie auf den Link und melden Sie sich dann an.',
  'login.backToLogin':        'ZURÜCK ZUR ANMELDUNG',
  'login.loginTitle':         'ANMELDUNG',
  'login.registerTitle':      'REGISTRIERUNG',
  'login.google':             'Weiter mit Google',
  'login.or':                 'ODER',
  'login.email':              'E-MAIL',
  'login.emailPlaceholder':   'ihre@email.de',
  'login.password':           'PASSWORT',
  'login.passwordPlaceholder':'min. 6 Zeichen',
  'login.processing':         'Verarbeitung...',
  'login.loginBtn':           'ANMELDEN',
  'login.registerBtn':        'REGISTRIEREN',
  'login.noAccount':          'Kein Konto?',
  'login.register':           'Registrieren',
  'login.hasAccount':         'Bereits ein Konto?',
  'login.login':              'Anmelden',
  'login.invalidCredentials': 'Ungültige E-Mail oder Passwort.',
  'login.alreadyRegistered':  'Diese E-Mail ist bereits registriert. Bitte melden Sie sich an.',

  // InputForm
  'input.symptomsTab':        '⚡ SYMPTOME',
  'input.obdTab':             '📡 OBD',
  'input.textTab':            '✍️ BESCHREIBUNG',
  'input.selectedCount':      '{count} ausgew.',
  'input.codesCount':         '{count} Codes',
  'input.obdPlaceholder':     'P0401, P2263...',
  'input.commonCodes':        'ALLGEMEINE OBD-CODES',
  'input.engineCodes':        'MOTORSPEZIFISCH',
  'input.brandCodes':         '{brand} — SPEZIFISCH',
  'input.describeFault':      "Beschreiben Sie den Fehler in eigenen Worten... z.B. 'Nach dem Start ging es in den Notlauf, schwarzer Rauch, Motor- und DPF-Warnleuchte an...'",
  'input.enterHint':          'Symptome oder OBD-Codes eingeben',
  'input.analyzing':          'Analysiere...',
  'input.followupPlaceholder':'Beschreiben Sie neue Erkenntnisse oder ergänzen Sie Informationen... (Enter = senden, Shift+Enter = neue Zeile)',
  'input.send':               '▶ Senden',

  // DiagCard
  'diag.title':               'AI-DIAGNOSE',
  'diag.probability':         'WAHRSCH.',
  'diag.repairProcedure':     'REPARATURVERFAHREN',
  'diag.ragInfo':             '◈ Servicedatenbank: {count} ähnliche Fälle berücksichtigt',
  'diag.recommendedTests':    'EMPFOHLENE TESTS',
  'diag.notes':               'ANMERKUNGEN',

  // ConfirmModal
  'confirm.cancel':           'Abbrechen',

  // ErrorBoundary
  'error.title':              'UNERWARTETER FEHLER',
  'error.description':        'Die Anwendung ist auf ein unerwartetes Problem gestoßen. Versuchen Sie, sie neu zu starten.',
  'error.unknown':            'Unbekannter Fehler',
  'error.restart':            '↺ NEU STARTEN',

  // Validation
  'validation.resolutionEmpty':     'Reparaturbeschreibung fehlt.',
  'validation.resolutionTooShort':  'Reparaturbeschreibung ist zu kurz ({length} Zeichen, Minimum {min}).',
  'validation.resolutionTooLong':   'Reparaturbeschreibung ist zu lang ({length} Zeichen, Maximum {max}).',
  'validation.resolutionRepeating': 'Reparaturbeschreibung enthält sich wiederholende Zeichen.',
  'validation.resolutionTerse':     'Reparaturbeschreibung ist zu knapp — fügen Sie mindestens 2 verschiedene Wörter hinzu.',

  // AI
  'ai.topicIrrelevant':  'Beschreibung enthält keine technischen Daten (OBD-Code, Abkürzung wie DPF/EGR/ABS oder Messwert). Beschreiben Sie das technische Problem oder die Fehlersymptome.',

  // PDF export
  'pdf.title':            'DIAGNOSEBERICHT',
  'pdf.vehicle':          'FAHRZEUG',
  'pdf.inputRound':       'EINGABE #{num}',
  'pdf.diagnosis':        'DIAGNOSE #{num}',
  'pdf.summary':          'ZUSAMMENFASSUNG',
  'pdf.resolution':       'DURCHGEFÜHRTE REPARATUR',
  'pdf.generated':        'Generiert',
  'pdf.page':             'Seite',
  'pdf.variant.service':       'Serviceprotokoll',
  'pdf.variant.service.desc':  'Werkstattstil — Tabelle, Streifen, Boxen',
  'pdf.variant.technical':     'Technischer Bericht',
  'pdf.variant.technical.desc':'Formell — Tabellen, Karten mit Rahmen',
  'pdf.variant.minimalist':    'Minimalistisch',
  'pdf.variant.minimalist.desc':'Sauber, viel Weißraum',

  // Symptom categories
  'sym.cat.engine':       'Motor & Leistung',
  'sym.cat.transmission': 'Getriebe & Kupplung',
  'sym.cat.brakes':       'Bremsen & Fahrwerk',
  'sym.cat.steering':     'Lenkung',
  'sym.cat.electrical':   'Elektrik & Elektronik',
  'sym.cat.exhaust':      'Abgas & Emissionen',

  // Symptoms — Engine & Power
  'sym.lossOfPower':      'Leistungsverlust',
  'sym.blackSmoke':       'Schwarzer Abgasrauch',
  'sym.whiteSmoke':       'Weißer Abgasrauch',
  'sym.excessFuel':       'Übermäßiger Kraftstoffverbrauch',
  'sym.roughIdle':        'Unrunder Leerlauf',
  'sym.stalling':         'Motor geht aus',
  'sym.hardStart':        'Schwieriges Starten',
  'sym.noStart':          'Motor startet nicht',
  'sym.limpMode':         'Notlaufmodus',
  'sym.overheating':      'Motorüberhitzung',
  'sym.oilConsumption':   'Übermäßiger Ölverbrauch',

  // Symptoms — Transmission & Clutch
  'sym.shiftVibration':   'Vibration beim Schalten',
  'sym.hardShifting':     'Schwieriges Schalten',
  'sym.clutchSlip':       'Kupplung rutscht',
  'sym.shiftJerks':       'Schaltstöße',
  'sym.gearboxNoise':     'Getriebegeräusche',
  'sym.accelDropout':     'Aussetzer bei Beschleunigung',

  // Symptoms — Brakes & Chassis
  'sym.absLight':         'ABS-Warnleuchte an',
  'sym.brakePulse':       'Bremspulsieren',
  'sym.brakePull':        'Zieht beim Bremsen zur Seite',
  'sym.chassisNoise':     'Fahrwerksgeräusche',
  'sym.steeringVibration':'Lenkradvibration',
  'sym.unevenTyreWear':   'Ungleichmäßiger Reifenverschleiß',

  // Symptoms — Steering
  'sym.heavySteering':    'Schwergängige Lenkung',
  'sym.steeringPlay':     'Lenkungsspiel',
  'sym.steeringClick':    'Klicken beim Lenken',
  'sym.pullingSide':      'Zieht beim Fahren zur Seite',
  'sym.steeringLight':    'Lenkungswarnleuchte an',

  // Symptoms — Electrical & Electronics
  'sym.milLight':         'Motorkontrollleuchte (MIL) an',
  'sym.electricalDropout':'Elektrikausfälle',
  'sym.alternatorIssue':  'Lichtmaschinenprobleme',
  'sym.batteryDrain':     'Batterieentladung',
  'sym.centralLockIssue': 'Zentralverriegelungsprobleme',
  'sym.dashErrors':       'Fehlermeldungen im Bordcomputer',

  // Symptoms — Exhaust & Emissions
  'sym.dpfLight':         'DPF-Warnleuchte an',
  'sym.adblueWarning':    'AdBlue-Warnung',
  'sym.exhaustSmell':     'Abgasgeruch',
  'sym.accelSmoke':       'Rauch bei Beschleunigung',
  'sym.dpfRegenFail':     'DPF-Regeneration fehlgeschlagen',
}
