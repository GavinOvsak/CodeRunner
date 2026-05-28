import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Patient, CPRState, NextTask } from "../types";
import {
  CR_MEDS,
  CR_MED_BY_KEY,
  CR_CONTINUOUS_KEYS,
  crNextTasks,
  crRecommendedMedKeys,
  crGiven,
} from "../data";
import { crFmt, crSince } from "../utils";
import { CRIcon, CRDropdown, CRSection, CRStatusRow } from "./ui";

// ─────────────────────────────────────────────────────────────
// Status dropdown option sets
// ─────────────────────────────────────────────────────────────
const CR_OPTS_YN = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];
const CR_OPTS_ALERT = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
  { value: "Altered", label: "Altered" },
  { value: "Sedated", label: "Sedated" },
];
const CR_OPTS_BREATH = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
  { value: "Choking", label: "Choking" },
  { value: "ETT", label: "ETT" },
];
const CR_OPTS_RESCUERS = [
  { value: "One", label: "One" },
  { value: "Two", label: "Two" },
  { value: "Team", label: "Code Team" },
];
const CR_OPTS_GLUCOSE = [
  { value: "Low", label: "Low" },
  { value: "Normal", label: "Normal" },
  { value: "High", label: "High" },
];
const CR_OPTS_STROKESX = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];
const CR_OPTS_RATE = [
  { value: "Fast", label: "Fast" },
  { value: "Normal", label: "Normal" },
  { value: "Slow", label: "Slow" },
];
const boltIcon = <CRIcon name="bolt" size={14} color="var(--shock)" />;
const CR_OPTS_RHYTHM_ARREST = [
  { value: "VT", label: "VT", icon: boltIcon },
  { value: "VF", label: "VF", icon: boltIcon },
  { value: "PEA", label: "PEA" },
  { value: "Asystole", label: "Asystole" },
  { value: "NSR", label: "NSR" },
];
const CR_OPTS_RHYTHM_TACH = [
  { value: "SVT", label: "SVT" },
  { value: "Afib", label: "A-Fib" },
  { value: "Aflutter", label: "A-Flutter" },
  { value: "WideTach", label: "Wide VT" },
];
const CR_OPTS_RHYTHM_BRADY = [
  { value: "SinusBrady", label: "Sinus Brady" },
  { value: "AVB1", label: "1° AVB" },
  { value: "AVB2", label: "2° AVB" },
  { value: "AVB3", label: "3° AVB" },
];
const CR_OPTS_RHYTHM_NORMAL = [
  { value: "NSR", label: "NSR" },
  { value: "Afib", label: "A-Fib" },
  { value: "Aflutter", label: "A-Flutter" },
];

// ─────────────────────────────────────────────────────────────
// Prop interfaces
// ─────────────────────────────────────────────────────────────
interface CRPatientScreenProps {
  patient: Patient;
  onChange: (mut: Patient | ((p: Patient) => Patient)) => void;
  onBack: () => void;
  onOpenLog: () => void;
}

interface CRPatientHeaderProps {
  patient: Patient;
  onBack: () => void;
  onOpenLog: () => void;
  onInfo: () => void;
}

interface CRCprPillProps {
  cpr: CPRState;
  elapsed: number;
  onPause: () => void;
  onSync: () => void;
  guidance: string;
}

interface CRNextListProps {
  tasks: NextTask[];
  fading: Record<string, boolean>;
  onCheck: (t: NextTask) => void;
  patient: Patient;
}

interface CRGaveListProps {
  state: Patient;
  recKeys: Set<string>;
  onGive: (key: string) => void;
  /** Called whenever the layout mode switches between list rows and pill grid. */
  onLayoutChange?: (isPills: boolean) => void;
  lastAction?: { key: string; time: number } | null;
  currentTime?: number;
}

interface CRGaveSearchProps {
  onPick: (key: string) => void;
}

// ─────────────────────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────────────────────
function crIconBtn(): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--ink-2)",
  };
}

function crCprBtn(invertOnDark: boolean): React.CSSProperties {
  return {
    height: 30,
    minWidth: 30,
    padding: 0,
    borderRadius: 8,
    background: invertOnDark
      ? "rgba(255,255,255,0.18)"
      : "rgba(255,255,255,0.7)",
    border: invertOnDark
      ? "1px solid rgba(255,255,255,0.3)"
      : "1px solid var(--line-strong)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: invertOnDark ? "white" : "var(--ink)",
  };
}

