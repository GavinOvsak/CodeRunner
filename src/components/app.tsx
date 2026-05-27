import { useState, useCallback, useEffect } from 'react'
import type { Patient, PatientType } from '../types'
import { CRHomeScreen } from './home'
import { CRPatientScreen } from './patient'
import { CRLogScreen } from './log'
import { reconstructStateFromLog } from '../utils'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
/**
 * Returns a short date-time string in M/D h:mm am/pm format.
 * e.g. "5/27 2:34 pm"
 */
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
  return {
    id: 'p_' + Math.random().toString(36).slice(2, 9),
    name: name || (type === 'pediatric' ? 'Child ' + nowShort() : 'Adult ' + nowShort()),
    type,
    startedAt: Date.now(),
    alert: '?',
    breathing: '?',
    pulse: '?',
    rate: '?',
    symptomatic: '?',
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
    reconstructStateFromLog({
      ...makeBlankPatient('adult', 'Bay 4 — VF arrest'),
      startedAt: t - 11 * 60 * 1000,
      cpr: { active: true, cycleNumber: 5, cycleStartAt: t - 120 * 1000, pausedAt: t - 4 * 1000, metronomeAnchor: t },
      log: [
        { at: t - 11*60*1000,    type: 'note',   text: 'Adult code initiated' },
        { at: t - 11*60*1000,    type: 'status', text: 'Alert: No' },
        { at: t - 10.8*60*1000,  type: 'status', text: 'Breathing: No' },
        { at: t - 10.5*60*1000,  type: 'status', text: 'Pulse: No' },
        
        // Cycle 1 running
        { at: t - 10.5*60*1000,  type: 'cpr',    text: 'CPR started — cycle 1' },
        { at: t - 10*60*1000,    type: 'status', text: 'Rhythm: VF' },
        { at: t - 10*60*1000,    type: 'med',    text: '+1 Shock' },
        { at: t - 9*60*1000,     type: 'med',    text: '+1 Epi' },
        { at: t - 8*60*1000,     type: 'task',   text: '✓ Obtain IV / IO Access' },
        
        // Cycle 1 pause
        { at: t - 8.5*60*1000,   type: 'cpr',    text: 'CPR cycle 1 ended (pause) — 2:00' },
        
        // Cycle 2 running
        { at: t - 8.4*60*1000,   type: 'cpr',    text: 'CPR resumed — cycle 2' },
        { at: t - 7*60*1000,     type: 'task',   text: '✓ Airway → advanced (ETT)' },
        
        // Cycle 2 pause
        { at: t - 6.4*60*1000,   type: 'cpr',    text: 'CPR cycle 2 ended (pause) — 2:00' },
        
        // Cycle 3 running
        { at: t - 6.3*60*1000,   type: 'cpr',    text: 'CPR resumed — cycle 3' },
        { at: t - 6*60*1000,     type: 'med',    text: '+1 Shock' },
        { at: t - 5.5*60*1000,   type: 'med',    text: '+1 Epi' },
        { at: t - 4*60*1000,     type: 'med',    text: '+1 Amio' },
        
        // Cycle 3 pause
        { at: t - 4.3*60*1000,   type: 'cpr',    text: 'CPR cycle 3 ended (pause) — 2:00' },
        
        // Cycle 4 running
        { at: t - 4.2*60*1000,   type: 'cpr',    text: 'CPR resumed — cycle 4' },
        { at: t - 2.5*60*1000,   type: 'med',    text: '+1 Shock' },
        { at: t - 2*60*1000,     type: 'med',    text: '+1 Epi' },
        
        // Cycle 4 pause
        { at: t - 2.2*60*1000,   type: 'cpr',    text: 'CPR cycle 4 ended (pause) — 2:00' },
        
        // Cycle 5 running
        { at: t - 120*1000,      type: 'cpr',    text: 'CPR resumed — cycle 5' },
        
        // Cycle 5 pause (paused at t - 4*1000, which is 1m 56s into the cycle)
        { at: t - 4*1000,        type: 'cpr',    text: 'CPR cycle 5 ended (pause) — 1:56' },
      ],
    }),
    reconstructStateFromLog({
      ...makeBlankPatient('adult', 'Rm 312 — Brady'),
      startedAt: t - 47 * 60 * 1000,
      log: [
        { at: t - 47*60*1000, type: 'note',   text: 'Adult code initiated' },
        { at: t - 46*60*1000, type: 'status', text: 'Pulse: Yes' },
        { at: t - 46*60*1000, type: 'status', text: 'Rate: Slow' },
        { at: t - 45*60*1000, type: 'status', text: 'Rhythm: 3° AVB' },
        { at: t - 42*60*1000, type: 'med',    text: '+1 Atropine' },
        { at: t - 38*60*1000, type: 'med',    text: '+1 Atropine' },
        { at: t - 34*60*1000, type: 'med',    text: '+1 Atropine' },
      ],
    }),
    reconstructStateFromLog({
      ...makeBlankPatient('pediatric', 'ED — 4 y/o choke'),
      startedAt: t - 6.5 * 60 * 60 * 1000,
      log: [
        { at: t - 6.5*60*60*1000, type: 'note', text: 'Pediatric code initiated' },
        { at: t - 6.4*60*60*1000, type: 'task', text: '✓ 5 Back Blows' },
        { at: t - 6.3*60*60*1000, type: 'task', text: '✓ Reassess Airway' },
      ],
    }),
  ];
}

// ─────────────────────────────────────────────────────────────
// CRApp
// ─────────────────────────────────────────────────────────────
export function CRApp() {
  const [patients, setPatients] = useState<Patient[]>(() => {
    try {
      // One-time cleanup to remove any legacy seed patients from localStorage
      // so the user starts with a clean dashboard by default, preserving custom codes.
      const cleared = localStorage.getItem('cr_seeded_cleared_v1');
      const raw = localStorage.getItem('cr_patients');
      if (raw && !cleared) {
        const parsed = JSON.parse(raw) as Patient[];
        const seedNames = ['Bay 4 — VF arrest', 'Rm 312 — Brady', 'ED — 4 y/o choke'];
        const filtered = parsed.filter(p => !seedNames.includes(p.name));
        localStorage.setItem('cr_patients', JSON.stringify(filtered));
        localStorage.setItem('cr_seeded_cleared_v1', 'true');
        return filtered.map(reconstructStateFromLog);
      }
      if (!cleared) {
        localStorage.setItem('cr_seeded_cleared_v1', 'true');
      }
      if (raw) {
        const parsed = JSON.parse(raw) as Patient[];
        return parsed.map(reconstructStateFromLog);
      }
    } catch { /* ignore */ }
    return [];
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'patient' | 'log'>('home');

  useEffect(() => {
    localStorage.setItem('cr_patients', JSON.stringify(patients));
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
