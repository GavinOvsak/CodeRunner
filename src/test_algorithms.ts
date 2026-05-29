import { reconstructStateFromLog } from './utils';
import { crNextTasks } from './data';
import type { Patient, LogEntry } from './types';

function assertEqual<T>(actual: T, expected: T, msg: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`\x1b[32m✓ PASS:\x1b[0m ${msg}`);
  } else {
    console.error(`\x1b[31m✗ FAIL:\x1b[0m ${msg}`);
    console.error(`  Expected:`, expected);
    console.error(`  Actual:  `, actual);
    process.exit(1);
  }
}

console.log('Running CodeRunner Clinical Algorithm Tests...\n');

const BASE = 2_000_000;

const blank: Patient = {
  id: 'p_algo',
  name: 'Algorithm Test',
  type: 'adult',
  startedAt: BASE,
  alert: '?',
  breathing: '?',
  pulse: '?',
  rate: '?',
  symptomatic: '?',
  rhythm: '?',
  rescuers: '?',
  glucose: '?',
  strokeSx: '?',
  weightKg: null,
  cpr: { active: false, cycleNumber: 0, cycleStartAt: 0, pausedAt: null, metronomeAnchor: BASE },
  gave: [],
  doneTasks: {},
  log: [],
};

function build(log: LogEntry[]): Patient {
  return reconstructStateFromLog({ ...blank, log });
}

function tasks(log: LogEntry[], now: number = BASE + 30_000): ReturnType<typeof crNextTasks> {
  return crNextTasks(build(log), now);
}

function hasTask(ts: ReturnType<typeof crNextTasks>, id: string): boolean {
  return ts.some(t => t.id === id);
}

// ─────────────────────────────────────────────────────────────
// Initial Assessment
// ─────────────────────────────────────────────────────────────

const allUnknown = tasks([]);
assertEqual(hasTask(allUnknown, 'check-alert'),  true,  'Unknown state: check-alert shown');
assertEqual(hasTask(allUnknown, 'check-breath'), true,  'Unknown state: check-breath shown');
assertEqual(hasTask(allUnknown, 'check-pulse'),  true,  'Unknown state: check-pulse shown');

const alertYesLog: LogEntry[] = [{ at: BASE + 1000, type: 'status', field: 'alert', value: 'Yes' }];
const afterAlertYes = tasks(alertYesLog);
assertEqual(hasTask(afterAlertYes, 'check-pulse'), false, 'Alert Yes: check-pulse suppressed');

const pulseYesLog: LogEntry[] = [{ at: BASE + 1000, type: 'status', field: 'pulse', value: 'Yes' }];
assertEqual(hasTask(tasks(pulseYesLog), 'check-rate'), true, 'Pulse Yes: check-rate shown');

const pulseYesFastLog: LogEntry[] = [
  ...pulseYesLog,
  { at: BASE + 2000, type: 'status', field: 'rate', value: 'Fast' },
];
assertEqual(hasTask(tasks(pulseYesFastLog), 'check-rhythm'),     true, 'Pulse Yes + Fast: check-rhythm shown');
assertEqual(hasTask(tasks(pulseYesFastLog), 'check-symptomatic'), true, 'Pulse Yes + Fast: check-symptomatic shown');

// ─────────────────────────────────────────────────────────────
// Cardiac Arrest — pre-CPR
// ─────────────────────────────────────────────────────────────

const pulseNoLog: LogEntry[] = [{ at: BASE + 1000, type: 'status', field: 'pulse', value: 'No' }];
const pulseNoTasks = tasks(pulseNoLog);
assertEqual(hasTask(pulseNoTasks, 'get-aed'),   true, 'Pulse No: get-aed shown');
assertEqual(hasTask(pulseNoTasks, 'start-cpr'), true, 'Pulse No: start-cpr shown');
assertEqual(hasTask(pulseNoTasks, 'shock'),     false, 'Pulse No, no AED yet: shock NOT shown');

