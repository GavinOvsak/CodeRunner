/**
 * # clinical data and recommendation rules
 *
 * This file defines the standard medical medications (`CR_MEDS`) and contains
 * the rules engine (`crNextTasks`) for determining the next clinical actions
 * based on the patient's current reconstructed state.
 */

import type {
  Med,
  MedKey,
  ContinuousMedKey,
  TaskId,
  StatusField,
  RhythmValue,
  NextTask,
  Patient,
} from "./types";

export const CR_MEDS: Med[] = [
  // Code drugs (most-used first)
  { key: "epi",       name: "Epinephrine 1mg",      cat: "Code",   short: "Epi" },
  { key: "amio",      name: "Amiodarone",             cat: "Code",   short: "Amio" },
  { key: "lido",      name: "Lidocaine",              cat: "Code",   short: "Lido" },
  { key: "atropine",  name: "Atropine 1mg",           cat: "Code",   short: "Atropine" },
  { key: "adenosine", name: "Adenosine 6mg",          cat: "Code",   short: "Adenosine" },
  { key: "bicarb",    name: "Sodium Bicarb",          cat: "Code",   short: "Bicarb" },
  { key: "calcium",   name: "Calcium",                cat: "Code",   short: "Calcium" },
  { key: "magnesium", name: "Magnesium 2g",           cat: "Code",   short: "Mag" },
  { key: "naloxone",  name: "Naloxone",               cat: "Code",   short: "Naloxone" },
  { key: "dopamine",  name: "Dopamine gtt",           cat: "Drip",   short: "Dopa" },
  { key: "norepi",    name: "Norepinephrine",         cat: "Drip",   short: "Norepi" },
  { key: "vaso",      name: "Vasopressin",            cat: "Drip",   short: "Vaso" },
  { key: "procain",   name: "Procainamide",           cat: "Drip",   short: "Procainamide" },
  { key: "d50",       name: "D50",                    cat: "Code",   short: "D50" },
  // Blood products
  { key: "prbc",      name: "pRBC",                   cat: "Blood",  short: "pRBC" },
  { key: "ffp",       name: "FFP",                    cat: "Blood",  short: "FFP" },
  { key: "plt",       name: "Platelets",              cat: "Blood",  short: "PLT" },
  { key: "cryo",      name: "Cryoprecipitate",        cat: "Blood",  short: "Cryo" },
  { key: "albumin",   name: "Albumin",                cat: "Blood",  short: "Albumin" },
  { key: "tranex",    name: "TXA",                    cat: "Blood",  short: "TXA" },
  // Actions
  { key: "shock",     name: "Shock",                  cat: "Action", short: "Shock" },
  { key: "pace",      name: "Transcutaneous Pacing",  cat: "Action", short: "Pacing" },
];

/** Keys that run continuously — show play/pause timer instead of +1 count. */
export const CR_CONTINUOUS_KEYS: ReadonlySet<MedKey> = new Set<ContinuousMedKey>([
  "dopamine",
  "norepi",
  "vaso",
  "procain",
  "pace",
]);

export const CR_MED_BY_KEY: Record<MedKey, Med> = Object.fromEntries(
  CR_MEDS.map((m) => [m.key, m]),
) as Record<MedKey, Med>;

// ─────────────────────────────────────────────────────────────
// Display label maps (single source of truth for UI text)
// ─────────────────────────────────────────────────────────────

export const RHYTHM_LABELS: Record<RhythmValue, string> = {
  "?":         "Unknown",
  "VF":        "VF",
  "VT":        "VT",
  "PEA":       "PEA",
  "Asystole":  "Asystole",
  "NSR":       "NSR",
  "SVT":       "SVT",
  "AF":        "AF",
  "WideTach":  "Wide VT",
  "SinusBrady":"Sinus Brady",
  "AVB1":      "1° AVB",
  "AVB2":      "2° AVB",
  "AVB3":      "3° AVB",
};

