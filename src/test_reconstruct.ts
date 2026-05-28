import { reconstructStateFromLog } from './utils';
import type { Patient, LogEntry } from './types';

// Simple assert helper to print green or red results
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

console.log('Running CodeRunner Reconstructor Unit Tests...\n');

// 1. Setup blank baseline patient
const mockPatient: Patient = {
  id: 'p_test',
  name: 'Test Patient',
  type: 'adult',
  startedAt: 1000000,
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
  cpr: { active: false, cycleNumber: 0, cycleStartAt: 0, pausedAt: null, metronomeAnchor: 0 },
  gave: [],
  doneTasks: {},
  log: [],
};

// Test Case 1: Initial state reconstruction of blank patient
const initial = reconstructStateFromLog(mockPatient);
assertEqual(initial.alert, '?', 'Initial alert is "?"');
assertEqual(initial.breathing, '?', 'Initial breathing is "?"');
assertEqual(initial.pulse, '?', 'Initial pulse is "?"');
assertEqual(initial.cpr.active, false, 'CPR is initially inactive');

// Test Case 2: Status events replay
const statusLog: LogEntry[] = [
  { at: 1010000, type: 'status', text: 'Alert: Altered' },
  { at: 1020000, type: 'status', text: 'Breathing: Yes' },
  { at: 1030000, type: 'status', text: 'Pulse: Yes' },
  { at: 1040000, type: 'status', text: 'Rate: Slow' },
  { at: 1050000, type: 'status', text: 'Rhythm: 3° AVB' },
];
const statusReconstructed = reconstructStateFromLog({ ...mockPatient, log: statusLog });
assertEqual(statusReconstructed.alert, 'Altered', 'Alert is Altered');
assertEqual(statusReconstructed.breathing, 'Yes', 'Breathing is Yes');
assertEqual(statusReconstructed.pulse, 'Yes', 'Pulse is Yes');
assertEqual(statusReconstructed.rate, 'Slow', 'Rate is Slow');
assertEqual(statusReconstructed.rhythm, 'AVB3', 'Rhythm AVB3 mapped correctly from "3° AVB"');

// Test Case 3: CPR starting resets pulse and rhythm to "?"
const cprStartLog: LogEntry[] = [
  ...statusLog,
  { at: 1060000, type: 'cpr', text: 'CPR started — cycle 1' },
];
const cprStartReconstructed = reconstructStateFromLog({ ...mockPatient, log: cprStartLog });
assertEqual(cprStartReconstructed.cpr.active, true, 'CPR is active');
assertEqual(cprStartReconstructed.cpr.cycleNumber, 1, 'CPR cycle is 1');
assertEqual(cprStartReconstructed.pulse, '?', 'CPR start resets pulse to "?"');
assertEqual(cprStartReconstructed.rhythm, '?', 'CPR start resets rhythm to "?"');

// Test Case 4: CPR paused event sets pausedAt and cycle
const cprPauseLog: LogEntry[] = [
  ...cprStartLog,
  { at: 1180000, type: 'cpr', text: 'CPR cycle 1 ended (pause) — 2:00' },
];
const cprPauseReconstructed = reconstructStateFromLog({ ...mockPatient, log: cprPauseLog });
assertEqual(cprPauseReconstructed.cpr.active, true, 'CPR is still active on pause');
assertEqual(cprPauseReconstructed.cpr.pausedAt, 1180000, 'pausedAt is set correctly');

// Test Case 5: CPR resumed starts next cycle
const cprResumeLog: LogEntry[] = [
  ...cprPauseLog,
  { at: 1190000, type: 'cpr', text: 'CPR resumed — cycle 2' },
];
const cprResumeReconstructed = reconstructStateFromLog({ ...mockPatient, log: cprResumeLog });
assertEqual(cprResumeReconstructed.cpr.active, true, 'CPR active');
assertEqual(cprResumeReconstructed.cpr.cycleNumber, 2, 'CPR cycle incremented to 2');
assertEqual(cprResumeReconstructed.cpr.pausedAt, null, 'pausedAt cleared on resume');