const vfWithAedLog: LogEntry[] = [
  { at: BASE + 1000, type: 'status', field: 'pulse',  value: 'No' },
  { at: BASE + 2000, type: 'status', field: 'rhythm', value: 'VF' },
  { at: BASE + 3000, type: 'task',   taskId: 'get-aed' },
];
const vfWithAedTasks = tasks(vfWithAedLog);
assertEqual(vfWithAedTasks[0].id, 'shock',     'VF + AED done: shock is first task');
assertEqual(vfWithAedTasks[1].id, 'start-cpr', 'VF + AED done: start-cpr is second task');

// ─────────────────────────────────────────────────────────────
// Cardiac Arrest — CPR running
// ─────────────────────────────────────────────────────────────

const cprRunningVfLog: LogEntry[] = [
  { at: BASE + 1000, type: 'status', field: 'pulse',  value: 'No'  },
  { at: BASE + 2000, type: 'task',   taskId: 'get-aed' },
  { at: BASE + 3000, type: 'cpr',    event: 'start', cycleNumber: 1 },
  // Rhythm set after CPR starts (clinician sees VF on monitor during compressions)
  { at: BASE + 4000, type: 'status', field: 'rhythm', value: 'VF'  },
];
const cprRunningVfTasks = tasks(cprRunningVfLog);
assertEqual(hasTask(cprRunningVfTasks, 'pause-to-shock'), true, 'CPR running + VF + AED: pause-to-shock shown');
assertEqual(hasTask(cprRunningVfTasks, 'reversible'),     true, 'CPR running: H\'s & T\'s shown');

// H's & T's is recurring — still shown after being acknowledged
const cprRunningHtAckLog: LogEntry[] = [
  ...cprRunningVfLog,
  { at: BASE + 5000, type: 'task', taskId: 'reversible' },
];
assertEqual(hasTask(tasks(cprRunningHtAckLog), 'reversible'), true, 'H\'s & T\'s: still shown after acknowledge (recurring)');

// ─────────────────────────────────────────────────────────────
// Cardiac Arrest — CPR paused, non-shockable
// ─────────────────────────────────────────────────────────────

const cprPausedPeaLog: LogEntry[] = [
  { at: BASE + 1000, type: 'cpr',    event: 'start', cycleNumber: 1 },
  { at: BASE + 2000, type: 'status', field: 'rhythm', value: 'PEA' },
  { at: BASE + 120_000, type: 'cpr', event: 'pause', cycleNumber: 1, elapsed: 119_000 },
];
const cprPausedPeaTasks = tasks(cprPausedPeaLog, BASE + 121_000);
assertEqual(hasTask(cprPausedPeaTasks, 'epi'),   true,  'CPR paused + PEA (non-shockable): epi shown immediately');
assertEqual(hasTask(cprPausedPeaTasks, 'shock'),  false, 'CPR paused + PEA: shock NOT shown');

// ─────────────────────────────────────────────────────────────
// Shockable rhythm helpers
// Shocks are given before the current pause so shockedThisPause=false,
// allowing the assessment (pulse=No, rhythm=VF) to trigger pushArrestDrugs.
// Pulse must be set before rhythm because pulse=No resets rhythm to "?".
// ─────────────────────────────────────────────────────────────

function makeArrestPaused(shockCount: number): LogEntry[] {
  const shocks: LogEntry[] = Array.from({ length: shockCount }, (_, i) => ({
    at: BASE + 3000 + i * 500,
    type: 'med' as const,
    action: 'give' as const,
    key: 'shock' as const,
  }));
  return [
    { at: BASE + 1000,    type: 'task', taskId: 'get-aed' },
    { at: BASE + 2000,    type: 'cpr',  event: 'start', cycleNumber: 1 },
    ...shocks,
    { at: BASE + 120_000, type: 'cpr',  event: 'pause', cycleNumber: 1, elapsed: 118_000 },
    { at: BASE + 120_500, type: 'status', field: 'pulse',  value: 'No' },
    { at: BASE + 121_000, type: 'status', field: 'rhythm', value: 'VF' },
  ];
}

