// ── GearBrain i18n — English (EN) ────────────────────────────────────────────

export const strings = {
  // App — general
  'app.loading':          'Loading...',
  'app.subtitle':         'AI VEHICLE DIAGNOSTICS',
  'app.casesCount':       '{count} cases',
  'app.cloudOk':          'cloud ✓',
  'app.cloudOffline':     'cloud offline',
  'app.cloudIdle':        'cloud —',
  'app.lightMode':        '☀️ Light',
  'app.darkMode':         '🌙 Dark',
  'app.logout':           'Log out',

  // App — sidebar
  'app.newCase':          '+ NEW CASE',
  'app.noCases':          'No cases.',
  'app.noCasesHint':      'Click NEW CASE to start.',
  'app.dbActive':         'Database active — {count} cases',
  'app.dbActiveEmpty':    'Database active — empty',
  'app.dbInactive':       'Database inactive',
  'app.dbConnecting':     'Database: connecting...',

  // App — welcome
  'app.welcomeText':      'Select a case from the list',
  'app.welcomeHint':      'or create a new diagnosis',

  // App — new case
  'app.newCaseTitle':     'NEW DIAGNOSTIC CASE',
  'app.newCaseSubtitle':  'Enter vehicle information and initial fault symptoms',
  'app.vehicleBrand':     'VEHICLE BRAND',
  'app.vehicleModel':     'VEHICLE MODEL',
  'app.selectModel':      '— Select model —',
  'app.enginePower':      'ENGINE POWER',
  'app.optional':         '— Optional —',
  'app.defaultBrandHint':  'Set as default brand',
  'app.mileageKm':        'MILEAGE (KM)',
  'app.identLabel':       'PLATE / VIN',
  'app.identPlate':       'LP',
  'app.identPlaceholder': 'Licence plate or VIN (optional)',
  'app.identHistory':     '📋 {count} previous cases for this vehicle',
  'app.identShowHistory': 'Show history',
  'app.startDiag':        'START DIAGNOSIS',

  // App — diagnosis
  'app.tokenLimit':       'Case reached the limit of {limit} tokens. Close the case and summarise results.',
  'app.aiError':          'AI returned an error.',
  'app.aiNoResponse':     'AI did not return a response. Please try again.',
  'app.aiUnreadable':     'AI did not return a readable result. Try adding more symptoms.',
  'app.noFaults':         'No matching faults found.',
  'app.defaultVehicle':   'Vehicle',
  'app.errorPrefix':      'Error: ',

  // App — session
  'app.caseReady':        'Case ready — enter symptoms below and run diagnosis',
  'app.inputRound':       'Input #{num} · {date}',
  'app.aiProcessing':     '◈ AI DIAGNOSIS IN PROGRESS ◈',
  'app.aiProcessingSub':  'Searching service database · Analysing symptoms...',
  'app.caseClosed':       '✓ CASE CLOSED · {date}',
  'app.firstDiag':        'FIRST DIAGNOSIS — enter symptoms',
  'app.runDiag':          'RUN DIAGNOSIS',
  'app.addInfo':          'ADD INFORMATION',

  // App — close case modal
  'app.closeCaseTitle':   '✓ CLOSE CASE',
  'app.closeCaseHelp':    'Describe the repair performed. This information will be saved to the service database and will help with future diagnoses.',
  'app.repairLabel':      'REPAIR PERFORMED *',
  'app.repairPlaceholder':'e.g. Replaced EGR valve + EGR cooler. After intake cleaning and DPF regeneration the vehicle runs without issues. Code P0401 cleared, did not return.',
  'app.closeCaseHelpSmart':'Select what was done. This information will be saved to the service database.',
  'app.closeSelectResolution':'WHAT WAS DONE *',
  'app.closeOther':       'Other:',
  'app.closeCustomPlaceholder':'What was the actual cause / what was done?',
  'app.cancel':           'Cancel',
  'app.confirm':          '✓ Confirm',

  // App — delete case modal
  'app.deleteCaseTitle':  'DELETE CASE',
  'app.deleteClosedMsg':  'Really delete this case? This action is irreversible.\n⚠ Case is closed and is part of the service database.',
  'app.deleteOpenMsg':    'Really delete this case? This action is irreversible.',
  'app.deleteBtn':        '✕ Delete',
  'app.closeBtn':         '✓ CLOSE',
  'app.deleteLabel':      '✕ DELETE',

  // App — user prompt labels (sent to AI)
  'app.userVehicle':      'Vehicle',
  'app.userMileage':      'Mileage',
  'app.userSymptoms':     'Symptoms',
  'app.userObd':          'OBD codes',
  'app.userMechDesc':     'Mechanic description',

  // GDPR consent
  'consent.title':        'Privacy & Data',
  'consent.text':         'This app stores your diagnostic cases in an anonymous shared database that helps improve results for all users. Personal data (email) is used only for authentication. We do not sell any data to third parties.',
  'consent.declineNote':  'If you decline, the app will work normally, but your closed cases won\'t contribute to the shared database and AI won\'t be able to leverage other mechanics\' experience.',
  'consent.accept':       'I agree',
  'consent.decline':      'Decline',

  // Feedback
  'app.feedback':         '✉ Feedback',
  'app.feedbackSubject':  'GearBrain — Feedback',
  'app.feedbackPlaceholder': 'Feedback...',
  'app.feedbackSend':     'Send',
  'app.feedbackSent':     'Sent, thank you!',
  'app.feedbackError':    'Failed to send',

  // Admin review
  'review.sidebarBtn':    '📋 Review',
  'review.title':         'CASE REVIEW',
  'review.loading':       'Loading...',
  'review.count':         '{count} cases pending review',
  'review.empty':         'No cases to review ✓',
  'review.refresh':       'Refresh',
  'review.approveAll':    'Approve all',
  'review.approve':       'Approve',
  'review.reject':        'Reject',
  'review.resolution':    'REPAIR PERFORMED',

  // Analytics
  'analytics.sidebarBtn': 'Analytics',
  'analytics.title':      'ANALYTICS',
  'analytics.loading':    'Loading...',
  'analytics.period':     'Last {days} days',
  'analytics.periodMax':  'Since March 17, 2026',
  'analytics.today':      'Today',
  'analytics.users':      'users',
  'analytics.totalCalls': 'AI CALLS',
  'analytics.tokens':     'TOKENS',
  'analytics.activeDays': 'ACTIVE DAYS',
  'analytics.cases':      'CASES',
  'analytics.chartCalls': 'AI CALLS / DAY',
  'analytics.chartTokens':'TOKEN USAGE / DAY',
  'analytics.chartUsers': 'ACTIVE USERS / DAY',
  'analytics.noData':     'No data for this period',
  'analytics.registeredUsers': 'REGISTERED',
  'analytics.new7d':      '7d',
  'analytics.new30d':     '30d',
  'analytics.topUsers':   'TOP USERS BY TOKEN USAGE',
  'analytics.user':       'USER',
  'analytics.topCalls':   'CALLS',
  'analytics.topTokens':  'TOKENS',
  'analytics.brandStats': 'DIAGNOSED BRANDS',
  'analytics.brandSessions': 'Diagnosis count',
  'analytics.brandClosed': 'Closed cases in DB',

  // Status
  'status.closed':        '✓ CLOSED',
  'status.active':        '● ACTIVE',

  // Login
  'login.subtitle':           'AI DIAGNOSTICS · WEB',
  'login.verifyTitle':        'VERIFY YOUR EMAIL',
  'login.verifyMsg':          'We sent a verification link to {email}. Click the link and then sign in.',
  'login.backToLogin':        'BACK TO LOGIN',
  'login.loginTitle':         'SIGN IN',
  'login.registerTitle':      'REGISTER',
  'login.google':             'Continue with Google',
  'login.or':                 'OR',
  'login.email':              'EMAIL',
  'login.emailPlaceholder':   'your@email.com',
  'login.password':           'PASSWORD',
  'login.passwordPlaceholder':'min. 6 characters',
  'login.processing':         'Processing...',
  'login.loginBtn':           'SIGN IN',
  'login.registerBtn':        'REGISTER',
  'login.noAccount':          "Don't have an account?",
  'login.register':           'Register',
  'login.hasAccount':         'Already have an account?',
  'login.login':              'Sign in',
  'login.invalidCredentials': 'Invalid email or password.',
  'login.alreadyRegistered':  'This email is already registered. Please sign in.',

  // Terms of Service
  'tos.title':               'Terms of Service',
  'tos.intro':               'Please review and accept the GearBrain Terms of Service before registering.',
  'tos.keyPoints':           'Key Points:',
  'tos.aiDisclaimer':        'AI Diagnostics',
  'tos.aiDisclaimerDesc':    'Diagnostic results are indicative and serve as a support tool for mechanics. They do not replace a professional vehicle inspection. Always verify recommendations with your own diagnostics.',
  'tos.liability':           'Limitation of Liability',
  'tos.liabilityDesc':       'GearBrain is not liable for any damages resulting from repairs based on AI recommendations. The service is provided "as is" without warranty of accuracy or completeness.',
  'tos.dataUsage':           'Data Usage',
  'tos.dataUsageDesc':       'Closed diagnostic cases may be anonymized and used to improve service quality (similar cases database). Personal data is not included in anonymized data.',
  'tos.privacy':             'Privacy',
  'tos.privacyDesc':         'We only process data necessary to operate the service. Your data is never sold to third parties. GDPR rules apply.',
  'tos.law':                 'Governing Law',
  'tos.lawDesc':             'These terms are governed by the laws of the Czech Republic.',
  'tos.fullLink':            'Read full Terms of Service',
  'tos.agree':               'I have read and agree to the Terms of Service',
  'tos.accept':              'Accept & Continue',
  'tos.decline':             'I don\'t agree',

  // InputForm
  'input.symptomsTab':        '⚡ SYMPTOMS',
  'input.obdTab':             '📡 OBD',
  'input.textTab':            '✍️ DESCRIPTION',
  'input.selectedCount':      '{count} sel.',
  'input.codesCount':         '{count} codes',
  'input.obdPlaceholder':     'P0401, P2263...',
  'input.bleReadCodes':       'READ FROM OBD READER',
  'input.bleConnecting':      'Connecting...',
  'input.commonCodes':        'COMMON OBD CODES',
  'input.engineCodes':        'ENGINE-SPECIFIC',
  'input.brandCodes':         '{brand} — SPECIFIC',
  'input.describeFault':      "Describe the fault in your own words... e.g. 'After starting, it went into limp mode, black smoke, engine and DPF warning lights on...'",
  'input.enterHint':          'Enter symptoms or OBD codes',
  'input.analyzing':          'Analysing...',
  'input.followupPlaceholder':'Describe new findings or add information... (Enter = send, Shift+Enter = new line)',
  'input.send':               '▶ Send',

  // DiagCard
  'diag.title':               'AI DIAGNOSTICS',
  'diag.probability':         'PROB.',
  'diag.repairProcedure':     'REPAIR PROCEDURE',
  'diag.ragInfo':             '◈ Service database: {count} similar cases considered',
  'diag.sourceDb':            'DATABASE',
  'diag.sourceAi':            'AI ANALYSIS',
  'diag.dbCases':             '{count} matches',
  'diag.recommendedTests':    'RECOMMENDED TESTS',
  'diag.notes':               'NOTES',

  // ConfirmModal
  'confirm.cancel':           'Cancel',

  // ErrorBoundary
  'error.title':              'UNEXPECTED ERROR',
  'error.description':        'The application encountered an unexpected problem. Try restarting it.',
  'error.unknown':            'Unknown error',
  'error.restart':            '↺ RESTART',

  // Validation
  'validation.resolutionEmpty':     'Repair description is missing.',
  'validation.resolutionTooShort':  'Repair description is too short ({length} chars, minimum {min}).',
  'validation.resolutionTooLong':   'Repair description is too long ({length} chars, maximum {max}).',
  'validation.resolutionRepeating': 'Repair description contains repeating characters.',
  'validation.resolutionTerse':     'Repair description is too brief — add at least 2 different words.',

  // AI
  'ai.topicIrrelevant':  'Description contains no technical data (OBD code, abbreviation like DPF/EGR/ABS, or measured value). Describe the technical problem or fault symptoms.',

  // PDF export
  'pdf.title':            'DIAGNOSTIC REPORT',
  'pdf.vehicle':          'VEHICLE',
  'pdf.inputRound':       'INPUT #{num}',
  'pdf.diagnosis':        'DIAGNOSIS #{num}',
  'pdf.summary':          'SUMMARY',
  'pdf.resolution':       'PERFORMED REPAIR',
  'pdf.generated':        'Generated',
  'pdf.page':             'Page',
  'pdf.variant.service':       'Service Report',
  'pdf.variant.service.desc':  'Workshop style — table, stripes, boxes',
  'pdf.variant.technical':     'Technical Report',
  'pdf.variant.technical.desc':'Formal — tables, bordered cards',
  'pdf.variant.minimalist':    'Minimalist',
  'pdf.variant.minimalist.desc':'Clean, lots of white space',

  // Share
  'share.btn':            '🔗 SHARE',
  'share.copied':         '✓ Link copied!',
  'share.badge':          'SHARED DIAGNOSIS',
  'share.loading':        'Loading diagnosis...',
  'share.notFound':       'Shared link not found or expired.',
  'share.cta.title':      'Want your own diagnosis?',
  'share.cta.text':       'Register for free and diagnose your vehicle with AI and a database of mechanic experience.',
  'share.cta.btn':        'REGISTER FREE',

  // Symptom categories
  'sym.cat.engine':       'Engine & Power',
  'sym.cat.transmission': 'Transmission & Clutch',
  'sym.cat.brakes':       'Brakes & Chassis',
  'sym.cat.steering':     'Steering',
  'sym.cat.electrical':   'Electrical & Electronics',
  'sym.cat.exhaust':      'Exhaust & Emissions',

  // Symptoms — Engine & Power
  'sym.lossOfPower':      'Loss of power',
  'sym.blackSmoke':       'Black exhaust smoke',
  'sym.whiteSmoke':       'White exhaust smoke',
  'sym.excessFuel':       'Excessive fuel consumption',
  'sym.roughIdle':        'Rough idle',
  'sym.stalling':         'Engine stalls',
  'sym.hardStart':        'Difficult starting',
  'sym.noStart':          'Engine fails to start',
  'sym.limpMode':         'Limp mode',
  'sym.overheating':      'Engine overheating',
  'sym.oilConsumption':   'Excessive oil consumption',

  // Symptoms — Transmission & Clutch
  'sym.shiftVibration':   'Vibration when shifting',
  'sym.hardShifting':     'Difficult shifting',
  'sym.clutchSlip':       'Clutch slipping',
  'sym.shiftJerks':       'Shifting jerks',
  'sym.gearboxNoise':     'Gearbox noise',
  'sym.accelDropout':     'Acceleration dropouts',

  // Symptoms — Brakes & Chassis
  'sym.absLight':         'ABS warning light on',
  'sym.brakePulse':       'Brake pulsation',
  'sym.brakePull':        'Pulling to one side when braking',
  'sym.chassisNoise':     'Chassis noise',
  'sym.steeringVibration':'Steering wheel vibration',
  'sym.unevenTyreWear':   'Uneven tyre wear',

  // Symptoms — Steering
  'sym.heavySteering':    'Heavy steering',
  'sym.steeringPlay':     'Steering play',
  'sym.steeringClick':    'Clicking when turning steering wheel',
  'sym.pullingSide':      'Pulling to one side when driving',
  'sym.steeringLight':    'Steering warning light on',

  // Symptoms — Electrical & Electronics
  'sym.milLight':         'Engine warning light (MIL) on',
  'sym.electricalDropout':'Electrical dropouts',
  'sym.alternatorIssue':  'Alternator problems',
  'sym.batteryDrain':     'Battery drain',
  'sym.centralLockIssue': 'Central locking problems',
  'sym.dashErrors':       'Dashboard errors',

  // Symptoms — Exhaust & Emissions
  'sym.dpfLight':         'DPF warning light on',
  'sym.adblueWarning':    'AdBlue warning',
  'sym.exhaustSmell':     'Exhaust smell',
  'sym.accelSmoke':       'Smoke under acceleration',
  'sym.dpfRegenFail':     'DPF regeneration failure',
}