// Test Case 6: ROSC stops CPR active state
const roscLog: LogEntry[] = [
  ...cprResumeLog,
  { at: 1250000, type: 'cpr', text: 'ROSC — code ended (CPR cycle 2 stopped — 1:00)' },
];
const roscReconstructed = reconstructStateFromLog({ ...mockPatient, log: roscLog });
assertEqual(roscReconstructed.cpr.active, false, 'CPR is inactive after ROSC');

// Test Case 7: Rolling back events (deleting CPR start event)
// If we delete the 'CPR started' event from `cprStartLog`, the state should go back to before CPR started (rhythm should be AVB3, pulse Yes, etc.)
const deletedCprStartLog = cprStartLog.filter(e => !e.text.includes('CPR started'));
const deletedReconstructed = reconstructStateFromLog({ ...mockPatient, log: deletedCprStartLog });
assertEqual(deletedReconstructed.cpr.active, false, 'CPR inactive when start event removed');
assertEqual(deletedReconstructed.pulse, 'Yes', 'Pulse remains Yes');
assertEqual(deletedReconstructed.rhythm, 'AVB3', 'Rhythm AVB3 is restored');

// Test Case 8: Medication dose counts & timestamps
const medLog: LogEntry[] = [
  { at: 1010000, type: 'med', text: '+1 Epi' },
  { at: 1030000, type: 'med', text: '+1 Epi' },
  { at: 1020000, type: 'med', text: '+1 Amio' }, // Out of order timestamp
];
const medReconstructed = reconstructStateFromLog({
  ...mockPatient,
  gave: [{ key: 'epi', doses: [] }, { key: 'amio', doses: [] }],
  log: medLog,
});
const epiGave = medReconstructed.gave.find(g => g.key === 'epi');
const amioGave = medReconstructed.gave.find(g => g.key === 'amio');

assertEqual(epiGave?.doses.length, 2, 'Two doses of Epi given');
assertEqual(epiGave?.doses, [1010000, 1030000], 'Epi dose timestamps populated and sorted chronologically');
assertEqual(amioGave?.doses.length, 1, 'One dose of Amio given');
assertEqual(amioGave?.doses, [1020000], 'Amio dose timestamp populated');

// Test Case 9: Task auto-hiding
const taskLog: LogEntry[] = [
  { at: 1010000, type: 'task', text: '✓ Obtain IV / IO Access' },
  { at: 1020000, type: 'task', text: 'Airway secured (ETT)' },
];
const taskReconstructed = reconstructStateFromLog({ ...mockPatient, log: taskLog });
assertEqual(taskReconstructed.doneTasks['access'], true, 'Access task marked as done');
assertEqual(taskReconstructed.doneTasks['access__hidden'], true, 'Access task hidden');
assertEqual(taskReconstructed.breathing, 'ETT', 'ETT Breathing set from advanced airway task');
assertEqual(taskReconstructed.alert, 'Sedated', 'Alert Sedated set from ETT Breathing');
assertEqual(taskReconstructed.doneTasks['airway__hidden'], true, 'Airway task hidden');

// Test Case 10: Alert: Yes implicitly sets Pulse to Yes
const alertYesLog: LogEntry[] = [
  { at: 1010000, type: 'status', text: 'Alert: Yes' },
];
const alertYesReconstructed = reconstructStateFromLog({ ...mockPatient, log: alertYesLog });
assertEqual(alertYesReconstructed.alert, 'Yes', 'Alert is Yes');
assertEqual(alertYesReconstructed.pulse, 'Yes', 'Pulse is implicitly Yes when Alert is Yes');

// Test Case 11: Setting an arrest rhythm (VF) implicitly sets Pulse to No
const rhythmVfLog: LogEntry[] = [
  { at: 1010000, type: 'status', text: 'Rhythm: VF' },
];
const rhythmVfReconstructed = reconstructStateFromLog({ ...mockPatient, log: rhythmVfLog });
assertEqual(rhythmVfReconstructed.rhythm, 'VF', 'Rhythm is VF');
assertEqual(rhythmVfReconstructed.pulse, 'No', 'Pulse is implicitly No when Rhythm is VF');