// ─────────────────────────────────────────────────────────────
// CRPatientScreen
// ─────────────────────────────────────────────────────────────
export function CRPatientScreen({
  patient,
  onChange,
  onBack,
  onOpenLog,
}: CRPatientScreenProps) {
  const s = patient;
  const dispatch = onChange;
  const [infoOpen, setInfoOpen] = useState(false);
  const [popup, setPopup] = useState<
    "shock" | "ht" | "strokeSx" | "strokeScale" | "rhythm" | null
  >(null);
  const [fadingTasks, setFadingTasks] = useState<Record<string, boolean>>({});
  const [flashKey, setFlashKey] = useState(0);
  const [flashTargets, setFlashTargets] = useState<Set<string>>(new Set());
  const [weightInput, setWeightInput] = useState(s.weightKg?.toString() ?? "");
  /** True when the Gave section is wide enough to render chips instead of list rows. */
  const [isPillGave, setIsPillGave] = useState(false);
  const [lastAction, setLastAction] = useState<{
    key: string;
    time: number;
  } | null>(null);

  const update = useCallback(
    (mut: Patient | ((p: Patient) => Patient)) => {
      dispatch((prev) => {
        const next =
          typeof mut === "function" ? mut(prev) : { ...prev, ...mut };
        return next;
      });
    },
    [dispatch],
  );

  const log = useCallback(
    (
      text: string,
      type: "note" | "status" | "task" | "med" | "cpr" = "note",
    ) => {
      update((p) => ({
        ...p,
        log: [...p.log, { at: Date.now(), type, text }],
      }));
    },
    [update],
  );

  // tick (1Hz) to drive timers
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  // derived
  const lastLog =
    s.log.length > 0 ? [...s.log].sort((a, b) => b.at - a.at)[0] : null;
  const lastLogAt = lastLog ? lastLog.at : Date.now();
  const isRecent = Date.now() - lastLogAt < 5 * 60 * 1000;
  const currentTime = isRecent || s.cpr.active ? Date.now() : lastLogAt;

  const cpr = s.cpr;
  const cycleElapsed =
    cpr.active && !cpr.pausedAt
      ? currentTime - cpr.cycleStartAt
      : cpr.pausedAt
        ? cpr.pausedAt - cpr.cycleStartAt
        : 0;

  const recKeys = crRecommendedMedKeys(s);

  // Status field setters
  function setAlert(v: string) {
    if (v === s.alert) return;
    const now = Date.now();
    update((p) => {
      const next = { ...p, alert: v as Patient["alert"] };
      if ((v === "No" || v === "Altered") && s.alert === "Yes") {
        next.pulse = "?";
      }
      if (v === "Yes") {
        next.pulse = "Yes";
        // If CPR is active and running, automatically pause it
        if (p.cpr.active && !p.cpr.pausedAt) {
          next.cpr = { ...p.cpr, pausedAt: now };
        }
      }
      return next;
    });
    log(`Alert: ${v}`, "status");
    if ((v === "No" || v === "Altered") && s.alert === "Yes") {
      setTimeout(() => log("Pulse: ?", "status"), 0);
    }
    if (v === "Yes" && s.pulse !== "Yes") {
      setTimeout(() => log("Pulse: Yes", "status"), 0);
    }
    if (v === "Yes" && cpr.active && !cpr.pausedAt) {
      const elapsed = now - cpr.cycleStartAt;
      const text = `CPR cycle ${cpr.cycleNumber} ended (pause) — ${crFmt(elapsed)}`;
      setTimeout(() => log(text, "cpr"), 0);
    }
  }
  function setBreathing(v: string) {
    if (v === s.breathing) return;
    update((p) => {
      const next = { ...p, breathing: v as Patient["breathing"] };
      if (v === "ETT" && p.alert !== "Sedated") next.alert = "Sedated";
      return next;
    });
    log(`Breathing: ${v}`, "status");
    if (v === "ETT" && s.alert !== "Sedated") {
      setTimeout(() => log("Alert: Sedated (auto, ETT)", "status"), 0);
    }
  }
  function setPulse(v: string) {
    if (v === s.pulse) return;
    update((p) => {
      const next = { ...p, pulse: v as Patient["pulse"] };
      if (v === "Yes") {
        next.rhythm = "?";
      }
      if (v !== "Yes") {
        next.rate = "?";
      }
      return next;
    });
    log(`Pulse: ${v}`, "status");
  }
  function setRate(v: string) {
    if (v === s.rate) return;
    update((p) => ({ ...p, rate: v as Patient["rate"], rhythm: "?" }));
    log(`Rate: ${v}`, "status");
  }
  function setSymptomatic(v: string) {
    if (v === s.symptomatic) return;
    update((p) => ({ ...p, symptomatic: v as Patient["symptomatic"] }));
    log(`Symptomatic: ${v}`, "status");
  }
  function setRescuers(v: string) {
    if (v === s.rescuers) return;
    update((p) => ({ ...p, rescuers: v as Patient["rescuers"] }));
    log(`Rescuers: ${v}`, "status");
  }
  function setGlucose(v: string) {
    if (v === s.glucose) return;
    update((p) => ({ ...p, glucose: v as Patient["glucose"] }));
    log(`Glucose: ${v}`, "status");
  }
  function setStrokeSx(v: string) {
    if (v === s.strokeSx) return;
    update((p) => ({ ...p, strokeSx: v as Patient["strokeSx"] }));
    log(`Stroke Sx: ${v}`, "status");
  }
  function setWeightKg(raw: string) {
    const v = raw === "" ? null : parseFloat(raw);
    const val = v == null || isNaN(v) ? null : v;
    if (val === s.weightKg) return;
    update((p) => ({ ...p, weightKg: val }));
    if (val != null) log(`Weight: ${val}kg`, "status");
  }
  function setRhythm(v: string) {
    if (v === s.rhythm) return;
    update((p) => {
      const next = { ...p, rhythm: v as Patient["rhythm"] };
      if (["VT", "VF", "PEA", "Asystole"].includes(v)) {
        next.pulse = "No";
      }
      return next;
    });
    log(`Rhythm: ${v}`, "status");
    if (["VT", "VF", "PEA", "Asystole"].includes(v) && s.pulse !== "No") {
      setTimeout(() => log("Pulse: No", "status"), 0);
    }
  }

  // Task interactions
  function flashField(...fields: string[]) {
    setFlashTargets(new Set(fields));
    setFlashKey((k) => k + 1);
    setTimeout(() => setFlashTargets(new Set()), 1400);
  }

  function checkTask(t: NextTask) {
    if (t.need === "alert" && s.alert === "?") {
      flashField("alert");
      return;
    }
    if (t.need === "breathing" && s.breathing === "?") {
      flashField("breathing");
      return;
    }
    if (t.need === "pulse" && s.pulse === "?") {
      flashField("pulse");
      return;
    }
    if (t.need === "rate" && s.rate === "?") {
      flashField("rate");
      return;
    }
    if (t.need === "symptomatic" && s.symptomatic === "?") {
      flashField("symptomatic");
      return;
    }
    if (t.need === "rescuers" && s.rescuers === "?") {
      flashField("rescuers");
      return;
    }
    if (t.need === "weightKg" && s.weightKg == null) {
      flashField("weightKg");
      return;
    }
    if (t.need === "rhythm" && s.rhythm === "?") {
      flashField("rhythm");
      return;
    }
    if (t.need === "glucose" && s.glucose === "?") {
      flashField("glucose");
      return;
    }
    if (t.need === "strokeSx" && s.strokeSx === "?") {
      flashField("strokeSx");
      return;
    }

    if (t.id === "choking-cycles") {
      log("5 Back Blows & 5 Abdominal Thrusts delivered", "task");
      return;
    }
    if (t.id === "reassess-responsiveness") {
      flashField("alert");
      log("Reassessed responsiveness", "task");
      return;
    }
    if (t.id === "reversible") {
      log("H's & T's reviewed", "task");
      return; // recurring — stays visible
    }
    if (t.id === "rescue-breaths") {
      log("Rescue breaths given", "task");
      return; // recurring
    }
    if (t.id === "opioid-reversal") {
      log("Considered opioid reversal", "task");
      hideTask(t.id);
      return;
    }

    if (t.id === "start-cpr") {
      const now = Date.now();
      update((p) => ({
        ...p,
        cpr: {
          active: true,
          cycleNumber: 1,
          cycleStartAt: now,
          pausedAt: null,
          metronomeAnchor: now,
        },
        pulse: "?",
        rhythm: "?",
      }));
      log("CPR started — cycle 1", "cpr");
      return;
    }
    if (t.id === "resume-cpr") {
      const now = Date.now();
      update((p) => ({
        ...p,
        cpr: {
          ...p.cpr,
          cycleNumber: p.cpr.cycleNumber + 1,
          cycleStartAt: now,
          pausedAt: null,
          metronomeAnchor: now,
        },
        pulse: "?",
        rhythm: "?",
      }));
      log(`CPR resumed — cycle ${s.cpr.cycleNumber + 1}`, "cpr");
      return;
    }
    if (t.id === "rosc") {
      const elapsed = s.cpr.pausedAt
        ? s.cpr.pausedAt - s.cpr.cycleStartAt
        : Date.now() - s.cpr.cycleStartAt;
      update((p) => ({
        ...p,
        cpr: { ...p.cpr, active: false, pausedAt: null },
      }));
      log(
        `ROSC — code ended (CPR cycle ${s.cpr.cycleNumber} stopped — ${crFmt(elapsed)})`,
        "cpr",
      );
      return;
    }
    if (t.id === "pause-pulse-check" || t.id === "pause-to-shock") {
      toggleCprPause();
      return;
    }
    if (t.id === "pulse-rhythm-check") {
      flashField("pulse", "rhythm");
      return;
    }
    if (t.id === "pace") {
      giveMed("pace");
      return;
    }
    if (t.id === "get-aed") {
      log("AED requested", "task");
      hideTask(t.id);
      return;
    }
    if (t.id === "airway") {
      update((p) => ({
        ...p,
        breathing: "ETT",
        ...(p.alert !== "Sedated" && { alert: "Sedated" }),
      }));
      log("Airway secured (ETT)", "task");
      if (s.alert !== "Sedated") log("Alert: Sedated (auto, ETT)", "status");
      hideTask(t.id);
      return;
    }
    if (t.id === "access") {
      log("IV/IO access obtained", "task");
      hideTask(t.id);
      markDone("access");
      return;
    }
    if (t.id === "shock") {
      giveMed("shock");
      return;
    }
    if (t.id === "cardiovert") {
      giveMed("shock");
      return;
    }
    if (t.kind === "med" && t.medKey) {
      giveMed(t.medKey);
      return;
    }

    log(`✓ ${t.label}`, "task");
    hideTask(t.id);
  }

  function hideTask(id: string) {
    setFadingTasks((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      update((p) => ({
        ...p,
        doneTasks: { ...p.doneTasks, [id + "__hidden"]: true },
      }));
    }, 620);
  }
  function markDone(id: string) {
    update((p) => ({ ...p, doneTasks: { ...p.doneTasks, [id]: true } }));
  }

  function giveMed(key: string) {
    const med = CR_MED_BY_KEY[key];
    if (!med) return;
    const now = Date.now();
    const isContinuous = CR_CONTINUOUS_KEYS.has(key);
    const currentRow = s.gave.find((g) => g.key === key);
    const currentDoseCount = currentRow ? currentRow.doses.length : 0;
    const isCurrentlyActive = isContinuous && currentDoseCount % 2 === 1;

    update((p) => {
      const existing = p.gave.find((g) => g.key === key);
      let gave;
      if (existing) {
        gave = p.gave.map((g) =>
          g.key === key ? { ...g, doses: [...g.doses, now] } : g,
        );
      } else {
        gave = [...p.gave, { key, doses: [now] }];
      }
      return { ...p, gave };
    });

    if (isContinuous) {
      log(
        isCurrentlyActive ? `Stopped ${med.short}` : `Started ${med.short}`,
        "med",
      );
    } else {
      log(`+1 ${med.short}`, "med");
    }
    if (key === "shock") {
      setTimeout(() => log("Rhythm: ?", "status"), 0);
    } else if (key === "adenosine" || key === "atropine") {
      setTimeout(() => {
        log("Rate: ?", "status");
        log("Rhythm: ?", "status");
      }, 0);
    }
    setLastAction({ key, time: now });
  }

  // CPR controls
  function toggleCprPause() {
    const now = Date.now();
    update((p) => {
      const c = p.cpr;
      if (c.pausedAt) {
        const text = `CPR resumed — cycle ${c.cycleNumber + 1}`;
        return {
          ...p,
          cpr: {
            ...c,
            cycleNumber: c.cycleNumber + 1,
            cycleStartAt: now,
            pausedAt: null,
            metronomeAnchor: now,
          },
          pulse: "?",
          rhythm: "?",
          log: [...p.log, { at: now, type: "cpr", text }],
        };
      } else {
        const elapsed = now - c.cycleStartAt;
        const text = `CPR cycle ${c.cycleNumber} ended (pause) — ${crFmt(elapsed)}`;
        return {
          ...p,
          cpr: { ...c, pausedAt: now },
          log: [...p.log, { at: now, type: "cpr", text }],
        };
      }
    });
  }
  function syncMetronome() {
    update((p) => ({ ...p, cpr: { ...p.cpr, metronomeAnchor: Date.now() } }));
  }

  const tasks = crNextTasks(s);

  // CPR compression:breath guidance based on rescuers, ETT, and patient type
  function getCprGuidance(): string {
    const hasETT = s.breathing === "ETT";
    if (hasETT) {
      return s.type === "pediatric"
        ? "Continuous · 1 breath/2-3s"
        : "Continuous · 1 breath/6s";
    }
    if (s.rescuers === "Team") return "";
    if (s.type === "pediatric" && s.rescuers === "Two") return "Ratio = 15:2";
    return "Ratio = 30:2";
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg)",
      }}
    >
      <CRPatientHeader
        patient={s}
        onBack={onBack}
        onOpenLog={onOpenLog}
        onInfo={() => setInfoOpen(true)}
      />

      <div
        className="cr-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 12px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {cpr.active && (
          <CRCprPill
            cpr={cpr}
            elapsed={cycleElapsed}
            onPause={toggleCprPause}
            onSync={syncMetronome}
            guidance={getCprGuidance()}
          />
        )}

        <div className="cr-patient-grid">
          <CRSection className="cr-s-status" title="Status">
            <CRStatusRow
              label="Alert"
              disabled={s.breathing === "ETT"}
              uncertain={s.alert === "?"}
              flashKey={flashTargets.has("alert") ? flashKey : null}
            >
              <CRDropdown
                value={s.alert}
                options={CR_OPTS_ALERT}
                onChange={setAlert}
                tone="auto"
                disabled={s.breathing === "ETT"}
                flashRedKey={flashTargets.has("alert") ? flashKey : null}
                buttonGroup
              />
            </CRStatusRow>
            <CRStatusRow label="Breathing" uncertain={s.breathing === "?"} flashKey={flashTargets.has("breathing") ? flashKey : null}>
              {s.breathing === "ETT" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ background: "var(--green-soft)", color: "var(--green)", padding: "3px 10px", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>ETT</span>
                  <button
                    onClick={() => setBreathing("?")}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 4, display: "flex", alignItems: "center" }}
                  >
                    <CRIcon name="close" size={16} />
                  </button>
                </div>
              ) : (
                <CRDropdown
                  value={s.breathing}
                  options={CR_OPTS_BREATH}
                  onChange={setBreathing}
                  tone="auto"
                  flashRedKey={flashTargets.has("breathing") ? flashKey : null}
                  buttonGroup
                />
              )}
            </CRStatusRow>
            {s.alert !== "Yes" && (
              <CRStatusRow
                label="Pulse"
                disabled={cpr.active && !cpr.pausedAt}
                uncertain={s.pulse === "?"}
                flashKey={flashTargets.has("pulse") ? flashKey : null}
              >
                <CRDropdown
                  value={s.pulse}
                  options={CR_OPTS_YN}
                  onChange={setPulse}
                  tone="auto"
                  disabled={cpr.active && !cpr.pausedAt}
                  flashRedKey={flashTargets.has("pulse") ? flashKey : null}
                  buttonGroup
                />
              </CRStatusRow>
            )}
            {s.pulse === "Yes" && (
              <CRStatusRow label="Heart Rate" uncertain={s.rate === "?"} flashKey={flashTargets.has("rate") ? flashKey : null}>
                <CRDropdown
                  value={s.rate}
                  options={CR_OPTS_RATE}
                  onChange={setRate}
                  tone="auto"
                  buttonGroup
                />
              </CRStatusRow>
            )}
            {s.pulse === "Yes" &&
              (s.rate === "Fast" || s.rate === "Slow") &&
              s.alert !== "No" &&
              s.alert !== "Altered" && (
                <CRStatusRow
                  label="Symptomatic"
                  uncertain={s.symptomatic === "?"}
                  flashKey={flashTargets.has("symptomatic") ? flashKey : null}
                >
                  <CRDropdown
                    value={s.symptomatic}
                    options={CR_OPTS_YN}
                    onChange={setSymptomatic}
                    tone="symptomatic"
                    buttonGroup
                  />
                </CRStatusRow>
              )}
            {/* Rhythm row — exactly one variant renders at a time.
                  Pulse:Yes always wins (rate-gated); arrest set only when pulse is No/unknown. */}
            {s.pulse !== "Yes" && (s.pulse === "No" || cpr.active) ? (
              <CRStatusRow
                label="Rhythm"
                uncertain={s.rhythm === "?"}
                onInfo={() => setPopup("rhythm")}
                flashKey={flashTargets.has("rhythm") ? flashKey : null}
              >
                <CRDropdown
                  value={s.rhythm}
                  options={CR_OPTS_RHYTHM_ARREST}
                  onChange={setRhythm}
                  tone="auto"
                  flashRedKey={flashTargets.has("rhythm") ? flashKey : null}
                  buttonGroup
                />
              </CRStatusRow>
            ) : (
              s.pulse === "Yes" &&
              s.rate !== "?" &&
              s.rate !== "Normal" && (
                <CRStatusRow
                  label="Rhythm"
                  uncertain={s.rhythm === "?"}
                  onInfo={() => setPopup("rhythm")}
                  flashKey={flashTargets.has("rhythm") ? flashKey : null}
                >
                  <CRDropdown
                    value={s.rhythm}
                    options={
                      s.rate === "Fast"
                        ? CR_OPTS_RHYTHM_TACH
                        : s.rate === "Slow"
                          ? CR_OPTS_RHYTHM_BRADY
                          : CR_OPTS_RHYTHM_NORMAL
                    }
                    onChange={setRhythm}
                    tone="auto"
                    flashRedKey={flashTargets.has("rhythm") ? flashKey : null}
                    buttonGroup
                  />
                </CRStatusRow>
              )
            )}
            {/* Rescuers — shown during cardiac arrest for CPR guidance; hidden when code team implied */}
            {(s.pulse === "No" || cpr.active) && s.breathing !== "ETT" && s.rescuers !== "Team" && crGiven(s, "epi") === 0 && (
              <CRStatusRow label="Rescuers" uncertain={s.rescuers === "?"} flashKey={flashTargets.has("rescuers") ? flashKey : null}>
                <CRDropdown
                  value={s.rescuers}
                  options={CR_OPTS_RESCUERS}
                  onChange={setRescuers}
                  tone="auto"
                  buttonGroup
                />
              </CRStatusRow>
            )}
            {/* Weight — pediatric patients only */}
            {s.type === "pediatric" && (
              <CRStatusRow label="Weight" uncertain={s.weightKg == null} flashKey={flashTargets.has("weightKg") ? flashKey : null}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={weightInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setWeightInput(raw);
                      setWeightKg(raw);
                    }}
                    placeholder="—"
                    style={{
                      width: 64,
                      height: 30,
                      borderRadius: 8,
                      border: `1px solid ${weightInput !== "" && (isNaN(parseFloat(weightInput)) || parseFloat(weightInput) <= 0) ? "var(--red)" : "var(--line-strong)"}`,
                      padding: "0 8px",
                      fontSize: 15,
                      fontFamily: "inherit",
                      textAlign: "right",
                      outline: "none",
                      background: "var(--surface)",
                      color:
                        weightInput !== "" &&
                        (isNaN(parseFloat(weightInput)) ||
                          parseFloat(weightInput) <= 0)
                          ? "var(--red)"
                          : "var(--ink)",
                    }}
                  />
                  <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
                    kg
                  </span>
                </div>
              </CRStatusRow>
            )}
            {/* Glucose + Stroke Sx — shown when alert is Altered */}
            {s.alert === "Altered" && (
              <>
                <CRStatusRow label="Glucose" uncertain={s.glucose === "?"} flashKey={flashTargets.has("glucose") ? flashKey : null}>
                  <CRDropdown
                    value={s.glucose}
                    options={CR_OPTS_GLUCOSE}
                    onChange={setGlucose}
                    tone="auto"
                    buttonGroup
                    flashRedKey={flashTargets.has("glucose") ? flashKey : null}
                  />
                </CRStatusRow>
                <CRStatusRow
                  label="Stroke Sx"
                  uncertain={s.strokeSx === "?"}
                  onInfo={() => setPopup("strokeSx")}
                  flashKey={flashTargets.has("strokeSx") ? flashKey : null}
                >
                  <CRDropdown
                    value={s.strokeSx}
                    options={CR_OPTS_STROKESX}
                    onChange={setStrokeSx}
                    tone="auto"
                    buttonGroup
                    flashRedKey={flashTargets.has("strokeSx") ? flashKey : null}
                  />
                </CRStatusRow>
              </>
            )}
          </CRSection>

          <CRSection className="cr-s-next" title="Next">
            <CRNextList
              tasks={tasks}
              fading={fadingTasks}
              onCheck={checkTask}
              patient={s}
            />
          </CRSection>

          {/* Gave section: always rendered in a single stable DOM branch to prevent remount loops */}
          <div
            className="cr-s-gave"
            style={
              isPillGave
                ? {
                    gridArea: "gave",
                    background: "transparent",
                    border: "none",
                  }
                : {
                    gridArea: "gave",
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 14,
                    position: "relative",
                  }
            }
          >
            {/* Header row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: isPillGave ? "4px 2px 8px" : "8px 10px 8px 14px",
                borderBottom: isPillGave ? "none" : "1px solid var(--line)",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--ink-3)",
                }}
              >
                Gave
              </h2>
              <CRGaveSearch onPick={(k) => giveMed(k)} />
            </div>

            {/* List/Grid Container */}
            <div style={{ padding: isPillGave ? 0 : undefined }}>
              <CRGaveList
                state={s}
                recKeys={recKeys}
                onGive={giveMed}
                onLayoutChange={setIsPillGave}
                lastAction={lastAction}
                currentTime={currentTime}
              />
            </div>
          </div>
        </div>
      </div>

      {infoOpen && <CRInfoModal onClose={() => setInfoOpen(false)} />}
      {popup && (
        <CRPopupModal type={popup} patient={s} onClose={() => setPopup(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CRPatientHeader
// ─────────────────────────────────────────────────────────────
export function CRPatientHeader({
  patient,
  onBack,
  onOpenLog,
  onInfo,
}: CRPatientHeaderProps) {
  const lastLog =
    patient.log.length > 0
      ? [...patient.log].sort((a, b) => b.at - a.at)[0]
      : null;
  const lastLogAt = lastLog ? lastLog.at : Date.now();
  const isRecent = Date.now() - lastLogAt < 5 * 60 * 1000;
  const currentTime = isRecent || patient.cpr.active ? Date.now() : lastLogAt;
  const elapsed = currentTime - patient.startedAt;
  return (
    <header
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        background: "var(--bg)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 10px 10px",
        }}
      >
        <button onClick={onBack} style={crIconBtn()}>
          <CRIcon name="chevron-left" size={22} />
        </button>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.005em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {patient.name}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-3)",
              whiteSpace: "nowrap",
            }}
          >
            {patient.type === "pediatric" ? "PEDS" : "ADULT"} · {crFmt(elapsed)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          <button onClick={onOpenLog} style={crIconBtn()}>
            <CRIcon name="list" size={20} />
          </button>
          <button onClick={onInfo} style={crIconBtn()}>
            <CRIcon name="info" size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// CRCprPill
// ─────────────────────────────────────────────────────────────
export function CRCprPill({
  cpr,
  elapsed,
  onPause,
  onSync,
  guidance,
}: CRCprPillProps) {
  const paused = !!cpr.pausedAt;
  const past = !paused && elapsed >= 120000;
  const near = !paused && !past && elapsed >= 105000;
  const cls = past ? "cr-past-2min" : near ? "cr-near-2min" : "";

  const period = 500;
  const since = Date.now() - cpr.metronomeAnchor;
  const beatIndex = Math.floor(since / period);

  const bg = paused
    ? "var(--surface-2)"
    : past
      ? "color-mix(in srgb, var(--red) 18%, white)"
      : near
        ? "var(--amber-soft)"
        : "color-mix(in srgb, var(--red) 8%, white)";
  const border = paused
    ? "var(--line-strong)"
    : past
      ? "var(--red)"
      : near
        ? "var(--amber)"
        : "color-mix(in srgb, var(--red) 25%, transparent)";
  const ink = past ? "white" : "var(--ink)";
  const badgeBg = paused
    ? "var(--ink-3)"
    : past
      ? "rgba(255,255,255,0.18)"
      : "color-mix(in srgb, var(--red) 80%, white)";
  const badgeLabel = paused
    ? `PAUSED · #${cpr.cycleNumber}`
    : `CPR #${cpr.cycleNumber}`;

  return (
    <div
      className={cls}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px 8px 12px",
        borderRadius: 14,
        background: bg,
        border: `1px solid ${border}`,
        color: ink,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          padding: "3px 7px",
          borderRadius: 6,
          background: badgeBg,
          color: "white",
          whiteSpace: "nowrap",
        }}
      >
        {badgeLabel}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {crFmt(elapsed)}
      </div>
      {/* Secondary info — shrinks when narrow; guidance truncates first, then /2:00 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--ink-3)",
            opacity: past ? 0.7 : 1,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          / 2:00
        </span>
        {guidance && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: past ? "rgba(255,255,255,0.7)" : "var(--ink-3)",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {guidance}
          </span>
        )}
      </div>
      {!paused && (
        <button
          onClick={onSync}
          aria-label="sync metronome"
          style={crCprBtn(past)}
          title="Tap to sync to compressions"
        >
          <span
            key={beatIndex}
            style={{
              display: "inline-block",
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: past ? "white" : "var(--red)",
              animation: "crMetronome 500ms linear",
            }}
          />
        </button>
      )}
      <button
        onClick={onPause}
        aria-label={paused ? "resume" : "pause"}
        style={{
          ...crCprBtn(past),
          width: "auto",
          padding: "0 12px",
          fontSize: 12,
          fontWeight: 700,
          gap: 5,
        }}
      >
        <CRIcon
          name={paused ? "play" : "pause"}
          size={14}
          color={past ? "white" : "var(--ink)"}
        />
        <span>{paused ? "Resume" : "Pause"}</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CRNextList
// ─────────────────────────────────────────────────────────────
export function CRNextList({
  tasks,
  fading,
  onCheck,
  patient,
}: CRNextListProps) {
  const [activePopup, setActivePopup] = useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <div
        style={{ padding: "18px 14px", color: "var(--ink-3)", fontSize: 14 }}
      >
        No actions pending. Reassess.
      </div>
    );
  }
  return (
    <div>
      {tasks.map((t, i) => {
        const critical = t.kind === "critical";
        const shock = t.kind === "shock";
        const isFading = fading[t.id];
        return (
          <div
            key={t.id}
            className={isFading ? "cr-fade" : ""}
            onClick={t.popup ? () => setActivePopup(t.popup!) : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 10px 10px 14px",
              borderBottom:
                i === tasks.length - 1 ? "none" : "1px solid var(--line)",
              background: critical
                ? "color-mix(in srgb, var(--red) 6%, white)"
                : "transparent",
              cursor: t.popup ? "pointer" : undefined,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (t.recurring && t.popup) {
                  setActivePopup(t.popup!);
                } else {
                  onCheck(t);
                }
              }}
              aria-label={t.recurring ? "cycle" : "check"}
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: "#fff",
                border: `1.5px solid ${critical ? "var(--red)" : shock ? "var(--shock)" : "var(--line-strong)"}`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flex: "none",
              }}
            >
              {t.recurring ? (
                <CRIcon
                  name="sync"
                  size={14}
                  color={critical ? "var(--red)" : "var(--line-strong)"}
                />
              ) : (
                shock && <CRIcon name="bolt" size={14} color="var(--shock)" />
              )}
            </button>
            <div
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: critical ? 700 : 500,
                color: critical ? "var(--red)" : "var(--ink)",
                letterSpacing: "-0.005em",
              }}
            >
              {t.label}
            </div>
            {t.popup && (
              <button
                onClick={(e) => { e.stopPropagation(); setActivePopup(t.popup!); }}
                aria-label="more info"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <CRIcon name="question" size={17} color="var(--ink-3)" />
              </button>
            )}
            {critical && !t.popup && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "var(--red)",
                  textTransform: "uppercase",
                }}
              >
                now
              </span>
            )}
          </div>
        );
      })}
      {activePopup && (
        <CRPopupModal
          type={
            activePopup as
              | "shock"
              | "ht"
              | "strokeSx"
              | "strokeScale"
              | "rhythm"
          }
          patient={patient}
          onClose={() => setActivePopup(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CRGaveList
//
// Renders medication rows in two layouts depending on container width:
//   - Narrow (< PILL_BREAKPOINT): stacked list rows with +1 button, name, count, time
//   - Wide (≥ PILL_BREAKPOINT):  detached flex-wrap grid of compact pills
// A ResizeObserver on the wrapper div drives the layout switch.
// ─────────────────────────────────────────────────────────────

/** Minimum container width (px) to switch to pill grid layout. */
const PILL_BREAKPOINT = 480;

export function CRGaveList({
  state,
  recKeys,
  onGive,
  onLayoutChange,
  lastAction,
  currentTime,
}: CRGaveListProps) {
  const givenKeys = state.gave
    .filter((g) => g.doses.length > 0)
    .sort((a, b) => Math.min(...a.doses) - Math.min(...b.doses))
    .map((g) => g.key);
  const givenSet = new Set(givenKeys);
  const recList = [...recKeys].filter((k) => !givenSet.has(k));
  const stagedKeys = state.gave
    .filter((g) => g.doses.length === 0 && !recKeys.has(g.key))
    .map((g) => g.key);
  const keys = [...givenKeys, ...recList, ...stagedKeys];

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isPills, setIsPills] = useState(false);

  // Per-key animation counters — bumped on each trigger to restart animations
  const [rippleKeys, setRippleKeys] = useState<Record<string, number>>({});
  const [countKeys, setCountKeys] = useState<Record<string, number>>({});

  useEffect(() => {
    if (lastAction) {
      const { key } = lastAction;
      setRippleKeys((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
      setCountKeys((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
    }
  }, [lastAction]);

  /** Wrap onGive to delegate giving the med. */
  function handleGive(k: string) {
    onGive(k);
  }

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.offsetWidth;
      setIsPills(width >= PILL_BREAKPOINT);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Notify parent whenever layout mode changes so it can swap the section wrapper
  useEffect(() => {
    onLayoutChange?.(isPills);
  }, [isPills, onLayoutChange]);

  if (keys.length === 0) {
    return (
      <div
        ref={wrapperRef}
        style={{
          padding: isPills ? "2px 2px 14px" : "18px 14px",
          color: "var(--ink-3)",
          fontSize: 14,
        }}
      >
        Nothing given yet. Add from search.
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      style={
        isPills
          ? {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 8,
            }
          : {
              display: "flex",
              flexDirection: "column",
            }
      }
    >
      {keys.map((k, i) => {
        const med = CR_MED_BY_KEY[k];
        const row = state.gave.find((g) => g.key === k);
        const count = row ? row.doses.length : 0;
        const last =
          row && row.doses.length ? row.doses[row.doses.length - 1] : null;
        const recommended = recKeys.has(k);
        const isShock = k === "shock";
        const isContinuous = CR_CONTINUOUS_KEYS.has(k);
        // For continuous items: odd dose count = active (alternating start/stop timestamps)
        const isActive = isContinuous && count % 2 === 1;
        const activeStart =
          isActive && row ? row.doses[row.doses.length - 1] : null;
        const activeElapsed = activeStart
          ? (currentTime ?? Date.now()) - activeStart
          : 0;

        return (
          <div
            key={k}
            style={
              isPills
                ? {
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px 8px 10px",
                    borderRadius: 12,
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }
                : {
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 10px 10px 12px",
                    borderBottom:
                      i === keys.length - 1 ? "none" : "1px solid var(--line)",
                  }
            }
          >
            {isContinuous ? (
              /* Play / Pause button for continuous actions */
              <button
                onClick={() => handleGive(k)}
                style={{
                  minWidth: 44,
                  height: 30,
                  padding: "0 9px",
                  borderRadius: 7,
                  background: isActive ? "var(--accent)" : "#fff",
                  border: `1.5px solid var(--accent)`,
                  color: isActive ? "#fff" : "var(--accent)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CRIcon
                  name={isActive ? "pause" : "play"}
                  size={13}
                  color={isActive ? "#fff" : "var(--accent)"}
                />
              </button>
            ) : (
              /* +1 button with ripple overlay */
              <button
                onClick={() => handleGive(k)}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  minWidth: 44,
                  height: 30,
                  padding: "0 9px",
                  borderRadius: 7,
                  background:
                    recommended && count === 0
                      ? isShock
                        ? "var(--shock)"
                        : "var(--accent)"
                      : "#fff",
                  border: `1.5px solid ${isShock ? "var(--shock)" : "var(--accent)"}`,
                  color:
                    recommended && count === 0
                      ? "#fff"
                      : isShock
                        ? "var(--shock)"
                        : "var(--accent)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                +1
                {rippleKeys[k] > 0 && (
                  <span
                    key={rippleKeys[k]}
                    style={{
                      position: "absolute",
                      inset: 0,
                      margin: "auto",
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: isShock ? "var(--shock)" : "var(--accent)",
                      opacity: 0,
                      pointerEvents: "none",
                      animation: "crRipple 500ms ease-out forwards",
                    }}
                  />
                )}
              </button>
            )}
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
                minWidth: 0,
              }}
            >
              {isShock && <CRIcon name="bolt" size={14} color="var(--shock)" />}
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                  color: isShock ? "var(--shock)" : "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {med?.name || k}
              </span>
              {/* Count badge — only for non-continuous items */}
              {!isContinuous && (
                <span
                  key={countKeys[k]}
                  className={countKeys[k] ? "mono cr-count-wipe" : "mono"}
                  style={{
                    display: "inline-block",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: 5,
                    background: "var(--surface-2)",
                    color: "var(--ink-2)",
                  }}
                >
                  {count}
                </span>
              )}
            </div>
            {/* Right side: timer for continuous (when active), or time-since-last-dose for countable */}
            {isContinuous ? (
              isActive ? (
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: "var(--accent)",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    marginLeft: isPills ? "auto" : undefined,
                  }}
                >
                  {crFmt(activeElapsed)}
                </span>
              ) : null
            ) : last ? (
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  color: "var(--ink-3)",
                  whiteSpace: "nowrap",
                  marginLeft: isPills ? "auto" : undefined,
                }}
              >
                {crSince((currentTime ?? Date.now()) - last)}
              </span>
            ) : (
              !isPills && (
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: "var(--ink-3)",
                    minWidth: 44,
                    textAlign: "right",
                  }}
                >
                  —
                </span>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CRGaveSearch
// ─────────────────────────────────────────────────────────────
export function CRGaveSearch({ onPick }: CRGaveSearchProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const results = q.trim()
    ? CR_MEDS.filter(
        (m) =>
          m.name.toLowerCase().includes(q.toLowerCase()) ||
          m.short.toLowerCase().includes(q.toLowerCase()),
      )
    : CR_MEDS;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [q, open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(
        (prev) => (prev - 1 + results.length) % results.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = results[highlightedIndex];
      if (selected) {
        onPick(selected.key);
        setOpen(false);
        setQ("");
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQ("");
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            height: 28,
            padding: "0 8px",
            borderRadius: 7,
            background: "#fff",
            border: "1px solid var(--line-strong)",
            color: "var(--ink-2)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <CRIcon name="plus" size={14} /> Add
        </button>
      ) : (
        <>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search meds / blood"
            style={{
              height: 28,
              padding: "0 8px",
              borderRadius: 7,
              background: "#fff",
              border: "1px solid var(--accent)",
              fontSize: 13,
              width: 170,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              zIndex: 30,
              background: "#fff",
              border: "1px solid var(--line-strong)",
              borderRadius: 10,
              padding: 4,
              boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
              minWidth: 200,
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            {results.length === 0 && (
              <div style={{ padding: 10, color: "var(--ink-3)", fontSize: 13 }}>
                No match.
              </div>
            )}
            {results.map((m, idx) => {
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={m.key}
                  onClick={() => {
                    onPick(m.key);
                    setOpen(false);
                    setQ("");
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: isHighlighted
                      ? "var(--accent-soft)"
                      : "transparent",
                    border: "none",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--ink)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span>{m.name}</span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--ink-3)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {m.cat}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CRPopupModal — contextual info overlays for tasks and status rows
// ─────────────────────────────────────────────────────────────
function CRModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(20,18,12,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: 18,
          maxWidth: 360,
          width: "100%",
          boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-2)",
            }}
          >
            <CRIcon name="close" size={18} />
          </button>
        </div>
        <div
          style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-2)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function CRPopupModal({
  type,
  patient,
  onClose,
}: {
  type: "shock" | "ht" | "strokeSx" | "strokeScale" | "rhythm";
  patient: Patient;
  onClose: () => void;
}) {
  const isPeds = patient.type === "pediatric";
  const wt = patient.weightKg;

  if (type === "shock") {
    return (
      <CRModalShell title="Shock Energy" onClose={onClose}>
        {isPeds ? (
          <>
            <p style={{ marginTop: 0, fontWeight: 600 }}>
              Pediatric Defibrillation
            </p>
            <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
              <li>
                1st shock: <strong>2 J/kg</strong>
                {wt ? ` = ${(wt * 2).toFixed(0)} J` : ""}
              </li>
              <li>
                2nd shock: <strong>4 J/kg</strong>
                {wt ? ` = ${(wt * 4).toFixed(0)} J` : ""}
              </li>
              <li>
                Subsequent: <strong>≥4 J/kg</strong> (max 10 J/kg or adult dose)
              </li>
            </ul>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              Synchronized Cardioversion (peds)
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>SVT: 0.5–1 J/kg → 2 J/kg</li>
              <li>VT with pulse: 0.5–1 J/kg</li>
            </ul>
          </>
        ) : (
          <>
            <p style={{ marginTop: 0, fontWeight: 600 }}>
              Adult Defibrillation
            </p>
            <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
              <li>
                <strong>Biphasic:</strong> Manufacturer rec. (120–200 J); if
                unknown use max available
              </li>
              <li>
                <strong>Monophasic:</strong> 360 J
              </li>
              <li>2nd+ doses: equivalent or higher</li>
            </ul>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              Synchronized Cardioversion
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>A-Fib: 120–200 J biphasic</li>
              <li>A-Flutter / SVT: 50–100 J</li>
              <li>VT (with pulse): 100 J</li>
            </ul>
          </>
        )}
      </CRModalShell>
    );
  }

  if (type === "ht") {
    return (
      <CRModalShell title="Reversible Causes (H's & T's)" onClose={onClose}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 16px",
          }}
        >
          <div>
            <p style={{ marginTop: 0, fontWeight: 600 }}>H's</p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>Hypovolemia</li>
              <li>Hypoxia</li>
              <li>Hydrogen ion (acidosis)</li>
              <li>Hypo/hyperkalemia</li>
              {isPeds && <li>Hypoglycemia</li>}
              <li>Hypothermia</li>
            </ul>
          </div>
          <div>
            <p style={{ marginTop: 0, fontWeight: 600 }}>T's</p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>Tension pneumothorax</li>
              <li>Tamponade, cardiac</li>
              <li>Toxins</li>
              <li>Thrombosis, pulmonary</li>
              <li>Thrombosis, coronary</li>
            </ul>
          </div>
        </div>
      </CRModalShell>
    );
  }

  if (type === "strokeSx") {
    return (
      <CRModalShell title="Stroke Symptoms" onClose={onClose}>
        <p style={{ marginTop: 0, fontWeight: 600 }}>
          Cincinnati Prehospital Stroke Scale
        </p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
          <li>
            <strong>Facial droop</strong> — ask to smile; one side droops?
          </li>
          <li>
            <strong>Arm drift</strong> — eyes closed, arms out 10s; one drifts?
          </li>
          <li>
            <strong>Speech</strong> — slurred, wrong words, or unable to speak?
          </li>
        </ul>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>Other signs</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Sudden vision changes (one or both eyes)</li>
          <li>Sudden severe headache ("worst of my life")</li>
          <li>Sudden loss of balance or coordination</li>
        </ul>
        <p
          style={{
            marginTop: 10,
            marginBottom: 0,
            color: "var(--ink-3)",
            fontSize: 12,
          }}
        >
          Document <strong>Last Known Well</strong> time immediately.
        </p>
      </CRModalShell>
    );
  }

  if (type === "strokeScale") {
    return (
      <CRModalShell title="NIHSS / FAST Stroke Scale" onClose={onClose}>
        <p style={{ marginTop: 0, fontWeight: 600 }}>FAST</p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
          <li>
            <strong>F</strong>ace — facial droop
          </li>
          <li>
            <strong>A</strong>rms — arm weakness / drift
          </li>
          <li>
            <strong>S</strong>peech — slurred or absent
          </li>
          <li>
            <strong>T</strong>ime — note onset, activate stroke team NOW
          </li>
        </ul>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>Key NIHSS domains</p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
          <li>Level of consciousness (0–3)</li>
          <li>Gaze (0–2), Visual (0–3)</li>
          <li>Facial palsy (0–3)</li>
          <li>Motor arm & leg (0–4 each)</li>
          <li>Limb ataxia, sensory, language, dysarthria, extinction</li>
        </ul>
        <p style={{ marginBottom: 0, color: "var(--ink-3)", fontSize: 12 }}>
          Mild ≤5 · Moderate 6–15 · Severe ≥16. Score &gt;25 may preclude
          thrombolytics.
        </p>
      </CRModalShell>
    );
  }

  if (type === "rhythm") {
    return (
      <CRModalShell title="Rhythm Guide" onClose={onClose}>
        {[
          {
            name: "VF",
            desc: "Chaotic irregular baseline — no QRS. Coarse or fine.",
          },
          {
            name: "VT",
            desc: "Wide QRS (>0.12s), fast (~150–250 bpm), regular. May be pulseless.",
          },
          {
            name: "PEA",
            desc: "Organized rhythm on monitor, but no detectable pulse.",
          },
          {
            name: "Asystole",
            desc: "Flat line or near-flat — confirm in 2 leads.",
          },
          {
            name: "NSR",
            desc: "Regular, 60–100 bpm, narrow QRS, P before each QRS.",
          },
          {
            name: "SVT",
            desc: "Narrow QRS, very fast (>150 bpm), regular, P waves may be hidden.",
          },
          {
            name: "A-Fib",
            desc: "Irregularly irregular, no distinct P waves, narrow QRS.",
          },
          {
            name: "A-Flutter",
            desc: "Sawtooth F waves at ~300 bpm, ventricular rate often ~150.",
          },
          {
            name: "Wide VT",
            desc: "Wide QRS tachycardia (>0.12s). Treat as VT until proven otherwise.",
          },
          {
            name: "Sinus Brady",
            desc: "Regular, <60 bpm, normal P-QRS relationship.",
          },
          { name: "1° AVB", desc: "PR >200ms, all P waves conduct normally." },
          {
            name: "2° AVB",
            desc: "Type 1 (Wenckebach): PR lengthens then drops. Type 2: sudden drop.",
          },
          {
            name: "3° AVB",
            desc: "Complete block — P and QRS independent, escape rhythm present.",
          },
        ].map(({ name, desc }) => (
          <div key={name} style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{name}</span>
            <span style={{ color: "var(--ink-3)", marginLeft: 6 }}>—</span>
            <span style={{ marginLeft: 6 }}>{desc}</span>
          </div>
        ))}
      </CRModalShell>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// CRInfoModal
// ─────────────────────────────────────────────────────────────
export function CRInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 70,
        background: "rgba(20,18,12,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: 18,
          maxWidth: 320,
          width: "100%",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            About CodeRunner
          </h3>
          <button onClick={onClose} style={crIconBtn()}>
            <CRIcon name="close" size={20} />
          </button>
        </div>
        <div
          style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-2)" }}
        >
          <p style={{ marginTop: 0 }}>
            <strong style={{ color: "var(--red)" }}>
              Not a medical device.
            </strong>{" "}
            CodeRunner is an unofficial study/teamwork aid for trained providers
            running resuscitations. It is
            <em> not</em> a substitute for clinical judgement, an institutional
            protocol, or current published guidelines.
          </p>
          <p>
            All times, dose suggestions, and pathways are simplified for
            prototype use. Verify everything against your facility's reference
            before administering.
          </p>
          <p style={{ marginBottom: 0, color: "var(--ink-3)", fontSize: 12 }}>
            v0.1 · prototype · no patient data leaves this device.
          </p>
        </div>
      </div>
    </div>
  );
}
