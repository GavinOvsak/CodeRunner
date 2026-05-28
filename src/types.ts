import type React from "react";

export interface CPRState {
  active: boolean;
  cycleNumber: number;
  cycleStartAt: number;
  pausedAt: number | null;
  metronomeAnchor: number;
}

export interface DoseEntry {
  key: string;
  doses: number[];
}

export interface LogEntry {
  at: number;
  type: "note" | "status" | "task" | "med" | "cpr";
  text: string;
}

export type AlertValue = "?" | "Yes" | "No" | "Altered" | "Sedated";
export type BreathingValue = "?" | "Yes" | "No" | "Choking" | "ETT";
export type PulseValue = "?" | "Yes" | "No";
export type RateValue = "?" | "Fast" | "Normal" | "Slow";
export type SymptomaticValue = "?" | "Yes" | "No";
export type RhythmValue =
  | "?"
  | "VT"
  | "VF"
  | "PEA"
  | "Asystole"
  | "NSR"
  | "SVT"
  | "Afib"
  | "Aflutter"
  | "WideTach"
  | "SinusBrady"
  | "AVB1"
  | "AVB2"
  | "AVB3";
export type PatientType = "adult" | "pediatric";
export type RescuersValue = "?" | "One" | "Two" | "Team";
export type GlucoseValue = "?" | "Low" | "Normal" | "High";
export type StrokeSxValue = "?" | "Yes" | "No";

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

export interface Med {
  key: string;
  name: string;
  cat: string;
  short: string;
}

export type TaskKind = "critical" | "shock" | "med";

export interface NextTask {
  id: string;
  label: string;
  kind?: TaskKind;
  medKey?: string;
  need?: "alert" | "breathing" | "pulse" | "rate" | "rhythm" | "glucose" | "strokeSx";
  recurring?: boolean;
  popup?: "shock" | "ht" | "strokeSx" | "strokeScale" | "rhythm";
}

export type DropdownOptionObj = {
  value: string;
  label: string;
  icon?: React.ReactNode;
};
export type DropdownOption = string | DropdownOptionObj;
