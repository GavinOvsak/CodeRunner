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

export interface MedDetail {
  adultDose?: string;
  pedsDose?: string;
  sharedDose?: string;
  freq?: string;
  route?: string;
  notes?: string[];
  /** Returns a calculated dose string given patient weight in kg. */
  pedsDoseCalc?: (wt: number) => string;
}

export const CR_MEDS: Med[] = [
  // Code drugs (most-used first)
  { key: "epi", name: "Epinephrine 1mg", cat: "Code", short: "Epi" },
  { key: "amio", name: "Amiodarone", cat: "Code", short: "Amio" },
  { key: "lido", name: "Lidocaine", cat: "Code", short: "Lido" },
  { key: "atropine", name: "Atropine 1mg", cat: "Code", short: "Atropine" },
  { key: "adenosine", name: "Adenosine 6mg", cat: "Code", short: "Adenosine" },
  { key: "bicarb", name: "Sodium Bicarb", cat: "Code", short: "Bicarb" },
  { key: "calcium", name: "Calcium", cat: "Code", short: "Calcium" },
  { key: "magnesium", name: "Magnesium 2g", cat: "Code", short: "Mag" },
  { key: "naloxone", name: "Naloxone", cat: "Code", short: "Naloxone" },
  { key: "dopamine", name: "Dopamine gtt", cat: "Drip", short: "Dopa" },
  { key: "norepi", name: "Norepinephrine", cat: "Drip", short: "Norepi" },
  { key: "vaso", name: "Vasopressin", cat: "Drip", short: "Vaso" },
  { key: "procain", name: "Procainamide", cat: "Drip", short: "Procainamide" },
  { key: "d50", name: "D50", cat: "Code", short: "D50" },
  // Blood products
  { key: "prbc", name: "pRBC", cat: "Blood", short: "pRBC" },
  { key: "ffp", name: "FFP", cat: "Blood", short: "FFP" },
  { key: "plt", name: "Platelets", cat: "Blood", short: "PLT" },
  { key: "cryo", name: "Cryoprecipitate", cat: "Blood", short: "Cryo" },
  { key: "albumin", name: "Albumin", cat: "Blood", short: "Albumin" },
  { key: "tranex", name: "TXA", cat: "Blood", short: "TXA" },
  // Actions
  { key: "shock", name: "Shock", cat: "Action", short: "Shock" },
  {
    key: "pace",
    name: "Transcutaneous Pacing",
    cat: "Action",
    short: "Pacing",
  },
];

/** Keys that run continuously — show play/pause timer instead of +1 count. */
export const CR_CONTINUOUS_KEYS: ReadonlySet<MedKey> =
  new Set<ContinuousMedKey>(["dopamine", "norepi", "vaso", "procain", "pace"]);

export const CR_MED_BY_KEY: Record<MedKey, Med> = Object.fromEntries(
  CR_MEDS.map((m) => [m.key, m]),
) as Record<MedKey, Med>;