export const STATUS_FIELD_LABELS: Record<StatusField, string> = {
  alert:       "Alert",
  breathing:   "Breathing",
  pulse:       "Pulse",
  rate:        "Rate",
  rhythm:      "Rhythm",
  rescuers:    "Rescuers",
  glucose:     "Glucose",
  strokeSx:    "Stroke Sx",
  symptomatic: "Symptomatic",
  weight:      "Weight",
};

export const TASK_LABELS: Record<TaskId, string> = {
  "check-alert":            "Check Responsiveness",
  "check-breath":           "Check Breathing",
  "check-pulse":            "Check for Pulse",
  "check-rate":             "Check Heart Rate",
  "get-aed":                "Get AED / Defibrillator",
  "shock":                  "Shock",
  "start-cpr":              "Start CPR",
  "pause-pulse-check":      "Pause CPR",
  "pause-to-shock":         "Pause CPR to Shock",
  "resume-cpr":             "Resume CPR",
  "rosc":                   "ROSC — End Code",
  "pulse-rhythm-check":     "Pulse + Rhythm Check",
  "epi":                    "Give Epi",
  "amio":                   "Give Amiodarone",
  "reversible":             "Consider H's & T's",
  "airway":                 "Airway → advanced (ETT)",
  "access":                 "Obtain IV / IO Access",
  "opioid-reversal":        "Consider Opioid Reversal (Naloxone)",
  "rescue-breaths":         "Give Rescue Breaths",
  "ecg":                    "12-Lead ECG",
  "adenosine":              "Adenosine 6mg rapid push",
  "cardiovert":             "Synchronized Cardioversion",
  "atropine":               "Atropine 1mg",
  "pace":                   "Transcutaneous Pacing",
  "dopamine":               "Dopamine gtt",
  "glucose":                "Check Glucose",
  "d50":                    "Give D50 IV",
  "lkw":                    "Last Known Well",
  "check-stroke-sx":        "Check Stroke Symptoms",
  "fast":                   "FAST / NIH Stroke Scale",
  "ct":                     "Activate Stroke / CT",
  "choking-cycles":         "5 back blows then 5 abdominal thrusts",
  "reassess-responsiveness":"Reassess Responsiveness",
  "check-rhythm":           "Check Rhythm",
  "check-symptomatic":      "Assess Symptoms",
  "check-weight":           "Enter Patient Weight",
  "check-rescuers":         "Confirm Rescuers",
};

// ─────────────────────────────────────────────────────────────
// Rules engine
// ─────────────────────────────────────────────────────────────

/**
 * # Generate Next Clinical Tasks
 *
 * Evaluates the patient's physiological metrics, CPR cycle progress,
 * and medication counts to compute recommended clinical next actions
 * across pathways (Cardiac Arrest, Tachycardia, Bradycardia, Stroke, Choking).
 *
 * @param s Current patient state
 * @returns Array of active recommendation next tasks
 */