// VF + 0 shocks: epi NOT shown (shockable requires 1 shock first); shock IS shown
const vf0Tasks = tasks(makeArrestPaused(0), BASE + 122_000);
assertEqual(hasTask(vf0Tasks, 'epi'),  false, 'VF + 0 shocks: epi NOT shown before first shock');
assertEqual(hasTask(vf0Tasks, 'shock'), true,  'VF + 0 shocks: shock shown');

// VF + 1 shock: epi now shown
assertEqual(hasTask(tasks(makeArrestPaused(1), BASE + 122_000), 'epi'), true, 'VF + 1 shock: epi shown');

// ─────────────────────────────────────────────────────────────
// Epinephrine timing: 3-minute readiness window
// ─────────────────────────────────────────────────────────────

const epiGivenAt = BASE + 130_000;
const epiTimingLog: LogEntry[] = [
  { at: BASE + 1000,    type: 'cpr',    event: 'start', cycleNumber: 1 },
  { at: BASE + 2000,    type: 'status', field: 'rhythm', value: 'PEA' },
  { at: BASE + 120_000, type: 'cpr',    event: 'pause', cycleNumber: 1, elapsed: 119_000 },
  { at: epiGivenAt,     type: 'med',    action: 'give', key: 'epi' },
];

const notYet = tasks(epiTimingLog, epiGivenAt + 2 * 60_000 + 59_000);
assertEqual(hasTask(notYet, 'epi'), false, 'Epi: NOT ready at 2:59 after last dose');

const ready = tasks(epiTimingLog, epiGivenAt + 3 * 60_000 + 1_000);
assertEqual(hasTask(ready, 'epi'), true, 'Epi: ready at 3:01 after last dose');

// ─────────────────────────────────────────────────────────────
// Amiodarone / Lidocaine: only after 2nd shock
// ─────────────────────────────────────────────────────────────

const oneShockPausedTasks = tasks(makeArrestPaused(1), BASE + 122_000);
assertEqual(hasTask(oneShockPausedTasks, 'amio'), false, '1 shock: amio NOT shown yet');
assertEqual(hasTask(oneShockPausedTasks, 'lido'), false, '1 shock: lido NOT shown yet');

const twoShockPausedTasks = tasks(makeArrestPaused(2), BASE + 122_000);
assertEqual(hasTask(twoShockPausedTasks, 'amio'), true, '2 shocks: amio shown');
assertEqual(hasTask(twoShockPausedTasks, 'lido'), true, '2 shocks: lido shown');

// Amiodarone dose labels: 300mg first, 150mg repeat
const amioFirst = twoShockPausedTasks.find(t => t.id === 'amio');
assertEqual(amioFirst?.label, 'Give Amiodarone 300mg', 'Amio first dose: 300mg label');

const amioGivenAt = BASE + 121_500;
const amioRepeatLog: LogEntry[] = [
  ...makeArrestPaused(2),
  { at: amioGivenAt, type: 'med', action: 'give', key: 'amio' },
];

// < 5 min after dose: amio should NOT be shown
assertEqual(hasTask(tasks(amioRepeatLog, amioGivenAt + 4 * 60_000 + 59_000), 'amio'), false, 'Amio: NOT shown at 4:59 after last dose');

// >= 5 min after dose: amio IS shown with repeat label
const amioRepeatTasks = tasks(amioRepeatLog, amioGivenAt + 5 * 60_000 + 1_000);
const amioRepeat = amioRepeatTasks.find(t => t.id === 'amio');
assertEqual(amioRepeat?.label, 'Give Amiodarone 150mg', 'Amio repeat dose: 150mg label at 5:01 after last dose');

// < 5 min after lido dose: lido should NOT be shown
const lidoGivenAt = BASE + 121_500;
const lidoRepeatLog: LogEntry[] = [
  ...makeArrestPaused(2),
  { at: lidoGivenAt, type: 'med', action: 'give', key: 'lido' },
];
assertEqual(hasTask(tasks(lidoRepeatLog, lidoGivenAt + 4 * 60_000 + 59_000), 'lido'), false, 'Lido: NOT shown at 4:59 after last dose');

