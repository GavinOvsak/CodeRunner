import { useState, useCallback, useEffect } from 'react'
import i18n from '../i18n/config'
import type { Patient, PatientType } from '../types'
import { CRHomeScreen } from './home'
import { CRPatientScreen } from './patient'
import { CRLogScreen } from './log'
import { reconstructStateFromLog, isLegacyPatientData } from '../utils'

// ─────────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cr_patients_v2';
const STORAGE_KEY_V1 = 'cr_patients';

function loadPatients(): Patient[] {
  try {
    // Try current versioned key first
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return (JSON.parse(raw) as Patient[]).map(reconstructStateFromLog);

    // Migrate from v1 if present
    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const parsed = JSON.parse(rawV1);
      if (isLegacyPatientData(parsed)) {
        // Stringly-typed format — unrecoverable, clear it
        localStorage.removeItem(STORAGE_KEY_V1);
        localStorage.removeItem('cr_seeded_cleared_v1');
        return [];
      }
      // Valid discriminated-union format — migrate to versioned key
      localStorage.setItem(STORAGE_KEY, rawV1);
      localStorage.removeItem(STORAGE_KEY_V1);
      return (parsed as Patient[]).map(reconstructStateFromLog);
    }
  } catch { /* ignore parse errors */ }
  return [];
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
export function nowShort(): string {
  const d = new Date();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 || 12;
  return `${month}/${day} ${hour12}:${minutes} ${ampm}`;
}

export function makeBlankPatient(type: PatientType, name?: string): Patient {
  const now = Date.now();
  return {
    id: 'p_' + Math.random().toString(36).slice(2, 9),
    name: name || (type === 'pediatric' ? i18n.t('app.patientChild') + ' ' + nowShort() : i18n.t('app.patientAdult') + ' ' + nowShort()),
    type,
    startedAt: now,
    alert: '?',
    breathing: '?',
    pulse: '?',
    rate: '?',
    symptomatic: '?',
    rhythm: '?',
    rescuers: '?',
    glucose: '?',
    strokeSx: '?',
    sepsisSuspected: '?',
    weightKg: null,
    cpr: { active: false, cycleNumber: 0, cycleStartAt: 0, pausedAt: null, metronomeAnchor: 0 },
    gave: [],
    doneTasks: {},
    log: [{ at: now, type: 'note', text: type === 'pediatric' ? 'Pediatric code initiated' : 'Adult code initiated' }],
  };
}

