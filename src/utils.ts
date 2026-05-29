import type { Patient } from "./types";
import type { LogEntry, NoteLogEntry } from "./types";
import {
  CR_MED_BY_KEY,
  CR_CONTINUOUS_KEYS,
  RHYTHM_LABELS,
  STATUS_FIELD_LABELS,
  TASK_LABELS,
} from "./data";

/**
 * # Reconstruct Patient State from Event Log
 *
 * Replays the typed event log in append order to build deterministic current state.
 * No regex parsing — each entry is a typed discriminated union.
 */
export function reconstructStateFromLog(p: Patient): Patient {
  const base: Patient = {
    id: p.id,
    name: p.name,
    type: p.type,
    startedAt: p.startedAt,
    alert: "?",
    breathing: "?",
    pulse: "?",
    rate: "?",
    symptomatic: "?",
    rhythm: "?",
    rescuers: "?",
    glucose: "?",
    strokeSx: "?",
    weightKg: null,
    cpr: {
      active: false,
      cycleNumber: 0,
      cycleStartAt: 0,
      pausedAt: null,
      metronomeAnchor: p.startedAt,
    },
    gave: [],
    doneTasks: {},
    log: p.log,
  };

  // Log is always appended in chronological order — no sort needed
  for (const entry of p.log) {
    switch (entry.type) {
      case "note":
        break;

      case "status":
        switch (entry.field) {
          case "alert": {
            const next = entry.value;
            if ((next === "No" || next === "Altered") && base.alert === "Yes") {
              base.pulse = "?";
            }
            base.alert = next;
            break;
          }
          case "breathing":
            base.breathing = entry.value;
            if (entry.value === "ETT") {
              base.alert = "Sedated";
            }
            break;
          case "pulse":
            base.pulse = entry.value;
            if (entry.value === "Yes") {
              base.rhythm = "?";
            } else {
              base.rate = "?";
              if (entry.value === "No") {
                base.rhythm = "?";
              }
            }
            break;
          case "rate":
            if (entry.value !== base.rate) base.rhythm = "?";
            base.rate = entry.value;
            break;
          case "rhythm": {
            base.rhythm = entry.value;
            if (
              entry.value === "VT" ||
              entry.value === "VF" ||
              entry.value === "VF_pVT" ||
              entry.value === "PEA" ||
              entry.value === "Asystole"
            ) {
              base.pulse = "No";
            }
            break;
          }
          case "rescuers":
            base.rescuers = entry.value;
            break;
          case "glucose":
            base.glucose = entry.value;
            break;
          case "strokeSx":
            base.strokeSx = entry.value;
            break;
          case "symptomatic":
            base.symptomatic = entry.value;
            break;
          case "weight":
            base.weightKg = entry.value;
            break;
        }
        break;

      case "med": {
        const isContinuous = CR_CONTINUOUS_KEYS.has(entry.key);
        const validAction =
          (entry.action === "give" && !isContinuous) ||
          ((entry.action === "start" || entry.action === "stop") && isContinuous);
        if (validAction) {
          let row = base.gave.find((g) => g.key === entry.key);
          if (!row) {
            row = { key: entry.key, doses: [] };
            base.gave.push(row);
          }
          row.doses.push(entry.at);
          if (entry.key === "shock") {
            base.rhythm = "?";
          }
        }
        break;
      }

      case "task":
        if (entry.taskId === "airway") {
          base.breathing = "ETT";
          base.alert = "Sedated";
        }
        base.doneTasks[entry.taskId] = true;
        break;

      case "cpr":
        switch (entry.event) {
          case "start":
            base.cpr = {
              active: true,
              cycleNumber: entry.cycleNumber,
              cycleStartAt: entry.at,
              pausedAt: null,
              metronomeAnchor: entry.at,
            };
            base.pulse = "?";
            base.rhythm = "?";
            break;
          case "resume":
            base.cpr = {
              active: true,
              cycleNumber: entry.cycleNumber,
              cycleStartAt: entry.at,
              pausedAt: null,
              metronomeAnchor: entry.at,
            };
            base.pulse = "?";
            base.rhythm = "?";
            break;
          case "pause":
            base.cpr = {
              ...base.cpr,
              cycleNumber: entry.cycleNumber,
              pausedAt: entry.at,
            };
            break;
          case "sync":
            base.cpr = { ...base.cpr, metronomeAnchor: entry.anchor };
            break;
          case "rosc":
          case "end":
            base.cpr = { ...base.cpr, active: false, pausedAt: null };
            break;
        }
        break;
    }
  }

  // Whenever Alert is Yes, pulse status is Yes
  if (base.alert === "Yes") {
    base.pulse = "Yes";
  }

  // Auto-promote to Yes when patient is obtunded and has an abnormal rate —
  // they cannot self-report symptoms. Never override an explicit logged "No".
  if (base.pulse === "Yes" && (base.rate === "Fast" || base.rate === "Slow")) {
    if (base.alert === "No" || base.alert === "Altered") {
      base.symptomatic = "Yes";
    }
  } else {
    // Rate is normal or pulse absent — symptomatic is not clinically applicable
    base.symptomatic = "?";
  }

  return base;
}

