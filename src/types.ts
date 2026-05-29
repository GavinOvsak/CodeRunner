import type React from "react";

export interface CPRState {
  active: boolean;
  cycleNumber: number;
  cycleStartAt: number;
  pausedAt: number | null;
  metronomeAnchor: number;
}

// ─────────────────────────────────────────────────────────────
// Key union types — all internal keys used in state/log/data
// ─────────────────────────────────────────────────────────────

export type ContinuousMedKey = "dopamine" | "norepi" | "vaso" | "procain" | "pace";

export type DiscreteMedKey =
  | "epi" | "amio" | "lido" | "atropine" | "adenosine"
  | "bicarb" | "calcium" | "magnesium" | "naloxone" | "d50"
  | "prbc" | "ffp" | "plt" | "cryo" | "albumin" | "tranex"
  | "shock";

export type MedKey = DiscreteMedKey | ContinuousMedKey;

export type TaskId =
  | "check-alert" | "check-breath" | "check-pulse" | "check-rate"
  | "get-aed" | "shock" | "start-cpr" | "pause-pulse-check" | "pause-to-shock"
  | "resume-cpr" | "rosc" | "pulse-rhythm-check"
  | "epi" | "amio" | "lido" | "reversible" | "airway" | "access"
  | "opioid-reversal" | "rescue-breaths"
  | "ecg" | "adenosine" | "cardiovert"
  | "atropine" | "pace" | "dopamine"
  | "glucose" | "d50" | "check-stroke-sx" | "fast" | "ct"
  | "choking-cycles" | "reassess-responsiveness"
  | "check-rhythm" | "check-symptomatic" | "check-weight" | "check-rescuers";

export type StatusField =
  | "alert" | "breathing" | "pulse" | "rate" | "rhythm"
  | "rescuers" | "glucose" | "strokeSx" | "symptomatic" | "weight";

// ─────────────────────────────────────────────────────────────
// Clinical value types
// ─────────────────────────────────────────────────────────────

export type AlertValue = "?" | "Yes" | "No" | "Altered" | "Sedated";
export type BreathingValue = "?" | "Yes" | "No" | "Choking" | "ETT";
export type PulseValue = "?" | "Yes" | "No";
export type RateValue = "?" | "Fast" | "Normal" | "Slow";
export type SymptomaticValue = "?" | "Yes" | "No";
export type RhythmValue =
  | "?" | "VT" | "VF" | "VF_pVT" | "PEA" | "Asystole"
  | "NSR" | "SVT" | "AF" | "WideTach"
  | "SinusBrady" | "AVB1" | "AVB2" | "AVB3";
export type PatientType = "adult" | "pediatric";
export type RescuersValue = "?" | "One" | "Two" | "Team";
export type GlucoseValue = "?" | "Low" | "Normal" | "High";
export type StrokeSxValue = "?" | "Yes" | "No";

// ─────────────────────────────────────────────────────────────
// Log entry — discriminated union (no free-text parsing needed)
// ─────────────────────────────────────────────────────────────

export type NoteLogEntry = { at: number; type: "note"; text: string };

export type StatusLogEntry = { at: number; type: "status" } & (
  | { field: "alert";       value: AlertValue }
  | { field: "breathing";   value: BreathingValue }
  | { field: "pulse";       value: PulseValue }
  | { field: "rate";        value: RateValue }
  | { field: "rhythm";      value: RhythmValue }
  | { field: "rescuers";    value: RescuersValue }
  | { field: "glucose";     value: GlucoseValue }
  | { field: "strokeSx";    value: StrokeSxValue }
  | { field: "symptomatic"; value: SymptomaticValue }
  | { field: "weight";      value: number }
);

export type MedLogEntry = { at: number; type: "med" } & (
  | { action: "give";  key: DiscreteMedKey }
  | { action: "start"; key: ContinuousMedKey }
  | { action: "stop";  key: ContinuousMedKey }
);

export type TaskLogEntry = {
  at: number;
  type: "task";
  taskId: TaskId;
};

export type CprLogEntry = { at: number; type: "cpr" } & (
  | { event: "start";  cycleNumber: number }
  | { event: "pause";  cycleNumber: number; elapsed: number }
  | { event: "resume"; cycleNumber: number }
  | { event: "sync";   anchor: number }
  | { event: "rosc" }
  | { event: "end" }
);

export type LogEntry =
  | NoteLogEntry
  | StatusLogEntry
  | MedLogEntry
  | TaskLogEntry
  | CprLogEntry;

// Distributive Omit — preserves union members correctly (plain Omit collapses unions)
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
export type LogPayload = DistributiveOmit<LogEntry, "at">;

// ─────────────────────────────────────────────────────────────
// Patient state
// ─────────────────────────────────────────────────────────────

export interface DoseEntry {
  key: MedKey;
  doses: number[];
}

export interface Patient {
  id: string;
  name: string;
  type: PatientType;
  startedAt: number;
  alert: AlertValue;
  breathing: BreathingValue;
  pulse: PulseValue;
  rate: RateValue;
  symptomatic: SymptomaticValue;
  rhythm: RhythmValue;
  rescuers: RescuersValue;
  glucose: GlucoseValue;
  strokeSx: StrokeSxValue;
  weightKg: number | null;
  cpr: CPRState;
  gave: DoseEntry[];
  doneTasks: Record<string, boolean>;
  log: LogEntry[];
}

// ─────────────────────────────────────────────────────────────
// Medication & task types
// ─────────────────────────────────────────────────────────────

export interface Med {
  key: MedKey;
  name: string;
  cat: "Code" | "Drip" | "Blood" | "Action";
  short: string;
}

export type TaskKind = "critical" | "shock" | "med";

export interface NextTask {
  id: TaskId;
  label: string;
  kind?: TaskKind;
  medKey?: MedKey;
  need?: "alert" | "breathing" | "pulse" | "rate" | "rhythm" | "symptomatic" | "rescuers" | "weightKg" | "glucose" | "strokeSx";
  recurring?: boolean;
  popup?: "shock" | "ht" | "strokeSx" | "strokeScale" | "rhythm";
}

export type DropdownOptionObj = {
  value: string;
  label: string;
  icon?: React.ReactNode;
};
export type DropdownOption = string | DropdownOptionObj;
