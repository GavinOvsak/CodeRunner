import type {
  Patient,
  AlertValue,
  BreathingValue,
  PulseValue,
  RateValue,
  SymptomaticValue,
  RhythmValue,
  RescuersValue,
  GlucoseValue,
  StrokeSxValue,
} from "./types";
import { CR_MEDS, CR_CONTINUOUS_KEYS } from "./data";

/**
 * # Reconstruct Patient State from Event Log
 *
 * This function is the single source of truth for computing a patient's
 * physiological and CPR status from their log of events. It processes
 * the log in chronological order to build a deterministic current state.
 *
 * ## State Transformations
 * - **Status Changes**: Sets alert, breathing, pulse, rate, rhythm, applying safety overrides
 * - **CPR Cycles**: Resets pulse/rhythm on CPR start/resume, marks pauses, and updates cycle counts
 * - **Medications**: Accumulates given doses by timestamp
 * - **Tasks**: Tracks task completions and determines what should be hidden
 *
 * @param p The patient object containing the event log to replay
 * @returns A new Patient object with a fully computed up-to-date state
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
    gave: p.gave
      .filter((g) => g.doses.length === 0)
      .map((g) => ({ key: g.key, doses: [] })),
    doneTasks: {},
    log: p.log,
  };

  // Sort log entries ascending by timestamp to play back in chronological order
  const sortedLog = [...p.log].sort((a, b) => a.at - b.at);

  for (const entry of sortedLog) {
    const text = entry.text;
    const type = entry.type;

    if (type === "status") {
      const alertMatch = /^Alert:\s*(Yes|No|Altered|Sedated)/i.exec(text);
      if (alertMatch) {
        const nextAlert = alertMatch[1] as AlertValue;
        if (
          (nextAlert === "No" || nextAlert === "Altered") &&
          base.alert === "Yes"
        ) {
          base.pulse = "?";
        }
        base.alert = nextAlert;
      }

      const symptomaticMatch = /^Symptomatic:\s*(Yes|No)/i.exec(text);
      if (symptomaticMatch) {
        base.symptomatic = symptomaticMatch[1] as SymptomaticValue;
      }

      const breathingMatch = /^Breathing:\s*(Yes|No|ETT|Choking)/i.exec(text);
      if (breathingMatch) {
        base.breathing = breathingMatch[1] as BreathingValue;
        if (base.breathing === "ETT") {
          base.alert = "Sedated";
        }
      }

      const rescuersMatch = /^Rescuers:\s*(One|Two|Team)/i.exec(text);
      if (rescuersMatch) base.rescuers = rescuersMatch[1] as RescuersValue;

      const glucoseMatch = /^Glucose:\s*(Low|Normal|High)/i.exec(text);
      if (glucoseMatch) base.glucose = glucoseMatch[1] as GlucoseValue;

      const strokeSxMatch = /^Stroke Sx:\s*(Yes|No)/i.exec(text);
      if (strokeSxMatch) base.strokeSx = strokeSxMatch[1] as StrokeSxValue;

      const weightMatch = /^Weight:\s*(\d+(?:\.\d+)?)\s*kg/i.exec(text);
      if (weightMatch) base.weightKg = parseFloat(weightMatch[1]);

      const pulseMatch = /^Pulse:\s*(Yes|No)/i.exec(text);
      if (pulseMatch) {
        base.pulse = pulseMatch[1] as PulseValue;
        if (base.pulse === "Yes") {
          base.rhythm = "?";
        } else {
          base.rate = "?";
        }
      }

      const rateMatch = /^Rate:\s*(Fast|Normal|Slow|\?)/i.exec(text);
      if (rateMatch) {
        base.rate = rateMatch[1] as RateValue;
        base.rhythm = "?";
      }

      const rhythmMatch = /^Rhythm:\s*(.*)/i.exec(text);
      if (rhythmMatch) {
        const rStr = rhythmMatch[1].trim();
        let rhythmVal: RhythmValue = "?";
        if (rStr === "3° AVB" || rStr === "AVB3") rhythmVal = "AVB3";
        else if (rStr === "2° AVB" || rStr === "AVB2") rhythmVal = "AVB2";
        else if (rStr === "1° AVB" || rStr === "AVB1") rhythmVal = "AVB1";
        else if (rStr === "Sinus Brady" || rStr === "SinusBrady")
          rhythmVal = "SinusBrady";
        else if (rStr === "Wide VT" || rStr === "WideTach")
          rhythmVal = "WideTach";
        else if (rStr === "A-Flutter" || rStr === "Aflutter")
          rhythmVal = "Aflutter";
        else if (rStr === "A-Fib" || rStr === "Afib") rhythmVal = "Afib";
        else if (
          ["VT", "VF", "PEA", "Asystole", "NSR", "SVT", "?"].includes(rStr)
        )
          rhythmVal = rStr as RhythmValue;

        base.rhythm = rhythmVal;
        if (["VT", "VF", "PEA", "Asystole"].includes(rhythmVal)) {
          base.pulse = "No";
        }
      }
    } else if (type === "cpr") {
      if (text.startsWith("CPR started")) {
        base.cpr = {
          active: true,
          cycleNumber: 1,
          cycleStartAt: entry.at,
          pausedAt: null,
          metronomeAnchor: entry.at,
        };
        base.pulse = "?";
        base.rhythm = "?";
      } else if (text.startsWith("CPR resumed")) {
        const cycleMatch = /cycle\s+(\d+)/i.exec(text);
        const cycleNum = cycleMatch
          ? parseInt(cycleMatch[1], 10)
          : base.cpr.cycleNumber + 1;
        base.cpr = {
          active: true,
          cycleNumber: cycleNum,
          cycleStartAt: entry.at,
          pausedAt: null,
          metronomeAnchor: entry.at,
        };
        base.pulse = "?";
        base.rhythm = "?";
      } else if (text.includes("ended (pause)") || text.includes("paused")) {
        const cycleMatch = /cycle\s+(\d+)/i.exec(text);
        const cycleNum = cycleMatch
          ? parseInt(cycleMatch[1], 10)
          : base.cpr.cycleNumber;
        base.cpr = {
          ...base.cpr,
          cycleNumber: cycleNum,
          pausedAt: entry.at,
        };
      } else if (text.includes("ROSC") || text.includes("code ended")) {
        base.cpr = {
          ...base.cpr,
          active: false,
          pausedAt: null,
        };
      }
    } else if (type === "med") {
      const isStartStop =
        text.startsWith("Started ") || text.startsWith("Stopped ");
      const isPlusDose = text.startsWith("+1 ");
      if (isPlusDose || isStartStop) {
        const medName = isPlusDose
          ? text.slice(3).trim()
          : text.slice(text.indexOf(" ") + 1).trim();
        const med = CR_MEDS.find(
          (m) =>
            m.short.toLowerCase() === medName.toLowerCase() ||
            m.name.toLowerCase() === medName.toLowerCase() ||
            m.key.toLowerCase() === medName.toLowerCase(),
        );
        if (med) {
          // Validate: continuous meds only accept started/stopped, discrete meds only accept +1
          const isContinuous = CR_CONTINUOUS_KEYS.has(med.key);
          if ((isContinuous && isStartStop) || (!isContinuous && isPlusDose)) {
            let doseRow = base.gave.find((g) => g.key === med.key);
            if (!doseRow) {
              doseRow = { key: med.key, doses: [] };
              base.gave.push(doseRow);
            }
            doseRow.doses.push(entry.at);
            if (med.key === "shock") {
              base.rhythm = "?";
            }
          }
        }
      }
    } else if (type === "task") {
      if (
        text === "Airway secured (ETT)" ||
        text === "✓ Airway → advanced (ETT)"
      ) {
        base.breathing = "ETT";
        base.alert = "Sedated";
        base.doneTasks["airway__hidden"] = true;
      } else if (
        text === "IV/IO access obtained" ||
        text === "✓ Obtain IV / IO Access"
      ) {
        base.doneTasks["access"] = true;
        base.doneTasks["access__hidden"] = true;
      } else if (
        text === "AED requested" ||
        text === "✓ Get AED / Defibrillator"
      ) {
        base.doneTasks["get-aed__hidden"] = true;
      } else if (text.startsWith("✓ ")) {
        const label = text.slice(2).trim();
        const labelMap: Record<string, string> = {
          "Obtain IV / IO Access": "access",
          "Airway → advanced (ETT)": "airway",
          "Get AED / Defibrillator": "get-aed",
          "5 Back Blows": "backblows",
          "5 Abdominal Thrusts": "thrusts",
          "Reassess Airway": "reassess",
          "Check Responsiveness": "check-alert",
          "Check Breathing": "check-breath",
          "Check for Pulse": "check-pulse",
          "Pulse + Rhythm Check": "pulse-rhythm-check",
          "Pause for Pulse Check": "pause-pulse-check",
          "ROSC — End Code": "rosc",
          "Resume CPR": "resume-cpr",
          "Start CPR": "start-cpr",
          "Give Epi 1mg": "epi",
          "Give Amiodarone 300mg": "amio",
          "Give Amiodarone 150mg": "amio",
          "Consider H’s & T’s": "reversible",
          "12-Lead ECG": "ecg",
          "IV Access + Monitor": "access",
          "Adenosine 6mg rapid push": "adenosine",
          "Amiodarone 150mg over 10 min": "amio",
          "Amiodarone 150mg (repeat)": "amio",
          "Synchronized Cardioversion": "cardiovert",
          "Atropine 1mg": "atropine",
          "Transcutaneous Pacing": "pace",
          "Dopamine gtt": "dopamine",
          "Check Glucose": "glucose",
          "Last Known Well": "lkw",
          "FAST / NIH Stroke Scale": "fast",
          "Activate Stroke / CT": "ct",
        };
        const taskId = labelMap[label];
        if (taskId) {
          if (taskId === "access") {
            base.doneTasks["access"] = true;
          }
          base.doneTasks[taskId + "__hidden"] = true;
        }
      }
    }
  }

  // Whenever Alert is Yes, pulse status is Yes
  if (base.alert === "Yes") {
    base.pulse = "Yes";
  }

  // Reset/override symptomatic based on rate, pulse, and alert status
  if (base.pulse === "Yes" && (base.rate === "Fast" || base.rate === "Slow")) {
    if (base.alert === "No" || base.alert === "Altered") {
      base.symptomatic = "Yes";
    }
  } else {
    base.symptomatic = "?";
  }

  // Preserve user custom metronome anchor if it was synced and is newer than the cycle start
  if (p.cpr && p.cpr.metronomeAnchor > base.cpr.cycleStartAt) {
    base.cpr.metronomeAnchor = p.cpr.metronomeAnchor;
  }

  return base;
}

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
