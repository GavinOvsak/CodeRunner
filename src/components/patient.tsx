import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Patient, CPRState, NextTask } from "../types";
import {
  CR_MEDS,
  CR_MED_BY_KEY,
  crNextTasks,
  crRecommendedMedKeys,
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
  { value: "ETT", label: "ETT" },
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
}

interface CRNextListProps {
  tasks: NextTask[];
  fading: Record<string, boolean>;
  onCheck: (t: NextTask) => void;
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
  const [fadingTasks, setFadingTasks] = useState<Record<string, boolean>>({});
  const [flashKey, setFlashKey] = useState(0);
  const [flashTarget, setFlashTarget] = useState<string | null>(null);
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
  function flashField(field: string) {
    setFlashTarget(field);
    setFlashKey((k) => k + 1);
    setTimeout(() => setFlashTarget(null), 1400);
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
    if (t.need === "rhythm" && s.rhythm === "?") {
      flashField("rhythm");
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
    if (t.id === "pause-pulse-check") {
      toggleCprPause();
      return;
    }
    if (t.id === "pulse-rhythm-check") {
      flashField("pulse");
      flashField("rhythm");
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
    log(`+1 ${med.short}`, "med");
    if (key === "shock" || key == "adenosine") {
      setTimeout(() => log("Rhythm: ?", "status"), 0);
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
          />
        )}

        <div className="cr-patient-grid">
          <CRSection className="cr-s-status" title="Status">
            <CRStatusRow
              label="Alert"
              disabled={s.breathing === "ETT"}
              uncertain={s.alert === "?"}
            >
              <CRDropdown
                value={s.alert}
                options={CR_OPTS_ALERT}
                onChange={setAlert}
                tone="auto"
                disabled={s.breathing === "ETT"}
                flashRedKey={flashTarget === "alert" ? flashKey : null}
                buttonGroup
              />
            </CRStatusRow>
            <CRStatusRow label="Breathing" uncertain={s.breathing === "?"}>
              <CRDropdown
                value={s.breathing}
                options={CR_OPTS_BREATH}
                onChange={setBreathing}
                tone="auto"
                flashRedKey={flashTarget === "breathing" ? flashKey : null}
                buttonGroup
              />
            </CRStatusRow>
            {s.alert !== "Yes" && (
              <CRStatusRow
                label="Pulse"
                disabled={cpr.active && !cpr.pausedAt}
                uncertain={s.pulse === "?"}
              >
                <CRDropdown
                  value={s.pulse}
                  options={CR_OPTS_YN}
                  onChange={setPulse}
                  tone="auto"
                  disabled={cpr.active && !cpr.pausedAt}
                  flashRedKey={flashTarget === "pulse" ? flashKey : null}
                  buttonGroup
                />
              </CRStatusRow>
            )}
            {s.pulse === "Yes" && (
              <CRStatusRow label="Heart Rate" uncertain={s.rate === "?"}>
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
                >
                  <CRDropdown
                    value={s.symptomatic}
                    options={CR_OPTS_YN}
                    onChange={setSymptomatic}
                    tone="auto"
                    buttonGroup
                  />
                </CRStatusRow>
              )}
            {/* Rhythm row — exactly one variant renders at a time.
                  Pulse:Yes always wins (rate-gated); arrest set only when pulse is No/unknown. */}
            {s.pulse !== "Yes" && (s.pulse === "No" || cpr.active) ? (
              <CRStatusRow label="Rhythm" uncertain={s.rhythm === "?"}>
                <CRDropdown
                  value={s.rhythm}
                  options={CR_OPTS_RHYTHM_ARREST}
                  onChange={setRhythm}
                  tone="auto"
                  flashRedKey={flashTarget === "rhythm" ? flashKey : null}
                  buttonGroup
                />
              </CRStatusRow>
            ) : (
              s.pulse === "Yes" &&
              s.rate !== "?" && (
                <CRStatusRow label="Rhythm" uncertain={s.rhythm === "?"}>
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
                    flashRedKey={flashTarget === "rhythm" ? flashKey : null}
                    buttonGroup
                  />
                </CRStatusRow>
              )
            )}
          </CRSection>

          <CRSection className="cr-s-next" title="Next">
            <CRNextList
              tasks={tasks}
              fading={fadingTasks}
              onCheck={checkTask}
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
export function CRCprPill({ cpr, elapsed, onPause, onSync }: CRCprPillProps) {
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
        }}
      >
        {crFmt(elapsed)}
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--ink-3)",
            opacity: past ? 0.7 : 1,
          }}
        >
          {" "}
          / 2:00
        </span>
      </div>
      <div style={{ flex: 1 }} />
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
export function CRNextList({ tasks, fading, onCheck }: CRNextListProps) {
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
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderBottom:
                i === tasks.length - 1 ? "none" : "1px solid var(--line)",
              background: critical
                ? "color-mix(in srgb, var(--red) 6%, white)"
                : "transparent",
            }}
          >
            <button
              onClick={() => onCheck(t)}
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
                fontSize: 16,
                fontWeight: critical ? 700 : 500,
                color: critical ? "var(--red)" : "var(--ink)",
                letterSpacing: "-0.005em",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span>{t.label}</span>
            </div>
            {critical && (
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
            {/* +1 button with ripple overlay */}
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
              {/* Count badge — animation triggered ONLY on active click (countKeys[k] > 0) */}
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
            </div>
            {/* Time since last dose */}
            {last ? (
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