export const MED_DETAILS: Partial<Record<MedKey, MedDetail>> = {
  epi: {
    adultDose: "1 mg IV/IO",
    pedsDose: "0.01 mg/kg IV/IO (max 1 mg)",
    freq: "q 3–5 min",
    notes: ["Flush with 20 mL NS after each push"],
    pedsDoseCalc: (wt) => `${Math.min(wt * 0.01, 1).toFixed(2)} mg`,
  },
  amio: {
    adultDose: "300 mg IV/IO (1st), 150 mg (repeat)",
    pedsDose: "5 mg/kg (max 300 mg 1st, 150 mg repeat)",
    route: "IV/IO",
    notes: ["Give after ≥2 shocks in VF/pVT", "Stable VT: 150 mg over 10 min"],
    pedsDoseCalc: (wt) =>
      `1st: ${Math.min(wt * 5, 300).toFixed(0)} mg · repeat: ${Math.min(wt * 5, 150).toFixed(0)} mg`,
  },
  lido: {
    adultDose: "1–1.5 mg/kg IV/IO (1st), 0.5–0.75 mg/kg (repeat)",
    pedsDose: "1 mg/kg (max 100 mg); repeat 0.5 mg/kg",
    route: "IV/IO",
    notes: ["Alternative to amiodarone for VF/pVT after ≥2 shocks"],
    pedsDoseCalc: (wt) =>
      `1st: ${Math.min(wt * 1, 100).toFixed(0)} mg · repeat: ${Math.min(wt * 0.5, 100).toFixed(0)} mg`,
  },
  atropine: {
    adultDose: "1 mg IV q 3–5 min (max 3 mg)",
    pedsDose: "0.02 mg/kg IV/IO (min 0.1 mg, max 0.5 mg child / 1 mg adolescent)",
    route: "IV/IO",
    pedsDoseCalc: (wt) =>
      `${Math.min(Math.max(wt * 0.02, 0.1), 0.5).toFixed(2)} mg`,
  },
  adenosine: {
    adultDose: "6 mg rapid IV push → 12 mg → 12 mg",
    pedsDose: "0.1 mg/kg (max 6 mg) → 0.2 mg/kg (max 12 mg)",
    route: "IV (antecubital or central)",
    notes: ["Flush immediately with 20 mL NS", "Short half-life — push fast"],
    pedsDoseCalc: (wt) =>
      `1st: ${Math.min(wt * 0.1, 6).toFixed(1)} mg · 2nd: ${Math.min(wt * 0.2, 12).toFixed(1)} mg`,
  },
  bicarb: {
    sharedDose: "1 mEq/kg IV; repeat 0.5 mEq/kg q 10 min",
    route: "IV/IO",
    notes: ["Use for tricyclic overdose, severe metabolic acidosis, hyperkalemia"],
    pedsDoseCalc: (wt) => `${wt.toFixed(0)} mEq`,
  },
  calcium: {
    adultDose: "CaCl 1 g (10 mL of 10%) or CaGluconate 3 g (30 mL)",
    pedsDose: "CaCl 20 mg/kg IV (max 1 g) or CaGluconate 60 mg/kg",
    route: "IV (CaCl via central line preferred)",
    notes: ["Indications: hyperkalemia, hypocalcemia, CCB or Mg overdose"],
    pedsDoseCalc: (wt) =>
      `CaCl: ${Math.min(wt * 20, 1000).toFixed(0)} mg · CaGluconate: ${Math.min(wt * 60, 3000).toFixed(0)} mg`,
  },
  magnesium: {
    adultDose: "2 g IV over 15 min (Torsades: over 1–2 min)",
    pedsDose: "25–50 mg/kg IV over 15–30 min (max 2 g)",
    route: "IV/IO",
    notes: ["First-line treatment for Torsades de pointes"],
    pedsDoseCalc: (wt) =>
      `${Math.min(wt * 0.025, 2).toFixed(1)}–${Math.min(wt * 0.05, 2).toFixed(1)} g`,
  },
  naloxone: {
    adultDose: "0.4–2 mg IV/IM/IN; repeat q 2–3 min",
    pedsDose: "0.01 mg/kg IV/IM (max 0.4 mg initial)",
    route: "IV, IM, or IN",
    notes: ["Duration 45–90 min — may need repeat doses", "Can precipitate acute withdrawal"],
    pedsDoseCalc: (wt) => `${Math.min(wt * 0.01, 0.4).toFixed(3)} mg`,
  },
  d50: {
    adultDose: "25 g (50 mL of D50W) IV push",
    pedsDose: "0.5–1 g/kg IV; prefer D25 or D10 in neonates",
    route: "IV",
    notes: ["Confirm hypoglycemia first", "Flush IV line after administration"],
  },
  dopamine: {
    sharedDose: "5–20 mcg/kg/min IV infusion",
    route: "IV infusion",
    notes: [
      "Low (1–5 mcg/kg/min): dopaminergic",
      "Mid (5–10): β₁ inotrope/chronotrope",
      "High (>10): α vasoconstriction",
      "Titrate to MAP ≥65 mmHg",
    ],
  },
  norepi: {
    sharedDose: "0.1–0.5 mcg/kg/min; titrate to MAP ≥65 mmHg",
    route: "IV infusion (central line preferred)",
    notes: ["First-line vasopressor for septic shock"],
  },
  vaso: {
    sharedDose: "0.04 units/min IV (fixed dose, not titrated)",
    route: "IV infusion",
    notes: ["No dose escalation", "Use as adjunct to norepinephrine"],
  },
  procain: {
    adultDose: "20–50 mg/min IV; max 17 mg/kg",
    route: "IV infusion",
    notes: [
      "Stop if: QRS widens >50%, hypotension, or arrhythmia resolves",
      "Do not combine with amiodarone",
    ],
  },
  prbc: {
    sharedDose: "1 unit (~300–350 mL) IV",
    route: "IV",
    notes: [
      "Raises Hgb ≈1 g/dL per unit",
      "Consider for Hgb <7 (or <8 in ACS/cardiac patients)",
    ],
  },
  ffp: {
    sharedDose: "10–15 mL/kg IV",
    route: "IV",
    notes: [
      "Reverses warfarin and clotting factor deficiencies",
      "Use 1:1:1 ratio (pRBC:FFP:PLT) in massive transfusion",
    ],
  },
  plt: {
    sharedDose: "1 apheresis unit (or 4–6 pooled)",
    route: "IV",
    notes: [
      "Raises platelets ≈25–50 k/μL per unit",
      "Transfuse if <50 k/μL with active bleeding; <10 k/μL prophylactic",
    ],
  },
  cryo: {
    sharedDose: "1 unit/5 kg (typically 10 units)",
    route: "IV",
    notes: [
      "Target fibrinogen >150–200 mg/dL",
      "Contains: fibrinogen, FVIII, vWF, FXIII",
    ],
  },
  albumin: {
    sharedDose: "5%: 250–500 mL IV | 25%: 50–100 mL IV",
    route: "IV",
    notes: ["Use for volume expansion, SBP, hepatorenal syndrome"],
  },
  tranex: {
    sharedDose: "1 g IV over 10 min; 2nd dose 1 g over 8 h",
    route: "IV",
    notes: [
      "Give within 3 h of traumatic injury for best effect",
      "Inhibits fibrinolysis (antifibrinolytic)",
    ],
  },
  shock: {
    adultDose: "Biphasic: 120–200 J (mfr. rec.) | Monophasic: 360 J",
    pedsDose: "1st: 2 J/kg · 2nd: 4 J/kg · Subsequent: ≥4 J/kg (max 10 J/kg)",
    notes: [
      "Confirm shockable rhythm before discharge",
      "Clear all personnel — announce before shocking",
      "Resume CPR immediately after shock",
    ],
    pedsDoseCalc: (wt) =>
      `1st: ${(wt * 2).toFixed(0)} J · 2nd: ${(wt * 4).toFixed(0)} J`,
  },
  pace: {
    sharedDose: "Rate 60–80 bpm; start at 0 mA, increase by 10 mA until capture",
    notes: [
      "Capture threshold typically 50–90 mA",
      "Confirm mechanical capture by palpating pulse",
      "Sedation/analgesia strongly recommended",
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// Display label maps (single source of truth for UI text)
// ─────────────────────────────────────────────────────────────

export const RHYTHM_LABELS: Record<RhythmValue, string> = {
  "?": "Unknown",
  VF: "VF",
  VT: "VT",
  VF_pVT: "VF/VT",
  PEA: "PEA",
  Asystole: "Asystole",
  NSR: "NSR",
  SVT: "SVT",
  AF: "AF",
  WideTach: "Wide VT",
  SinusBrady: "Sinus Brady",
  AVB1: "1° AVB",
  AVB2: "2° AVB",
  AVB3: "3° AVB",
};

export const STATUS_FIELD_LABELS: Record<StatusField, string> = {
  alert: "Alert",
  breathing: "Breathing",
  pulse: "Pulse",
  rate: "Rate",
  rhythm: "Rhythm",
  rescuers: "Rescuers",
  glucose: "Glucose",
  strokeSx: "Stroke Sx",
  symptomatic: "Symptomatic",
  weight: "Weight",
};

export const TASK_LABELS: Record<TaskId, string> = {
  "check-alert": "Check Responsiveness",
  "check-breath": "Check Breathing",
  "check-pulse": "Check for Pulse",
  "check-rate": "Check Heart Rate",
  "get-aed": "Get AED / Defibrillator",
  shock: "Shock",
  "start-cpr": "Start CPR",
  "pause-pulse-check": "Pause CPR",
  "pause-to-shock": "Pause CPR to Shock",
  "resume-cpr": "Resume CPR",
  rosc: "ROSC — End Code",
  "pulse-rhythm-check": "Pulse + Rhythm Check",
  epi: "Give Epi",
  amio: "Give Amiodarone",
  lido: "Give Lidocaine",
  reversible: "Consider H's & T's",
  airway: "Airway → advanced (ETT)",
  access: "Obtain IV / IO Access",
  "opioid-reversal": "Consider Opioid Reversal (Naloxone)",
  "rescue-breaths": "Give Rescue Breaths",
  ecg: "12-Lead ECG",
  adenosine: "Adenosine 6mg rapid push",
  cardiovert: "Synchronized Cardioversion",
  atropine: "Atropine 1mg",
  pace: "Transcutaneous Pacing",
  dopamine: "Dopamine gtt",
  glucose: "Check Glucose",
  d50: "Give D50 IV",
  lkw: "Last Known Well",
  "check-stroke-sx": "Check Stroke Symptoms",
  fast: "FAST / NIH Stroke Scale",
  ct: "Activate Stroke / CT",
  "choking-cycles": "5 back blows then 5 abdominal thrusts",
  "reassess-responsiveness": "Reassess Responsiveness",
  "check-rhythm": "Check Rhythm",
  "check-symptomatic": "Assess Symptoms",
  "check-weight": "Enter Patient Weight",
  "check-rescuers": "Confirm Rescuers",
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
  const shockable =
    s.rhythm === "VF" || s.rhythm === "VT" || s.rhythm === "VF_pVT";

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
  if (
    s.pulse === "Yes" &&
    (s.rate === "Fast" || s.rate === "Slow") &&
    s.rhythm === "?"
  )
    push({ id: "check-rhythm", label: "Check Rhythm", need: "rhythm" });
  if (
    s.pulse === "Yes" &&
    (s.rate === "Fast" || s.rate === "Slow") &&
    s.alert !== "No" &&
    s.alert !== "Altered" &&
    s.symptomatic === "?"
  )
    push({
      id: "check-symptomatic",
      label: "Assess Symptoms",
      need: "symptomatic",
    });
  if (s.type === "pediatric" && s.weightKg == null)
    push({
      id: "check-weight",
      label: "Enter Patient Weight",
      need: "weightKg",
    });

  // ===== Cardiac arrest pathway =====
  if (s.pulse === "No" || s.cpr.active) {
    // Always request AED when shockable or unknown — gate Shock behind it
    if (!aedDone) {
      push({
        id: "get-aed",
        label:
          s.rescuers === "One"
            ? "Get AED + Call for Help"
            : s.rescuers === "Two"
              ? "Get AED + Call for Help (Rescuer 1)"
              : "Get AED / Defibrillator",
      });
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
            amioGiven === 0 ? "Give Amiodarone 300mg" : "Give Amiodarone 150mg";
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
      push({
        id: "start-cpr",
        label:
          s.rescuers === "Two" && !aedDone
            ? "Start CPR (Rescuer 2)"
            : "Start CPR",
        kind: "critical",
      });
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
        // Pulse = No, rhythm known — CPR already paused, ready to shock
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
      // Suppress if a shock was delivered before CPR started (just shocked → do CPR first)
      const shockDoses = s.gave.find((g) => g.key === "shock")?.doses ?? [];
      const shockBeforeCpr = shockDoses.some((d) => d < s.cpr.cycleStartAt);
      if (shockable && aedDone && !shockBeforeCpr) {
        push({
          id: "pause-to-shock",
          label: "Pause CPR to Shock",
          kind: "critical",
        });
      }
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
      push({
        id: "check-rescuers",
        label: "Confirm Rescuers",
        need: "rescuers",
      });
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
  const topIds: TaskId[] = [
    "start-cpr",
    "get-aed",
    "shock",
    "cardiovert",
    "pause-to-shock",
    "resume-cpr",
  ];
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