// Test Case 12: Symptomatic status is parsed and preserved only when appropriate
const symptomaticLog: LogEntry[] = [
  { at: 1010000, type: 'status', text: 'Pulse: Yes' },
  { at: 1020000, type: 'status', text: 'Rate: Slow' },
  { at: 1030000, type: 'status', text: 'Symptomatic: Yes' },
];
const symptomaticReconstructed = reconstructStateFromLog({ ...mockPatient, log: symptomaticLog });
assertEqual(symptomaticReconstructed.pulse, 'Yes', 'Pulse is Yes');
assertEqual(symptomaticReconstructed.rate, 'Slow', 'Rate is Slow');
assertEqual(symptomaticReconstructed.symptomatic, 'Yes', 'Symptomatic parsed to Yes');

// Test Case 13: Symptomatic status is reset to "?" if pulse is No or rate is Normal
const symptomaticNormalLog: LogEntry[] = [
  ...symptomaticLog,
  { at: 1040000, type: 'status', text: 'Rate: Normal' },
];
const normalReconstructed = reconstructStateFromLog({ ...mockPatient, log: symptomaticNormalLog });
assertEqual(normalReconstructed.symptomatic, '?', 'Symptomatic reset to "?" when rate becomes Normal');

// Test Case 14: Algorithms only trigger when Symptomatic is Yes
import { crNextTasks } from './data';
const bradyAsymptomaticLog: LogEntry[] = [
  { at: 1010000, type: 'status', text: 'Pulse: Yes' },
  { at: 1020000, type: 'status', text: 'Rate: Slow' },
  { at: 1030000, type: 'status', text: 'Symptomatic: No' },
];
const bradyAsymptomaticState = reconstructStateFromLog({ ...mockPatient, log: bradyAsymptomaticLog });
const bradyAsymptomaticTasks = crNextTasks(bradyAsymptomaticState);
const hasAtropineAsymptomatic = bradyAsymptomaticTasks.some(t => t.id === 'atropine');
assertEqual(hasAtropineAsymptomatic, false, 'Bradycardia algorithm does NOT trigger when asymptomatic');

const bradySymptomaticState = reconstructStateFromLog({ ...mockPatient, log: symptomaticLog });
const bradySymptomaticTasks = crNextTasks(bradySymptomaticState);
const hasAtropineSymptomatic = bradySymptomaticTasks.some(t => t.id === 'atropine');
assertEqual(hasAtropineSymptomatic, true, 'Bradycardia algorithm triggers when symptomatic');

// Test Case 15: Choking pathway when Alert is Yes and Breathing is No
const chokingAlertYesLog: LogEntry[] = [
  { at: 1010000, type: 'status', text: 'Alert: Yes' },
  { at: 1020000, type: 'status', text: 'Breathing: No' },
];
const chokingAlertYesState = reconstructStateFromLog({ ...mockPatient, log: chokingAlertYesLog });
const chokingAlertYesTasks = crNextTasks(chokingAlertYesState);

assertEqual(chokingAlertYesTasks.length, 2, 'Two choking tasks generated when Alert: Yes, Breathing: No');
const chokingCycleTask = chokingAlertYesTasks.find(t => t.id === 'choking-cycles');
const reassessRespTask = chokingAlertYesTasks.find(t => t.id === 'reassess-responsiveness');
assertEqual(chokingCycleTask?.label, '5 back blows then 5 abdominal thrusts', 'Choking cycles task label matches');
assertEqual(chokingCycleTask?.recurring, true, 'Choking cycles task is recurring');
assertEqual(reassessRespTask?.label, 'Reassess Responsiveness', 'Reassess responsiveness task label matches');
assertEqual(reassessRespTask?.recurring, true, 'Reassess responsiveness task is recurring');

// Test Case 16: Epinephrine is recurring during CPR pause
const cprPauseRecurringLog: LogEntry[] = [
  { at: 1010000, type: 'cpr', text: 'CPR started — cycle 1' },
  { at: 1020000, type: 'status', text: 'Rhythm: VF' },
  { at: 1030000, type: 'cpr', text: 'CPR cycle 1 ended (pause) — 2:00' },
];
const cprPauseRecurringState = reconstructStateFromLog({ ...mockPatient, log: cprPauseRecurringLog });
const cprPauseTasks = crNextTasks(cprPauseRecurringState);
const epiPauseTask = cprPauseTasks.find(t => t.id === 'epi');
assertEqual(epiPauseTask?.label, 'Give Epi 1mg (every 3-5 min)', 'Epinephrine task label is descriptive');
assertEqual(epiPauseTask?.recurring, true, 'Epinephrine task is recurring');