// >= 5 min after lido dose: lido IS shown
assertEqual(hasTask(tasks(lidoRepeatLog, lidoGivenAt + 5 * 60_000 + 1_000), 'lido'), true, 'Lido: shown at 5:01 after last dose');

// ─────────────────────────────────────────────────────────────
// ROSC: pulse returns during pause
// ─────────────────────────────────────────────────────────────

const roscLog: LogEntry[] = [
  { at: BASE + 1000,  type: 'cpr',    event: 'start', cycleNumber: 1 },
  { at: BASE + 120_000, type: 'cpr',  event: 'pause', cycleNumber: 1, elapsed: 119_000 },
  { at: BASE + 121_000, type: 'status', field: 'pulse', value: 'Yes' },
];
assertEqual(hasTask(tasks(roscLog, BASE + 122_000), 'rosc'), true, 'Pulse returns during pause: ROSC task shown');

// ─────────────────────────────────────────────────────────────
// Access task: shown when not done, hidden after completion
// ─────────────────────────────────────────────────────────────

const cprActiveLog: LogEntry[] = [
  { at: BASE + 1000, type: 'cpr', event: 'start', cycleNumber: 1 },
];
assertEqual(hasTask(tasks(cprActiveLog), 'access'), true, 'CPR active: access task shown');

const accessDoneLog: LogEntry[] = [
  ...cprActiveLog,
  { at: BASE + 2000, type: 'task', taskId: 'access' },
];
assertEqual(hasTask(tasks(accessDoneLog), 'access'), false, 'Access done: access task hidden');

// ─────────────────────────────────────────────────────────────
// Tachycardia pathway
// ─────────────────────────────────────────────────────────────

const svtLog: LogEntry[] = [
  { at: BASE + 1000, type: 'status', field: 'pulse',       value: 'Yes' },
  { at: BASE + 2000, type: 'status', field: 'rate',        value: 'Fast' },
  { at: BASE + 3000, type: 'status', field: 'symptomatic', value: 'Yes' },
  { at: BASE + 4000, type: 'status', field: 'rhythm',      value: 'SVT' },
];
const svtTasks = tasks(svtLog);
assertEqual(hasTask(svtTasks, 'ecg'),      true, 'SVT: ECG shown');
assertEqual(hasTask(svtTasks, 'access'),   true, 'SVT: access shown');
assertEqual(hasTask(svtTasks, 'adenosine'), true, 'SVT: adenosine shown');

const svtFirstAdeno = svtTasks.find(t => t.id === 'adenosine');
assertEqual(svtFirstAdeno?.label, 'Adenosine 6mg rapid push', 'SVT: first adenosine dose 6mg');

// Adenosine dose escalation: 12mg after first dose
const svtOneAdenoLog: LogEntry[] = [
  ...svtLog,
  { at: BASE + 5000, type: 'med', action: 'give', key: 'adenosine' },
];
const svtSecondAdenoTask = tasks(svtOneAdenoLog).find(t => t.id === 'adenosine');
assertEqual(svtSecondAdenoTask?.label, 'Adenosine 12mg rapid push', 'SVT: second adenosine dose 12mg');

// Adenosine cap: no suggestion after 3 doses
const svtThreeAdenoLog: LogEntry[] = [
  ...svtLog,
  { at: BASE + 5000, type: 'med', action: 'give', key: 'adenosine' },
  { at: BASE + 6000, type: 'med', action: 'give', key: 'adenosine' },
  { at: BASE + 7000, type: 'med', action: 'give', key: 'adenosine' },
];
assertEqual(hasTask(tasks(svtThreeAdenoLog), 'adenosine'), false, 'SVT: adenosine not shown after 3 doses');