export function crNextTasks(s: Patient): NextTask[] {
  const tasks: NextTask[] = [];
  const push = (t: NextTask) => tasks.push(t);

  const isPeds = s.type === "pediatric";
  const aedDone = s.doneTasks["get-aed__hidden"] === true;
  const roscDone = s.doneTasks["rosc__hidden"] === true;
  const shockable = s.rhythm === "VF" || s.rhythm === "VT";

  // Precompute given counts once for O(1) lookups throughout
  const givenMap = new Map(s.gave.map((g) => [g.key, g.doses.length]));
  const given = (key: MedKey) => givenMap.get(key) ?? 0;

  // ===== Initial assessment (always relevant when unknown) =====
  if (s.alert === "?")
    push({ id: "check-alert", label: "Check Responsiveness", need: "alert" });
  if (s.breathing === "?")
    push({ id: "check-breath", label: "Check Breathing", need: "breathing" });
  if (s.pulse === "?" && !s.cpr.active && s.alert !== "Yes")
    push({ id: "check-pulse", label: "Check for Pulse", need: "pulse" });
  if (s.pulse === "Yes" && s.rate === "?")
    push({ id: "check-rate", label: "Check Heart Rate", need: "rate" });
  if (s.pulse === "Yes" && (s.rate === "Fast" || s.rate === "Slow") && s.rhythm === "?")
    push({ id: "check-rhythm", label: "Check Rhythm", need: "rhythm" });
  if (
    s.pulse === "Yes" &&
    (s.rate === "Fast" || s.rate === "Slow") &&
    s.alert !== "No" &&
    s.alert !== "Altered" &&
    s.symptomatic === "?"
  )
    push({ id: "check-symptomatic", label: "Assess Symptoms", need: "symptomatic" });
  if (s.type === "pediatric" && s.weightKg == null)
    push({ id: "check-weight", label: "Enter Patient Weight", need: "weightKg" });

  // ===== Cardiac arrest pathway =====
  if (s.pulse === "No" || s.cpr.active) {
    // Always request AED when shockable or unknown — gate Shock behind it
    if (!aedDone) {
      push({ id: "get-aed", label: "Get AED / Defibrillator" });
    }

    const pushArrestDrugs = () => {
      const epiDoses = s.gave.find((g) => g.key === "epi")?.doses ?? [];
      const shockCount = given("shock");
      const lastLog = s.log.at(-1);
      const lastLogAt = lastLog ? lastLog.at : Date.now();
      const isRecent = Date.now() - lastLogAt < 5 * 60 * 1000;
      const refTime = isRecent || s.cpr.active ? Date.now() : lastLogAt;
      const epiReady =
        epiDoses.length === 0
          ? !shockable || shockCount >= 1 // shockable: need 1 shock before first epi
          : refTime - epiDoses[epiDoses.length - 1] >= 3 * 60 * 1000;

      if (epiReady && !roscDone) {
        if (isPeds) {
          const dose =
            s.weightKg != null
              ? `${Math.min(s.weightKg * 0.01, 1).toFixed(2)}mg`
              : "0.01mg/kg (max 1mg)";
          push({
            id: "epi",
            label: `Give Epi ${dose} IV/IO (q 3-5 min)`,
            kind: "med",
            medKey: "epi",
          });
        } else {
          push({
            id: "epi",
            label: "Give Epi 1mg IV/IO (q 3-5 min)",
            kind: "med",
            medKey: "epi",
          });
        }
      }

      if (shockable && shockCount >= 2) {
        const amioGiven = given("amio");
        if (isPeds) {
          const maxAmt = amioGiven === 0 ? 300 : 150;
          const dose =
            s.weightKg != null
              ? `${Math.min(s.weightKg * 5, maxAmt).toFixed(0)}mg`
              : `5mg/kg (max ${maxAmt}mg)`;
          push({
            id: "amio",
            label: `Give Amiodarone ${dose} IV/IO`,
            kind: "med",
            medKey: "amio",
          });
        } else {
          const amioLabel =
            amioGiven === 0
              ? "Give Amiodarone 300mg"
              : "Give Amiodarone 150mg";
          push({ id: "amio", label: amioLabel, kind: "med", medKey: "amio" });
        }

        const lidoGiven = given("lido");
        if (isPeds) {
          const maxFirst = 100;
          const doseFirst =
            s.weightKg != null
              ? `${Math.min(s.weightKg * 1, maxFirst).toFixed(1)}mg`
              : `1mg/kg (max ${maxFirst}mg)`;
          const doseRepeat =
            s.weightKg != null
              ? `${Math.min(s.weightKg * 0.5, maxFirst).toFixed(1)}mg`
              : `0.5mg/kg`;
          const lidoLabel =
            lidoGiven === 0
              ? `Give Lidocaine ${doseFirst} IV/IO`
              : `Give Lidocaine ${doseRepeat} IV/IO`;
          push({ id: "lido", label: lidoLabel, kind: "med", medKey: "lido" });
        } else {
          const lidoLabel =
            lidoGiven === 0
              ? "Give Lidocaine 1–1.5 mg/kg"
              : "Give Lidocaine 0.5–0.75 mg/kg";
          push({ id: "lido", label: lidoLabel, kind: "med", medKey: "lido" });
        }
      }
    };

    if (!s.cpr.active) {
      // Pre-CPR: shock immediately if shockable and AED ready
      if (shockable && aedDone) {
        push({ id: "shock", label: "Shock", kind: "shock", popup: "shock" });
      }
      push({ id: "start-cpr", label: "Start CPR", kind: "critical" });
    } else if (s.cpr.pausedAt) {
      // PAUSED between cycles — assess, treat, then resume
      if (s.pulse === "Yes") {
        push({ id: "rosc", label: "ROSC — End Code", kind: "critical" });
      } else if (s.pulse === "?" || s.rhythm === "?") {
        // If rhythm was reset by a shock given in this pause window, skip the
        // rhythm check — ACLS protocol is to resume CPR immediately after shock.
        const lastShockDose = (
          s.gave.find((g) => g.key === "shock")?.doses ?? []
        ).at(-1);
        const shockedThisPause =
          lastShockDose != null && lastShockDose > s.cpr.pausedAt!;
        if (shockedThisPause && s.pulse === "No") {
          push({ id: "resume-cpr", label: "Resume CPR", kind: "critical" });
        } else {
          push({
            id: "pulse-rhythm-check",
            label: "Pulse + Rhythm Check",
            kind: "critical",
          });
        }
      } else {
        // Pulse = No, rhythm known — suggest defib + drugs before resuming
        if (shockable && aedDone) {
          push({ id: "shock", label: "Shock", kind: "shock", popup: "shock" });
        }

        pushArrestDrugs();

        // H's & T's — always shown when pulseless, non-dismissable
        push({
          id: "reversible",
          label: "Consider H's & T's",
          recurring: true,
          popup: "ht",
        });

        if (s.breathing !== "ETT")
          push({ id: "airway", label: "Airway → advanced (ETT)" });
        if (!s.doneTasks["access"])
          push({ id: "access", label: "Obtain IV / IO Access" });

        push({
          id: "resume-cpr",
          label: "Resume CPR",
          kind: "critical",
        });
      }
    } else {
      // RUNNING — compressions in progress; show setup tasks
      if (s.pulse === "Yes") {
        const label =
          s.alert === "Yes"
            ? "Pause CPR (Patient responsive)"
            : "Pause CPR (Pulse detected)";
        push({ id: "pause-pulse-check", label, kind: "critical" });
      }
      if (s.rhythm === "NSR" && s.pulse !== "Yes") {
        push({
          id: "pause-pulse-check",
          label: "Pause for Pulse Check",
          kind: "critical",
        });
      }
      if (shockable && aedDone && given("shock") === 0) {
        push({
          id: "pause-to-shock",
          label: "Pause CPR to Shock",
          kind: "critical",
        });
      }
      if (s.breathing !== "ETT")
        push({ id: "airway", label: "Airway → advanced (ETT)" });
      if (!s.doneTasks["access"])
        push({ id: "access", label: "Obtain IV / IO Access" });
      if (s.pulse === "No" && s.rhythm !== "?") pushArrestDrugs();
      push({
        id: "reversible",
        label: "Consider H's & T's",
        recurring: true,
        popup: "ht",
      });
    }
    if (s.rescuers === "?" && s.breathing !== "ETT" && given("epi") === 0)
      push({ id: "check-rescuers", label: "Confirm Rescuers", need: "rescuers" });
  }

  // ===== Respiratory arrest: not breathing but has (or unknown) pulse =====
  if (s.breathing === "No" && s.pulse !== "No" && !s.cpr.active) {
    push({
      id: "opioid-reversal",
      label: "Consider Opioid Reversal (Naloxone)",
    });
    if (s.pulse === "Yes")
      push({
        id: "rescue-breaths",
        label: "Give Rescue Breaths",
        recurring: true,
      });
  }

  // ===== Tachycardia with a pulse =====
  if (s.pulse === "Yes" && s.rate === "Fast" && s.symptomatic === "Yes") {
    push({ id: "ecg", label: "12-Lead ECG" });
    push({ id: "access", label: "IV Access + Monitor" });
    if (s.rhythm === "SVT")
      push({
        id: "adenosine",
        label: "Adenosine 6mg rapid push",
        kind: "med",
        medKey: "adenosine",
      });
    if (s.rhythm === "WideTach") {
      const amioGiven = given("amio");
      const amioLabel =
        amioGiven === 0
          ? "Amiodarone 150mg over 10 min"
          : "Amiodarone 150mg (repeat)";
      push({ id: "amio", label: amioLabel, kind: "med", medKey: "amio" });
    }
    if (s.rhythm === "AF")
      push({
        id: "cardiovert",
        label: "Synchronized Cardioversion",
        kind: "shock",
        popup: "shock",
      });
  }

  // ===== Bradycardia with a pulse =====
  if (s.pulse === "Yes" && s.rate === "Slow" && s.symptomatic === "Yes") {
    push({ id: "access", label: "IV Access + Monitor" });
    push({
      id: "atropine",
      label: "Atropine 1mg",
      kind: "med",
      medKey: "atropine",
    });
    if (given("pace") === 0)
      push({ id: "pace", label: "Transcutaneous Pacing" });
    if (given("dopamine") === 0)
      push({
        id: "dopamine",
        label: "Dopamine gtt",
        kind: "med",
        medKey: "dopamine",
      });
  }

  // ===== Altered alertness pathway =====
  if (s.alert === "Altered" && s.pulse !== "No") {
    if (s.glucose === "?")
      push({ id: "glucose", label: "Check Glucose", need: "glucose" });
    if (s.glucose === "Low") {
      push({ id: "d50", label: "Give D50 IV", kind: "med", medKey: "d50" });
    }
    if (s.strokeSx === "?")
      push({
        id: "check-stroke-sx",
        label: "Check Stroke Symptoms",
        need: "strokeSx",
        popup: "strokeSx",
      });
    if (s.strokeSx === "Yes") {
      push({
        id: "fast",
        label: "FAST / NIH Stroke Scale",
        popup: "strokeScale",
      });
      push({ id: "ct", label: "Activate Stroke / CT" });
    }
  }

  // ===== Choking pathway =====
  if (s.breathing === "Choking") {
    push({
      id: "choking-cycles",
      label: "5 back blows then 5 abdominal thrusts",
      recurring: true,
    });
    push({
      id: "reassess-responsiveness",
      label: "Reassess Responsiveness",
      recurring: true,
    });
  }

  // Strip already-completed tasks; recurring tasks always show through
  const filtered = tasks.filter(
    (t) => t.recurring || !s.doneTasks[t.id + "__hidden"],
  );

  // Shock and Start CPR always at top
  const topIds: TaskId[] = ["get-aed", "shock", "pause-to-shock", "start-cpr", "resume-cpr", "cardiovert"];
  const topTasks = filtered.filter((t) => topIds.includes(t.id));
  const otherTasks = filtered.filter((t) => !topIds.includes(t.id));
  return [...topTasks, ...otherTasks];
}

// Recommended med keys (so Gave can surface them as "+1" rows even when not yet given)
export function crRecommendedMedKeys(tasks: NextTask[]): Set<MedKey> {
  const keys = new Set<MedKey>();
  tasks.forEach((t) => {
    if (t.medKey) keys.add(t.medKey);
    if (t.kind === "shock") keys.add("shock");
  });
  return keys;
}