// Test Case 17: Switching Alert from Yes to No or Altered resets Pulse to "?"
const alertYesToNoLog: LogEntry[] = [
  { at: 1010000, type: 'status', text: 'Alert: Yes' }, // implicitly sets Pulse to Yes
  { at: 1020000, type: 'status', text: 'Alert: No' },  // transitions Alert from Yes to No -> resets Pulse to "?"
];
const alertYesToNoState = reconstructStateFromLog({ ...mockPatient, log: alertYesToNoLog });
assertEqual(alertYesToNoState.alert, 'No', 'Alert is No');
assertEqual(alertYesToNoState.pulse, '?', 'Pulse reset to "?" on transition to No');

const alertYesToAlteredLog: LogEntry[] = [
  { at: 1010000, type: 'status', text: 'Alert: Yes' }, // implicitly sets Pulse to Yes
  { at: 1020000, type: 'status', text: 'Alert: Altered' }, // transitions Alert from Yes to Altered -> resets Pulse to "?"
];
const alertYesToAlteredState = reconstructStateFromLog({ ...mockPatient, log: alertYesToAlteredLog });
assertEqual(alertYesToAlteredState.alert, 'Altered', 'Alert is Altered');
assertEqual(alertYesToAlteredState.pulse, '?', 'Pulse reset to "?" on transition to Altered');

// Test Case 18: Get AED task persists after CPR starts until checked off
const aedPersistLog: LogEntry[] = [
  { at: 1010000, type: 'status', text: 'Pulse: No' }, // arrest pathway triggered
  { at: 1020000, type: 'cpr', text: 'CPR started — cycle 1' }, // CPR starts
];
const aedPersistState = reconstructStateFromLog({ ...mockPatient, log: aedPersistLog });
const aedPersistTasks = crNextTasks(aedPersistState);
const hasAedTask = aedPersistTasks.some(t => t.id === 'get-aed');
assertEqual(hasAedTask, true, 'AED task persists after CPR starts');

const aedRemovedLog: LogEntry[] = [
  ...aedPersistLog,
  { at: 1030000, type: 'task', text: 'AED requested' }, // AED checked off/completed
];
const aedRemovedState = reconstructStateFromLog({ ...mockPatient, log: aedRemovedLog });
const aedRemovedTasks = crNextTasks(aedRemovedState);
const hasAedTaskRemoved = aedRemovedTasks.some(t => t.id === 'get-aed');
assertEqual(hasAedTaskRemoved, false, 'AED task disappears once AED requested event is logged');

// Test Case 19: Alert Yes sets pulse to Yes, and triggers pause recommendation during active CPR
const cprActiveAlertYesLog: LogEntry[] = [
  { at: 1010000, type: 'cpr', text: 'CPR started — cycle 1' },
  { at: 1020000, type: 'status', text: 'Alert: Yes' }, // implicitly sets pulse to Yes
];
const cprActiveAlertYesState = reconstructStateFromLog({ ...mockPatient, log: cprActiveAlertYesLog });
assertEqual(cprActiveAlertYesState.alert, 'Yes', 'Alert is Yes');
assertEqual(cprActiveAlertYesState.pulse, 'Yes', 'Pulse is implicitly Yes because Alert is Yes');

const cprActiveAlertYesTasks = crNextTasks(cprActiveAlertYesState);
const pauseTask = cprActiveAlertYesTasks.find(t => t.id === 'pause-pulse-check');
assertEqual(pauseTask !== undefined, true, 'Pause CPR recommended when patient is responsive during active CPR');
assertEqual(pauseTask?.label, 'Pause CPR (Patient responsive)', 'Label is "Pause CPR (Patient responsive)"');

const cprActivePulseYesLog: LogEntry[] = [
  { at: 1010000, type: 'cpr', text: 'CPR started — cycle 1' },
  { at: 1020000, type: 'status', text: 'Pulse: Yes' },
];
const cprActivePulseYesState = reconstructStateFromLog({ ...mockPatient, log: cprActivePulseYesLog });
const cprActivePulseYesTasks = crNextTasks(cprActivePulseYesState);
const pausePulseTask = cprActivePulseYesTasks.find(t => t.id === 'pause-pulse-check');
assertEqual(pausePulseTask !== undefined, true, 'Pause CPR recommended when pulse is detected');
assertEqual(pausePulseTask?.label, 'Pause CPR (Pulse detected)', 'Label is "Pause CPR (Pulse detected)"');

