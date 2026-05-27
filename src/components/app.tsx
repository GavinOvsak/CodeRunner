import { useState, useCallback, useEffect } from 'react'
import type { Patient, PatientType } from '../types'
import { CRHomeScreen } from './home'
import { CRPatientScreen } from './patient'
import { CRLogScreen } from './log'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
export function nowShort(): string {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function makeBlankPatient(type: PatientType, name?: string): Patient {
  return {
    id: 'p_' + Math.random().toString(36).slice(2, 9),
    name: name || (type === 'pediatric' ? 'Pediatric ' + nowShort() : 'Adult ' + nowShort()),
    type,
    startedAt: Date.now(),
    alert: '?',
    breathing: '?',
    pulse: '?',
    rate: '?',
    rhythm: '?',
    cpr: { active: false, cycleNumber: 0, cycleStartAt: 0, pausedAt: null, metronomeAnchor: 0 },
    gave: [],
    doneTasks: {},
    log: [{ at: Date.now(), type: 'note', text: type === 'pediatric' ? 'Pediatric code initiated' : 'Adult code initiated' }],
  };
}

export function seedPatients(): Patient[] {
  const t = Date.now();
  return [
    {
      ...makeBlankPatient('adult', 'Bay 4 — VF arrest'),
      startedAt: t - 11 * 60 * 1000,
      alert: 'Sedated', breathing: 'ETT', pulse: 'No', rate: '?', rhythm: 'VF',
      cpr: { active: true, cycleNumber: 5, cycleStartAt: t - 120 * 1000, pausedAt: t - 4 * 1000, metronomeAnchor: t },
      gave: [
        { key: 'epi',   doses: [t - 9*60*1000, t - 5.5*60*1000, t - 2*60*1000] },
        { key: 'amio',  doses: [t - 4*60*1000] },
        { key: 'shock', doses: [t - 10*60*1000, t - 6*60*1000, t - 2.5*60*1000] },
      ],
      doneTasks: { 'access': true, 'access__hidden': true, 'airway__hidden': true, 'get-aed__hidden': true },
      log: [
        { at: t - 11*60*1000,    type: 'note',   text: 'Adult code initiated' },
        { at: t - 11*60*1000,    type: 'status', text: 'Alert: No' },
        { at: t - 10.8*60*1000,  type: 'status', text: 'Breathing: No' },
        { at: t - 10.5*60*1000,  type: 'status', text: 'Pulse: No' },
        { at: t - 10.5*60*1000,  type: 'cpr',    text: 'CPR started' },
        { at: t - 10*60*1000,    type: 'status', text: 'Rhythm: VF' },
        { at: t - 10*60*1000,    type: 'med',    text: '+1 Shock' },
        { at: t - 9*60*1000,     type: 'med',    text: '+1 Epi' },
        { at: t - 8*60*1000,     type: 'task',   text: '✓ Obtain IV / IO Access' },
        { at: t - 7*60*1000,     type: 'task',   text: '✓ Airway → advanced (ETT)' },
        { at: t - 6*60*1000,     type: 'med',    text: '+1 Shock' },
        { at: t - 5.5*60*1000,   type: 'med',    text: '+1 Epi' },
        { at: t - 4*60*1000,     type: 'med',    text: '+1 Amio' },
        { at: t - 2.5*60*1000,   type: 'med',    text: '+1 Shock' },
        { at: t - 2*60*1000,     type: 'med',    text: '+1 Epi' },
      ],
    },
    {
      ...makeBlankPatient('adult', 'Rm 312 — Brady'),
      startedAt: t - 47 * 60 * 1000,
      alert: 'Altered', breathing: 'Yes', pulse: 'Yes', rate: 'Slow', rhythm: 'AVB3',
      cpr: { active: false, cycleNumber: 0, cycleStartAt: 0, pausedAt: null, metronomeAnchor: 0 },
      gave: [{ key: 'atropine', doses: [t - 42*60*1000, t - 38*60*1000, t - 34*60*1000] }],
      log: [
        { at: t - 47*60*1000, type: 'note',   text: 'Adult code initiated' },
        { at: t - 46*60*1000, type: 'status', text: 'Pulse: Yes' },
        { at: t - 46*60*1000, type: 'status', text: 'Rate: Slow' },
        { at: t - 45*60*1000, type: 'status', text: 'Rhythm: 3° AVB' },
        { at: t - 42*60*1000, type: 'med',    text: '+1 Atropine' },
        { at: t - 38*60*1000, type: 'med',    text: '+1 Atropine' },
        { at: t - 34*60*1000, type: 'med',    text: '+1 Atropine' },
      ],
    },
    {
      ...makeBlankPatient('pediatric', 'ED — 4 y/o choke'),
      startedAt: t - 6.5 * 60 * 60 * 1000,
      alert: 'Yes', breathing: 'Yes', pulse: 'Yes', rate: 'Normal',
      log: [
        { at: t - 6.5*60*60*1000, type: 'note', text: 'Pediatric code initiated' },
        { at: t - 6.4*60*60*1000, type: 'task', text: '✓ 5 Back Blows' },
        { at: t - 6.3*60*60*1000, type: 'task', text: '✓ Reassess Airway' },
      ],
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// CRApp
// ─────────────────────────────────────────────────────────────
export function CRApp() {
  const [patients, setPatients] = useState<Patient[]>(() => {
    try {
      const raw = localStorage.getItem('cr_patients');
      if (raw) return JSON.parse(raw) as Patient[];
    } catch { /* ignore */ }
    return seedPatients();
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'patient' | 'log'>('home');

  useEffect(() => {
    localStorage.setItem('cr_patients', JSON.stringify(patients));
  }, [patients]);

  const active = patients.find(p => p.id === activeId);

  const updatePatient = useCallback((mut: Patient | ((p: Patient) => Patient)) => {
    setPatients(list => list.map(p => p.id === activeId
      ? (typeof mut === 'function' ? mut(p) : { ...p, ...mut })
      : p));
  }, [activeId]);

  function startNew(type: PatientType) {
    const np = makeBlankPatient(type);
    setPatients(list => [np, ...list]);
    setActiveId(np.id);
    setView('patient');
  }
  function openPatient(id: string) {
    setActiveId(id);
    setView('patient');
  }
  function rename(id: string, name: string) {
    setPatients(list => list.map(p => p.id === id ? { ...p, name } : p));
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