export function seedPatients(): Patient[] {
  const t = Date.now();
  return [
    reconstructStateFromLog({
      ...makeBlankPatient('adult', 'Bay 4 — VF arrest'),
      startedAt: t - 11 * 60 * 1000,
      log: [
        { at: t - 11*60*1000,   type: 'note',   text: 'Adult code initiated' },
        { at: t - 11*60*1000,   type: 'status', field: 'alert',     value: 'No' },
        { at: t - 10.8*60*1000, type: 'status', field: 'breathing', value: 'No' },
        { at: t - 10.5*60*1000, type: 'status', field: 'pulse',     value: 'No' },
        { at: t - 10.5*60*1000, type: 'cpr',    event: 'start',     cycleNumber: 1 },
        { at: t - 10*60*1000,   type: 'status', field: 'rhythm',    value: 'VF' },
        { at: t - 10*60*1000,   type: 'med',    action: 'give',     key: 'shock' },
        { at: t - 9*60*1000,    type: 'med',    action: 'give',     key: 'epi' },
        { at: t - 8*60*1000,    type: 'task',   taskId: 'access' },
        { at: t - 8.5*60*1000,  type: 'cpr',    event: 'pause',     cycleNumber: 1, elapsed: 120000 },
        { at: t - 8.4*60*1000,  type: 'cpr',    event: 'resume',    cycleNumber: 2 },
        { at: t - 7*60*1000,    type: 'task',   taskId: 'airway' },
        { at: t - 6.4*60*1000,  type: 'cpr',    event: 'pause',     cycleNumber: 2, elapsed: 120000 },
        { at: t - 6.3*60*1000,  type: 'cpr',    event: 'resume',    cycleNumber: 3 },
        { at: t - 6*60*1000,    type: 'med',    action: 'give',     key: 'shock' },
        { at: t - 5.5*60*1000,  type: 'med',    action: 'give',     key: 'epi' },
        { at: t - 4*60*1000,    type: 'med',    action: 'give',     key: 'amio' },
        { at: t - 4.3*60*1000,  type: 'cpr',    event: 'pause',     cycleNumber: 3, elapsed: 120000 },
        { at: t - 4.2*60*1000,  type: 'cpr',    event: 'resume',    cycleNumber: 4 },
        { at: t - 2.5*60*1000,  type: 'med',    action: 'give',     key: 'shock' },
        { at: t - 2*60*1000,    type: 'med',    action: 'give',     key: 'epi' },
        { at: t - 2.2*60*1000,  type: 'cpr',    event: 'pause',     cycleNumber: 4, elapsed: 120000 },
        { at: t - 120*1000,     type: 'cpr',    event: 'resume',    cycleNumber: 5 },
        { at: t - 4*1000,       type: 'cpr',    event: 'pause',     cycleNumber: 5, elapsed: 116000 },
      ],
    }),
    reconstructStateFromLog({
      ...makeBlankPatient('adult', 'Rm 312 — Brady'),
      startedAt: t - 47 * 60 * 1000,
      log: [
        { at: t - 47*60*1000, type: 'note',   text: 'Adult code initiated' },
        { at: t - 46*60*1000, type: 'status', field: 'pulse',  value: 'Yes' },
        { at: t - 46*60*1000, type: 'status', field: 'rate',   value: 'Slow' },
        { at: t - 45*60*1000, type: 'status', field: 'rhythm', value: 'AVB3' },
        { at: t - 42*60*1000, type: 'med',    action: 'give',  key: 'atropine' },
        { at: t - 38*60*1000, type: 'med',    action: 'give',  key: 'atropine' },
        { at: t - 34*60*1000, type: 'med',    action: 'give',  key: 'atropine' },
      ],
    }),
    reconstructStateFromLog({
      ...makeBlankPatient('pediatric', 'ED — 4 y/o choke'),
      startedAt: t - 6.5 * 60 * 60 * 1000,
      log: [
        { at: t - 6.5*60*60*1000, type: 'note', text: 'Pediatric code initiated' },
        { at: t - 6.4*60*60*1000, type: 'task', taskId: 'choking-cycles' },
        { at: t - 6.3*60*60*1000, type: 'task', taskId: 'reassess-responsiveness' },
      ],
    }),
  ];
}

// ─────────────────────────────────────────────────────────────
// CRApp
// ─────────────────────────────────────────────────────────────
export function CRApp() {
  const [patients, setPatients] = useState<Patient[]>(loadPatients);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'patient' | 'log'>('home');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
  }, [patients]);

  const active = patients.find(p => p.id === activeId);

  const updatePatient = useCallback((mut: Patient | ((p: Patient) => Patient)) => {
    setPatients(list => list.map(p => {
      if (p.id === activeId) {
        const next = typeof mut === 'function' ? mut(p) : { ...p, ...mut };
        return reconstructStateFromLog(next);
      }
      return p;
    }));
  }, [activeId]);

  function startNew(type: PatientType) {
    const np = reconstructStateFromLog(makeBlankPatient(type));
    setPatients(list => [np, ...list]);
    setActiveId(np.id);
    setView('patient');
  }
  function openPatient(id: string) {
    setActiveId(id);
    setView('patient');
  }
  function rename(id: string, name: string) {
    setPatients(list => list.map(p => p.id === id ? reconstructStateFromLog({ ...p, name }) : p));
  }
  function del(id: string) {
    setPatients(list => list.filter(p => p.id !== id));
    if (id === activeId) { setActiveId(null); setView('home'); }
  }

  let screen: React.ReactNode;
  if (view === 'home' || !active) {
    screen = (
      <CRHomeScreen
        patients={patients}
        onNew={startNew}
        onOpen={openPatient}
        onRename={rename}
        onDelete={del}
      />
    );
  } else if (view === 'log') {
    screen = <CRLogScreen patient={active} onBack={() => setView('patient')} onUpdate={updatePatient} />;
  } else {
    screen = (
      <CRPatientScreen
        patient={active}
        onChange={updatePatient}
        onBack={() => { setView('home'); setActiveId(null); }}
        onOpenLog={() => setView('log')}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {screen}
    </div>
  );
}