// Test Case 20: Removing a medication from logs successfully cleanses it from the view if not staged
const loggedMedPatient: Patient = {
  ...mockPatient,
  gave: [
    { key: 'adenosine', doses: [1020000] }, // was given (not staged)
    { key: 'epi', doses: [] },            // explicitly staged
  ],
  log: [], // log does not contain the '+1 Adenosine' event anymore
};
const cleanedReconstructed = reconstructStateFromLog(loggedMedPatient);
const hasAdenosine = cleanedReconstructed.gave.some(g => g.key === 'adenosine');
const hasEpi = cleanedReconstructed.gave.some(g => g.key === 'epi');
assertEqual(hasAdenosine, false, 'Adenosine row is removed because it has no log entries and was not staged');
assertEqual(hasEpi, true, 'Epi row is preserved because it was explicitly staged (0 doses in original state)');

// Test Case 21: Alert No or Altered implicitly sets Symptomatic to Yes when a symptomatic rate is present
const implicitSymptomaticLog: LogEntry[] = [
  { at: 1010000, type: 'status', text: 'Pulse: Yes' },
  { at: 1020000, type: 'status', text: 'Rate: Slow' },
  { at: 1030000, type: 'status', text: 'Alert: Altered' },
];
const implicitSymptomaticState = reconstructStateFromLog({ ...mockPatient, log: implicitSymptomaticLog });
assertEqual(implicitSymptomaticState.symptomatic, 'Yes', 'Symptomatic is implicitly Yes when Alert is Altered and rate is slow');

const implicitSymptomaticNoLog: LogEntry[] = [
  { at: 1010000, type: 'status', text: 'Pulse: Yes' },
  { at: 1020000, type: 'status', text: 'Rate: Fast' },
  { at: 1030000, type: 'status', text: 'Alert: No' },
];
const implicitSymptomaticNoState = reconstructStateFromLog({ ...mockPatient, log: implicitSymptomaticNoLog });
assertEqual(implicitSymptomaticNoState.symptomatic, 'Yes', 'Symptomatic is implicitly Yes when Alert is No and rate is fast');

// Alert Yes transition removes the implicit symptomatic override
const implicitSymptomaticRemovedLog: LogEntry[] = [
  ...implicitSymptomaticLog,
  { at: 1040000, type: 'status', text: 'Alert: Yes' }, // implicitly sets Pulse to Yes, but Alert: Yes means not implicitly symptomatic
];
const implicitSymptomaticRemovedState = reconstructStateFromLog({ ...mockPatient, log: implicitSymptomaticRemovedLog });
assertEqual(implicitSymptomaticRemovedState.symptomatic, '?', 'Symptomatic resets to "?" when Alert transitions back to Yes');

// Test Case 22: Shock and Start CPR are prioritized at the top of the next tasks list when included
const priorityPatientLog: LogEntry[] = [
  { at: 1010000, type: 'status', text: 'Pulse: No' },
  { at: 1020000, type: 'status', text: 'Rhythm: VF' },
];
const priorityPatientState = reconstructStateFromLog({ ...mockPatient, log: priorityPatientLog });
const priorityTasks = crNextTasks(priorityPatientState);

// The tasks should be generated, and 'shock' and 'start-cpr' should be at index 0 and 1
assertEqual(priorityTasks[0].id, 'shock', 'First task is Shock');
assertEqual(priorityTasks[1].id, 'start-cpr', 'Second task is Start CPR');

// Test Case 23: Shock resets patient rhythm to "?"
const shockRhythmLog: LogEntry[] = [
  { at: 1010000, type: 'status', text: 'Pulse: No' },
  { at: 1020000, type: 'status', text: 'Rhythm: VF' },
  { at: 1030000, type: 'med',    text: '+1 Shock' },
];
const shockRhythmState = reconstructStateFromLog({ ...mockPatient, log: shockRhythmLog });
assertEqual(shockRhythmState.rhythm, '?', 'Shock event resets rhythm to "?"');

console.log('\n\x1b[32m✔ All unit tests passed successfully!\x1b[0m');