// Wide tach → amiodarone
const wideTachLog: LogEntry[] = [
  { at: BASE + 1000, type: 'status', field: 'pulse',       value: 'Yes' },
  { at: BASE + 2000, type: 'status', field: 'rate',        value: 'Fast' },
  { at: BASE + 3000, type: 'status', field: 'symptomatic', value: 'Yes' },
  { at: BASE + 4000, type: 'status', field: 'rhythm',      value: 'WideTach' },
];
assertEqual(hasTask(tasks(wideTachLog), 'amio'), true, 'Wide tach: amio shown');

// AF → cardiovert
const afLog: LogEntry[] = [
  { at: BASE + 1000, type: 'status', field: 'pulse',       value: 'Yes' },
  { at: BASE + 2000, type: 'status', field: 'rate',        value: 'Fast' },
  { at: BASE + 3000, type: 'status', field: 'symptomatic', value: 'Yes' },
  { at: BASE + 4000, type: 'status', field: 'rhythm',      value: 'AF' },
];
assertEqual(hasTask(tasks(afLog), 'cardiovert'), true, 'AF: cardiovert shown');

// Tachycardia not triggered when asymptomatic
const svtAsymptLog: LogEntry[] = [
  { at: BASE + 1000, type: 'status', field: 'pulse',       value: 'Yes' },
  { at: BASE + 2000, type: 'status', field: 'rate',        value: 'Fast' },
  { at: BASE + 3000, type: 'status', field: 'symptomatic', value: 'No' },
  { at: BASE + 4000, type: 'status', field: 'rhythm',      value: 'SVT' },
];
assertEqual(hasTask(tasks(svtAsymptLog), 'adenosine'), false, 'SVT asymptomatic: adenosine NOT shown');
assertEqual(hasTask(tasks(svtAsymptLog), 'ecg'),       false, 'SVT asymptomatic: ECG NOT shown');

// ─────────────────────────────────────────────────────────────
// Bradycardia pathway
// ─────────────────────────────────────────────────────────────

const bradyLog: LogEntry[] = [
  { at: BASE + 1000, type: 'status', field: 'pulse',       value: 'Yes' },
  { at: BASE + 2000, type: 'status', field: 'rate',        value: 'Slow' },
  { at: BASE + 3000, type: 'status', field: 'symptomatic', value: 'Yes' },
];
const bradyTasks = tasks(bradyLog);
assertEqual(hasTask(bradyTasks, 'access'),   true, 'Brady: access shown');
assertEqual(hasTask(bradyTasks, 'atropine'), true, 'Brady: atropine shown');
assertEqual(hasTask(bradyTasks, 'pace'),     true, 'Brady: pacing shown');
assertEqual(hasTask(bradyTasks, 'dopamine'), true, 'Brady: dopamine shown');

// Atropine dose cap: not shown after 3 doses (3mg total = max)
const bradyThreeAtropineLog: LogEntry[] = [
  ...bradyLog,
  { at: BASE + 4000, type: 'med', action: 'give', key: 'atropine' },
  { at: BASE + 5000, type: 'med', action: 'give', key: 'atropine' },
  { at: BASE + 6000, type: 'med', action: 'give', key: 'atropine' },
];
assertEqual(hasTask(tasks(bradyThreeAtropineLog), 'atropine'), false, 'Brady: atropine NOT shown after 3 doses (3mg max)');

// Atropine cooldown: q 3-5 min — not shown within 3 min of last dose
const bradyOneAtropineLog: LogEntry[] = [
  ...bradyLog,
  { at: BASE + 4000, type: 'med', action: 'give', key: 'atropine' },
];
assertEqual(hasTask(tasks(bradyOneAtropineLog, BASE + 64_000),  'atropine'), false, 'Brady: atropine NOT shown within 3 min of last dose');
assertEqual(hasTask(tasks(bradyOneAtropineLog, BASE + 184_000), 'atropine'), true,  'Brady: atropine shown again after 3 min cooldown');