// ─────────────────────────────────────────────────────────────
// Display formatting (used by log screen)
// ─────────────────────────────────────────────────────────────

export function formatLogEntry(entry: LogEntry): string {
  switch (entry.type) {
    case "note":
      return entry.text;

    case "status": {
      if (entry.field === "rhythm") {
        return `Rhythm: ${RHYTHM_LABELS[entry.value]}`;
      }
      if (entry.field === "weight") {
        return `Weight: ${entry.value}kg`;
      }
      return `${STATUS_FIELD_LABELS[entry.field]}: ${entry.value}`;
    }

    case "med": {
      const med = CR_MED_BY_KEY[entry.key];
      const name = med?.short ?? entry.key;
      if (entry.action === "give") return `+1 ${name}`;
      if (entry.action === "start") return `Started ${name}`;
      return `Stopped ${name}`;
    }

    case "task":
      return `✓ ${TASK_LABELS[entry.taskId] ?? entry.taskId}`;

    case "cpr":
      switch (entry.event) {
        case "start":  return `CPR started — cycle ${entry.cycleNumber}`;
        case "pause":  return `CPR cycle ${entry.cycleNumber} ended (pause) — ${crFmt(entry.elapsed)}`;
        case "resume": return `CPR resumed — cycle ${entry.cycleNumber}`;
        case "sync":   return "Metronome synced";
        case "rosc":   return "ROSC — code ended";
        case "end":    return "Code ended";
      }
  }
}

// ─────────────────────────────────────────────────────────────
// Migration: wipe old stringly-typed localStorage data
// ─────────────────────────────────────────────────────────────

export function isLegacyPatientData(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false;
  for (const patient of raw) {
    if (!patient?.log || !Array.isArray(patient.log)) continue;
    for (const entry of patient.log) {
      // Old format has `text` but no `field`/`action`/`taskId`/`event` keys
      if (
        entry &&
        typeof entry.text === "string" &&
        (entry.type === "status" || entry.type === "med" || entry.type === "task" || entry.type === "cpr") &&
        !("field" in entry) &&
        !("action" in entry) &&
        !("taskId" in entry) &&
        !("event" in entry)
      ) {
        return true;
      }
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// Time formatting utilities
// ─────────────────────────────────────────────────────────────

// Format mm:ss from a duration in ms
export function crFmt(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

// Format relative "time since" (e.g. "0:33" or "12m")
export function crSince(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 600) {
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${ss.toString().padStart(2, "0")}`;
  }
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${(m % 60).toString().padStart(2, "0")}`;
}

export function crClock(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// Re-export NoteLogEntry for log screen usage
export type { NoteLogEntry };