// Bradycardia not triggered when asymptomatic
const bradyAsymptLog: LogEntry[] = [
  { at: BASE + 1000, type: 'status', field: 'pulse',       value: 'Yes' },
  { at: BASE + 2000, type: 'status', field: 'rate',        value: 'Slow' },
  { at: BASE + 3000, type: 'status', field: 'symptomatic', value: 'No' },
];
assertEqual(hasTask(tasks(bradyAsymptLog), 'atropine'), false, 'Brady asymptomatic: atropine NOT shown');

// ─────────────────────────────────────────────────────────────
// Respiratory arrest
// ─────────────────────────────────────────────────────────────

const respArrestLog: LogEntry[] = [
  { at: BASE + 1000, type: 'status', field: 'breathing', value: 'No' },
  { at: BASE + 2000, type: 'status', field: 'pulse',     value: 'Yes' },
];
const respTasks = tasks(respArrestLog);
assertEqual(hasTask(respTasks, 'opioid-reversal'),  true, 'Resp arrest: opioid-reversal shown');
assertEqual(hasTask(respTasks, 'rescue-breaths'),   true, 'Resp arrest + pulse: rescue-breaths shown (recurring)');

// ─────────────────────────────────────────────────────────────
// Altered alertness pathway
// ─────────────────────────────────────────────────────────────

const alteredLog: LogEntry[] = [
  { at: BASE + 1000, type: 'status', field: 'alert', value: 'Altered' },
  { at: BASE + 2000, type: 'status', field: 'pulse', value: 'Yes' },
];
const alteredTasks = tasks(alteredLog);
assertEqual(hasTask(alteredTasks, 'glucose'), true, 'Altered alert: check glucose shown');

const glucoseLowLog: LogEntry[] = [
  ...alteredLog,
  { at: BASE + 3000, type: 'status', field: 'glucose', value: 'Low' },
];
assertEqual(hasTask(tasks(glucoseLowLog), 'd50'), true, 'Glucose Low: d50 shown');

const strokeLog: LogEntry[] = [
  ...alteredLog,
  { at: BASE + 3000, type: 'status', field: 'glucose',  value: 'Normal' },
  { at: BASE + 4000, type: 'status', field: 'strokeSx', value: 'Yes' },
];
const strokeTasks = tasks(strokeLog);
assertEqual(hasTask(strokeTasks, 'fast'), true, 'Stroke Sx Yes: FAST scale shown');
assertEqual(hasTask(strokeTasks, 'ct'),   true, 'Stroke Sx Yes: CT activation shown');

// ─────────────────────────────────────────────────────────────
// Choking pathway
// ─────────────────────────────────────────────────────────────

const chokingLog: LogEntry[] = [
  { at: BASE + 1000, type: 'status', field: 'breathing', value: 'Choking' },
];
const chokingTasks = tasks(chokingLog);
const chokingCycleTask = chokingTasks.find(t => t.id === 'choking-cycles');
const reassessTask     = chokingTasks.find(t => t.id === 'reassess-responsiveness');
assertEqual(chokingCycleTask?.recurring, true, 'Choking: choking-cycles is recurring');
assertEqual(reassessTask?.recurring,     true, 'Choking: reassess-responsiveness is recurring');

// After acknowledging, recurring tasks remain
const chokingAckLog: LogEntry[] = [
  ...chokingLog,
  { at: BASE + 2000, type: 'task', taskId: 'choking-cycles' },
];
assertEqual(hasTask(tasks(chokingAckLog), 'choking-cycles'), true, 'Choking: still shown after acknowledge (recurring)');

// ─────────────────────────────────────────────────────────────
// Pediatric dosing
// ─────────────────────────────────────────────────────────────

const pedsBlank: Patient = { ...blank, type: 'pediatric' };

function pedsTasks(log: LogEntry[], now: number = BASE + 30_000) {
  return crNextTasks(reconstructStateFromLog({ ...pedsBlank, log }), now);
}

const pedsArrestNoWeightLog: LogEntry[] = [
  { at: BASE + 1000, type: 'cpr',    event: 'start', cycleNumber: 1 },
  { at: BASE + 2000, type: 'status', field: 'rhythm', value: 'PEA' },
  { at: BASE + 120_000, type: 'cpr', event: 'pause', cycleNumber: 1, elapsed: 119_000 },
];
const pedsNoWeightEpi = pedsTasks(pedsArrestNoWeightLog, BASE + 121_000).find(t => t.id === 'epi');
assertEqual(pedsNoWeightEpi?.label, 'Give Epi 0.01mg/kg (max 1mg) IV/IO (q 3-5 min)', 'Peds no weight: epi label shows per-kg formula');

const pedsArrestWithWeightLog: LogEntry[] = [
  ...pedsArrestNoWeightLog,
  { at: BASE + 3000, type: 'status', field: 'weight', value: 20 },
];
const pedsWeightEpi = pedsTasks(pedsArrestWithWeightLog, BASE + 121_000).find(t => t.id === 'epi');
assertEqual(pedsWeightEpi?.label, 'Give Epi 0.20mg IV/IO (q 3-5 min)', 'Peds 20kg: epi dose computed as 0.20mg');

// Peds amio: after 2 shocks, first dose 5mg/kg (max 300mg)
const pedsVfTwoShockLog: LogEntry[] = [
  { at: BASE + 1000, type: 'task',   taskId: 'get-aed' },
  { at: BASE + 2000, type: 'status', field: 'weight', value: 10 },
  { at: BASE + 3000, type: 'med',    action: 'give', key: 'shock' },
  { at: BASE + 4000, type: 'med',    action: 'give', key: 'shock' },
  { at: BASE + 5000, type: 'cpr',    event: 'start', cycleNumber: 1 },
  { at: BASE + 125_000, type: 'cpr', event: 'pause',  cycleNumber: 1, elapsed: 120_000 },
  { at: BASE + 125_500, type: 'status', field: 'pulse',  value: 'No' },
  { at: BASE + 126_000, type: 'status', field: 'rhythm', value: 'VF' },
];
const pedsAmioTask = pedsTasks(pedsVfTwoShockLog, BASE + 127_000).find(t => t.id === 'amio');
assertEqual(pedsAmioTask?.label, 'Give Amiodarone 50mg IV/IO', 'Peds 10kg: amio first dose 50mg (5mg/kg)');

// ─────────────────────────────────────────────────────────────
// Symptomatic: explicit No is preserved (not overridden to ?)
// ─────────────────────────────────────────────────────────────

const svtExplicitNoLog: LogEntry[] = [
  { at: BASE + 1000, type: 'status', field: 'pulse',       value: 'Yes' },
  { at: BASE + 2000, type: 'status', field: 'rate',        value: 'Fast' },
  { at: BASE + 3000, type: 'status', field: 'symptomatic', value: 'No' },
];
const svtExplicitNo = build(svtExplicitNoLog);
assertEqual(svtExplicitNo.symptomatic, 'No', 'Explicit symptomatic No preserved (not overridden to ?)');
assertEqual(hasTask(tasks(svtExplicitNoLog), 'ecg'), false, 'Explicit symptomatic No: tachycardia algorithm not triggered');

// ─────────────────────────────────────────────────────────────
// Rate re-entry does not reset rhythm when value unchanged
// ─────────────────────────────────────────────────────────────

const rateReEntryLog: LogEntry[] = [
  { at: BASE + 1000, type: 'status', field: 'pulse',  value: 'Yes'  },
  { at: BASE + 2000, type: 'status', field: 'rate',   value: 'Fast' },
  { at: BASE + 3000, type: 'status', field: 'rhythm', value: 'SVT'  },
  { at: BASE + 4000, type: 'status', field: 'rate',   value: 'Fast' }, // same value re-entered
];
assertEqual(build(rateReEntryLog).rhythm, 'SVT', 'Rate re-entry with same value does not reset rhythm');

console.log('\n\x1b[32m✔ All clinical algorithm tests passed!\x1b[0m');
