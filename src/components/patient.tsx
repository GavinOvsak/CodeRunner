import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../i18n/config";
import type {
  Patient,
  CPRState,
  NextTask,
  LogEntry,
  LogPayload,
  MedLogEntry,
  AlertValue,
  BreathingValue,
  PulseValue,
  RateValue,
  SymptomaticValue,
  RhythmValue,
  RescuersValue,
  GlucoseValue,
  StrokeSxValue,
  SepsisSuspectedValue,
  MedKey,
  DiscreteMedKey,
  ContinuousMedKey,
  TaskId,
} from "../types";
import {
  CR_MEDS,
  CR_MED_BY_KEY,
  CR_CONTINUOUS_KEYS,
  MED_DETAILS,
  crNextTasks,
  crRecommendedMedKeys,
} from "../data";
import { crFmt, crSince } from "../utils";
import { CRIcon, CRDropdown, CRSection, CRStatusRow, AnimatedReveal } from "./ui";

// ─────────────────────────────────────────────────────────────
// Status dropdown option sets — built dynamically from translations
// ─────────────────────────────────────────────────────────────
function useCROptions() {
  const { t } = useTranslation();
  const boltIcon = <CRIcon name="bolt" size={14} color="var(--shock)" />;
  return {
    CR_OPTS_YN: [
      { value: "Yes", label: t("common.yes") },
      { value: "No", label: t("common.no") },
    ],
    CR_OPTS_ALERT: [
      { value: "Yes", label: t("common.yes") },
      { value: "No", label: t("common.no") },
      { value: "Altered", label: t("opt.altered") },
      { value: "Sedated", label: t("opt.sedated") },
    ],
    CR_OPTS_BREATH: [
      { value: "Yes", label: t("common.yes") },
      { value: "No", label: t("common.no") },
      { value: "Choking", label: t("opt.choking") },
      { value: "ETT", label: "ETT" },
    ],
    CR_OPTS_RESCUERS: [
      { value: "One", label: t("opt.one") },
      { value: "Two", label: t("opt.two") },
      { value: "Team", label: t("opt.codeTeam") },
    ],
    CR_OPTS_GLUCOSE: [
      { value: "Low", label: t("opt.low") },
      { value: "Normal", label: t("opt.normal") },
      { value: "High", label: t("opt.high") },
    ],
    CR_OPTS_STROKESX: [
      { value: "Yes", label: t("common.yes") },
      { value: "No", label: t("common.no") },
    ],
    CR_OPTS_RATE: [
      { value: "Fast", label: t("opt.fast") },
      { value: "Normal", label: t("opt.normal") },
      { value: "Slow", label: t("opt.slow") },
    ],
    CR_OPTS_RHYTHM_ARREST: [
      { value: "VF", label: "VF", icon: boltIcon },
      { value: "VT", label: t("opt.pvt"), icon: boltIcon },
      { value: "TdP", label: "TdP", icon: boltIcon },
      { value: "PEA", label: "PEA" },
      { value: "Asystole", label: t("opt.asys") },
      { value: "NSR", label: "NSR" },
    ],
    CR_OPTS_RHYTHM_TACH: [
      { value: "NSR", label: "NSR" },
      { value: "SVT", label: "SVT" },
      { value: "AF", label: "AF" },
      { value: "WideTach", label: t("opt.wideVT") },
      { value: "TdP", label: "TdP" },
    ],
    CR_OPTS_RHYTHM_BRADY: [
      { value: "NSR", label: "NSR" },
      { value: "SinusBrady", label: t("opt.sinusBrady") },
      { value: "AVB1", label: "1°" },
      { value: "AVB2", label: "2°" },
      { value: "AVB3", label: "3° AVB" },
    ],
    CR_OPTS_RHYTHM_NORMAL: [
      { value: "NSR", label: "NSR" },
      { value: "AF", label: "AF" },
    ],
  };
}

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
  onStopCode: () => void;
}

interface CRCprPillProps {
  cpr: CPRState;
  onPause: () => void;
  guidance: string;
  rescuers: RescuersValue;
  patientType: "adult" | "pediatric";
  onRescuers: (v: RescuersValue) => void;
}

interface CRNextListProps {
  tasks: NextTask[];
  fading: Record<string, boolean>;
  onCheck: (t: NextTask) => void;
  patient: Patient;
}

interface CRGaveListProps {
  state: Patient;
  recKeys: Set<MedKey>;
  onGive: (key: MedKey) => void;
  /** Called whenever the layout mode switches between list rows and pill grid. */
  onLayoutChange?: (isPills: boolean) => void;
  lastAction?: { key: MedKey; time: number } | null;
  onUpdatePatient: (mut: (p: Patient) => Patient) => void;
}

interface CRGaveSearchProps {
  onPick: (key: MedKey) => void;
  recKeys: Set<MedKey>;
  patient: Patient;
  onUpdatePatient: (mut: (p: Patient) => Patient) => void;
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
    background: invertOnDark ? "white" : "rgba(255,255,255,0.7)",
    border: invertOnDark ? "1px solid white" : "1px solid var(--line-strong)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: invertOnDark ? "var(--red)" : "var(--ink)",
  };
}

// ─────────────────────────────────────────────────────────────
// Language flags (shared with home screen)
// ─────────────────────────────────────────────────────────────
const LANG_FLAGS: Record<string, string> = {
  en: "🇺🇸", fr: "🇫🇷", es: "🇪🇸", id: "🇮🇩", vi: "🇻🇳", zh: "🇨🇳", de: "🇩🇪",
};

function CRPatientLangSwitcher() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = i18n.resolvedLanguage ?? "en";
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ ...crIconBtn(), fontSize: 18 }}
        aria-label="Language"
        title={t(`lang.${current}`)}
      >
        {LANG_FLAGS[current] ?? "🌐"}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 149 }} />
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 150,
            background: "var(--surface)", border: "1px solid var(--line-strong)",
            borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
            minWidth: 190, overflow: "hidden", padding: "4px 0",
          }}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button key={lang} onClick={() => { i18n.changeLanguage(lang); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "9px 14px",
                  background: lang === current ? "var(--accent-soft)" : "transparent",
                  border: "none", textAlign: "left", fontSize: 14,
                  fontWeight: lang === current ? 700 : 400,
                  color: lang === current ? "var(--accent)" : "var(--ink)", cursor: "pointer",
                }}>
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{LANG_FLAGS[lang]}</span>
                <span>{t(`lang.${lang}`)}</span>
                {lang === current && <CRIcon name="check" size={14} color="var(--accent)" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
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
  const { t } = useTranslation();
  const {
    CR_OPTS_YN,
    CR_OPTS_ALERT,
    CR_OPTS_BREATH,
    CR_OPTS_RESCUERS,
    CR_OPTS_GLUCOSE,
    CR_OPTS_STROKESX,
    CR_OPTS_RATE,
    CR_OPTS_RHYTHM_ARREST,
    CR_OPTS_RHYTHM_TACH,
    CR_OPTS_RHYTHM_BRADY,
    CR_OPTS_RHYTHM_NORMAL,
  } = useCROptions();
  const s = patient;
  const dispatch = onChange;
  const [infoOpen, setInfoOpen] = useState(false);
  const [roscPopup, setRoscPopup] = useState(false);
  const [popup, setPopup] = useState<
    | "shock"
    | "ht"
    | "strokeSx"
    | "strokeScale"
    | "rhythm"
    | "symptomatic"
    | "rescueBreaths"
    | "choking"
    | "sinusTachDiff"
    | "lactate"
    | null
  >(null);
  const [fadingTasks, setFadingTasks] = useState<Record<string, boolean>>({});
  const [flashKey, setFlashKey] = useState(0);
  const [flashTargets, setFlashTargets] = useState<Set<string>>(new Set());
  const [weightInput, setWeightInput] = useState(s.weightKg?.toString() ?? "");
  /** True when the Gave section is wide enough to render chips instead of list rows. */
  const [isPillGave, setIsPillGave] = useState(false);
  const [lastAction, setLastAction] = useState<{
    key: MedKey;
    time: number;
  } | null>(null);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);

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
    (entry: LogPayload) => {
      update((p) => ({
        ...p,
        log: [...p.log, { ...entry, at: Date.now() } as LogEntry],
      }));
    },
    [update],
  );

  const stopCode = useCallback(() => {
    // 1. Log cpr end event (this stops CPR and starts freeze condition)
    log({ type: "cpr", event: "end" });

    // 2. Identify and stop active continuous meds
    const activeContinuousMeds = s.gave.filter((g) => {
      const isContinuous = CR_CONTINUOUS_KEYS.has(g.key);
      const isActive = isContinuous && g.doses.length % 2 === 1;
      return isActive;
    });

    activeContinuousMeds.forEach((g) => {
      log({
        type: "med",
        action: "stop",
        key: g.key as ContinuousMedKey,
      });
    });

    setConfirmStopOpen(false);
  }, [log, s.gave]);

  // Coarse tick (10 s) — only drives medication timing windows in crNextTasks.
  // Sub-second display updates are handled inside CRCprPill, CRPatientHeader,
  // and CRGaveList with their own isolated intervals.
  const [taskTick, setTaskTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTaskTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  // derived
  const cpr = s.cpr;
  const lastLog = s.log.at(-1) ?? null;
  const lastLogAt = lastLog ? lastLog.at : Date.now();
  const lastNonStatusLog =
    [...s.log]
      .reverse()
      .find((entry) => entry.type !== "status" && entry.type !== "note") ??
    null;
  const isCodeEnded =
    lastNonStatusLog?.type === "cpr" &&
    (lastNonStatusLog.event === "end" || lastNonStatusLog.event === "rosc");
  const isRecent = !isCodeEnded && Date.now() - lastLogAt < 5 * 60 * 1000;
  // taskNow only changes every 10 s (via taskTick) or when patient state changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const taskNow = useMemo(
    () =>
      isRecent || cpr.active
        ? Date.now()
        : isCodeEnded && lastNonStatusLog
          ? lastNonStatusLog.at
          : lastLogAt,
    [s, taskTick],
  );

  const tasks = crNextTasks(s, taskNow);
  const recKeys = crRecommendedMedKeys(tasks);

  // Status field setters — log entries drive all state via reconstructStateFromLog
  function setAlert(v: string) {
    if (v === s.alert) return;
    const now = Date.now();
    log({ type: "status", field: "alert", value: v as AlertValue });
    if (v === "Yes" && cpr.active && !cpr.pausedAt) {
      const elapsed = now - cpr.cycleStartAt;
      setTimeout(
        () =>
          log({
            type: "cpr",
            event: "pause",
            cycleNumber: cpr.cycleNumber,
            elapsed,
          }),
        0,
      );
    }
  }
  function setBreathing(v: string) {
    if (v === s.breathing) return;
    log({ type: "status", field: "breathing", value: v as BreathingValue });
  }
  function setPulse(v: string) {
    if (v === s.pulse) return;
    log({ type: "status", field: "pulse", value: v as PulseValue });
    if (v === "No") {
      if (s.alert !== "No" && s.alert !== "Sedated")
        log({ type: "status", field: "alert", value: "No" });
      if (s.breathing !== "ETT")
        log({
          type: "status",
          field: "breathing",
          value: "No" as BreathingValue,
        });
    }
  }
  function setRate(v: string) {
    if (v === s.rate) return;
    log({ type: "status", field: "rate", value: v as RateValue });
  }
  function setSymptomatic(v: string) {
    if (v === s.symptomatic) return;
    log({ type: "status", field: "symptomatic", value: v as SymptomaticValue });
  }
  function setRescuers(v: string) {
    if (v === s.rescuers) return;
    log({ type: "status", field: "rescuers", value: v as RescuersValue });
  }
  function setGlucose(v: string) {
    if (v === s.glucose) return;
    log({ type: "status", field: "glucose", value: v as GlucoseValue });
  }
  function setStrokeSx(v: string) {
    if (v === s.strokeSx) return;
    log({ type: "status", field: "strokeSx", value: v as StrokeSxValue });
  }
  function setSepsisSuspected(v: string) {
    if (v === s.sepsisSuspected) return;
    log({ type: "status", field: "sepsisSuspected", value: v as SepsisSuspectedValue });
  }
  function setWeightKg(raw: string) {
    const v = raw === "" ? null : parseFloat(raw);
    const val = v == null || isNaN(v) ? null : v;
    if (val === s.weightKg) return;
    if (val != null) log({ type: "status", field: "weight", value: val });
  }
  function setRhythm(v: string) {
    if (v === s.rhythm) return;
    log({ type: "status", field: "rhythm", value: v as RhythmValue });
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
      log({ type: "task", taskId: "choking-cycles" });
      return;
    }
    if (t.id === "reassess-responsiveness") {
      flashField("alert");
      log({ type: "task", taskId: "reassess-responsiveness" });
      return;
    }
    if (t.id === "reversible") {
      log({ type: "task", taskId: "reversible" });
      return; // recurring — stays visible
    }
    if (t.id === "rescue-breaths") {
      log({ type: "task", taskId: "rescue-breaths" });
      return; // recurring
    }
    if (t.id === "wean-pacing") {
      log({ type: "task", taskId: "wean-pacing" });
      return; // recurring — stays until pacing is stopped
    }
    if (t.id === "opioid-reversal") {
      log({ type: "task", taskId: "opioid-reversal" });
      hideTask(t.id);
      return;
    }

    if (t.id === "start-cpr") {
      log({ type: "cpr", event: "start", cycleNumber: 1 });
      return;
    }
    if (t.id === "resume-cpr") {
      log({ type: "cpr", event: "resume", cycleNumber: s.cpr.cycleNumber + 1 });
      return;
    }
    if (t.id === "rosc") {
      log({ type: "cpr", event: "rosc" });
      hideTask(t.id);
      setRoscPopup(true);
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
      log({ type: "task", taskId: "get-aed" });
      hideTask(t.id);
      return;
    }
    if (t.id === "airway") {
      log({ type: "task", taskId: "airway" });
      hideTask(t.id);
      return;
    }
    if (t.id === "access") {
      log({ type: "task", taskId: "access" });
      hideTask(t.id);
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

    log({ type: "task", taskId: t.id });
    hideTask(t.id);
  }

  function hideTask(id: TaskId) {
    // Animate the fade — doneTasks hidden state is driven by the task log entry via reconstruction
    setFadingTasks((prev) => ({ ...prev, [id]: true }));
  }

  function giveMed(key: MedKey) {
    const med = CR_MED_BY_KEY[key];
    if (!med) return;
    const now = Date.now();
    const isContinuous = CR_CONTINUOUS_KEYS.has(key);
    const currentRow = s.gave.find((g) => g.key === key);
    const currentDoseCount = currentRow ? currentRow.doses.length : 0;
    const isCurrentlyActive = isContinuous && currentDoseCount % 2 === 1;

    if (isContinuous) {
      log({
        type: "med",
        action: isCurrentlyActive ? "stop" : "start",
        key: key as ContinuousMedKey,
      });
      // Stopping pacing always clears rate; starting clears it unless already tachycardic
      if (key === "pace" && (isCurrentlyActive || s.rate !== "Fast")) {
        setTimeout(() => {
          log({ type: "status", field: "rate", value: "?" });
          if (isCurrentlyActive)
            log({ type: "status", field: "rhythm", value: "?" });
        }, 0);
      }
    } else {
      // Adenosine/atropine reset rate+rhythm to prompt reassessment
      if (key === "adenosine" || key === "atropine") {
        setTimeout(() => {
          log({ type: "status", field: "rate", value: "?" });
          log({ type: "status", field: "rhythm", value: "?" });
        }, 0);
      }
      log({ type: "med", action: "give", key: key as DiscreteMedKey });
    }
    setLastAction({ key, time: now });
  }

  // CPR controls
  function toggleCprPause() {
    const now = Date.now();
    const c = cpr;
    if (c.pausedAt) {
      log({ type: "cpr", event: "resume", cycleNumber: c.cycleNumber + 1 });
    } else {
      const elapsed = now - c.cycleStartAt;
      log({ type: "cpr", event: "pause", cycleNumber: c.cycleNumber, elapsed });
    }
  }

  // CPR compression:breath guidance based on rescuers, ETT, and patient type
  function getCprGuidance(): string {
    const hasETT = s.breathing === "ETT";
    if (hasETT) return t("cpr.guidanceETT");
    if (s.rescuers === "Team") return "";
    if (s.type === "pediatric" && s.rescuers === "Two") return t("cpr.guidancePedsTwo");
    return t("cpr.guidanceDefault");
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
        onStopCode={() => setConfirmStopOpen(true)}
      />

      <AnimatedReveal
        visible={cpr.active}
        enterClass="cr-cpr-enter"
        exitClass="cr-cpr-exit"
        style={{ padding: "8px 12px 0" }}
      >
        <CRCprPill
          cpr={cpr}
          onPause={toggleCprPause}
          guidance={getCprGuidance()}
          rescuers={s.rescuers}
          patientType={s.type}
          onRescuers={(v) => setRescuers(v)}
        />
      </AnimatedReveal>

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
        <div className="cr-patient-grid">
          <CRSection className="cr-s-status" title={t("patient.status.section")}>
            <CRStatusRow
              label={t("field.alert")}
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
            <CRStatusRow
              label={t("field.breathing")}
              uncertain={s.breathing === "?"}
              flashKey={flashTargets.has("breathing") ? flashKey : null}
            >
              {s.breathing === "ETT" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      padding: "3px 10px",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    ETT
                  </span>
                  <button
                    onClick={() => setBreathing("?")}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--ink-3)",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                    }}
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
            <AnimatedReveal visible={s.alert !== "Yes"}>
              <CRStatusRow
                label={t("field.pulse")}
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
            </AnimatedReveal>
            <AnimatedReveal visible={s.pulse === "Yes"}>
              <CRStatusRow
                label={t("field.heartRate")}
                uncertain={s.rate === "?"}
                flashKey={flashTargets.has("rate") ? flashKey : null}
              >
                <CRDropdown
                  value={s.rate}
                  options={CR_OPTS_RATE}
                  onChange={setRate}
                  tone="auto"
                  buttonGroup
                />
              </CRStatusRow>
            </AnimatedReveal>
            <AnimatedReveal
              visible={
                s.pulse === "Yes" &&
                (s.rate === "Fast" || s.rate === "Slow") &&
                s.alert !== "No" &&
                s.alert !== "Altered"
              }
            >
              <CRStatusRow
                label={t("field.symptomatic")}
                uncertain={s.symptomatic === "?"}
                onInfo={() => setPopup("symptomatic")}
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
            </AnimatedReveal>
            {/* Rhythm row — two AnimatedReveal blocks, at most one visible at a time. */}
            <AnimatedReveal
              visible={
                s.pulse !== "Yes" &&
                (s.pulse === "No" || cpr.active) &&
                (s.doneTasks["get-aed"] === true || cpr.active)
              }
            >
              <CRStatusRow
                label={t("field.rhythm")}
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
                  wrapGroup
                />
              </CRStatusRow>
            </AnimatedReveal>
            <AnimatedReveal
              visible={
                s.pulse === "Yes" &&
                s.rate !== "?" &&
                s.rate !== "Normal"
              }
            >
              <CRStatusRow
                label={t("field.rhythm")}
                uncertain={s.rhythm === "?"}
                onInfo={() => setPopup("rhythm")}
                flashKey={flashTargets.has("rhythm") ? flashKey : null}
              >
                <CRDropdown
                  key={s.rate === "Fast" ? "tach" : "brady"}
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
                  wrapGroup
                />
              </CRStatusRow>
            </AnimatedReveal>
            {/* Sepsis Concern — shown when sinus tachycardia is identified */}
            <AnimatedReveal visible={s.pulse === "Yes" && s.rate === "Fast" && s.rhythm === "NSR"}>
              <CRStatusRow
                label="Sepsis Concern?"
                uncertain={s.sepsisSuspected === "?"}
                flashKey={flashTargets.has("sepsisSuspected") ? flashKey : null}
              >
                <CRDropdown
                  value={s.sepsisSuspected}
                  options={[
                    { value: "Yes", label: t("common.yes") },
                    { value: "No", label: t("common.no") },
                  ]}
                  onChange={setSepsisSuspected}
                  tone="auto"
                  buttonGroup
                  flashRedKey={flashTargets.has("sepsisSuspected") ? flashKey : null}
                />
              </CRStatusRow>
            </AnimatedReveal>
            {/* Rescuers — shown during cardiac arrest for CPR guidance */}
            <AnimatedReveal
              visible={
                (s.pulse === "No" || cpr.active) &&
                s.breathing !== "ETT" &&
                (s.gave.find((g) => g.key === "epi")?.doses.length ?? 0) === 0
              }
            >
              <CRStatusRow
                label={t("field.rescuers")}
                uncertain={s.rescuers === "?"}
                flashKey={flashTargets.has("rescuers") ? flashKey : null}
              >
                <CRDropdown
                  value={s.rescuers}
                  options={CR_OPTS_RESCUERS}
                  onChange={setRescuers}
                  tone="accent"
                  buttonGroup
                />
              </CRStatusRow>
            </AnimatedReveal>
            {/* Weight — pediatric patients only */}
            {s.type === "pediatric" && (
              <CRStatusRow
                label={t("field.weight")}
                uncertain={s.weightKg == null}
                flashKey={flashTargets.has("weightKg") ? flashKey : null}
              >
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
                    {t("common.kg")}
                  </span>
                </div>
              </CRStatusRow>
            )}
            {/* Glucose + Stroke Sx — shown when alert is Altered and patient has a pulse */}
            <AnimatedReveal visible={s.alert === "Altered" && s.pulse !== "No"}>
              <CRStatusRow
                label={t("field.glucose")}
                uncertain={s.glucose === "?"}
                flashKey={flashTargets.has("glucose") ? flashKey : null}
              >
                <CRDropdown
                  value={s.glucose}
                  options={CR_OPTS_GLUCOSE}
                  onChange={setGlucose}
                  tone="auto"
                  buttonGroup
                  flashRedKey={flashTargets.has("glucose") ? flashKey : null}
                />
              </CRStatusRow>
            </AnimatedReveal>
            <AnimatedReveal visible={s.alert === "Altered" && s.pulse !== "No"}>
              <CRStatusRow
                label={t("field.strokeSx")}
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
            </AnimatedReveal>
          </CRSection>

          <CRSection className="cr-s-next" title={t("nextSteps.section")}>
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
                background: isPillGave ? undefined : "var(--accent-soft)",
                borderTopLeftRadius: isPillGave ? undefined : 14,
                borderTopRightRadius: isPillGave ? undefined : 14,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: isPillGave ? "var(--ink-3)" : "var(--accent)",
                }}
              >
                {t("interventions.section")}
              </h2>
              <CRGaveSearch onPick={(k) => giveMed(k)} recKeys={recKeys} patient={s} onUpdatePatient={update} />
            </div>

            {/* List/Grid Container */}
            <div style={{ padding: isPillGave ? 0 : undefined }}>
              <CRGaveList
                state={s}
                recKeys={recKeys}
                onGive={giveMed}
                onUpdatePatient={update}
                onLayoutChange={setIsPillGave}
                lastAction={lastAction}
              />
            </div>
          </div>
        </div>
      </div>

      {roscPopup && <CRRoscModal onClose={() => setRoscPopup(false)} />}
      {popup && (
        <CRPopupModal type={popup} patient={s} onClose={() => setPopup(null)} />
      )}
      {infoOpen && <CRInfoModal onClose={() => setInfoOpen(false)} />}
      {confirmStopOpen && (
        <CRStopConfirmationModal
          onConfirm={stopCode}
          onClose={() => setConfirmStopOpen(false)}
        />
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
  onStopCode,
}: CRPatientHeaderProps) {
  const { t } = useTranslation();
  // Self-managed 1 s tick — keeps the case-elapsed clock ticking
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const lastLog = patient.log.at(-1) ?? null;
  const lastLogAt = lastLog ? lastLog.at : Date.now();
  const lastNonStatusLog =
    [...patient.log]
      .reverse()
      .find((entry) => entry.type !== "status" && entry.type !== "note") ??
    null;
  const isCodeEnded =
    lastNonStatusLog?.type === "cpr" &&
    (lastNonStatusLog.event === "end" || lastNonStatusLog.event === "rosc");
  const isRecent = !isCodeEnded && Date.now() - lastLogAt < 5 * 60 * 1000;
  const currentTime =
    isRecent || patient.cpr.active
      ? Date.now()
      : isCodeEnded && lastNonStatusLog
        ? lastNonStatusLog.at
        : lastLogAt;
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
            {patient.type === "pediatric" ? t("home.peds") : t("home.adult")} · {crFmt(elapsed)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {!isCodeEnded && (
            <button
              onClick={onStopCode}
              className="cr-btn-stop"
              style={{ ...crIconBtn(), color: "var(--red)" }}
              aria-label={t("header.stopResuscitation")}
            >
              <CRIcon name="stop-sign" size={20} color="var(--red)" />
            </button>
          )}
          <button onClick={onOpenLog} style={crIconBtn()}>
            <CRIcon name="clock-history" size={20} />
          </button>
          <button onClick={onInfo} style={crIconBtn()}>
            <CRIcon name="info" size={20} />
          </button>
          <CRPatientLangSwitcher />
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// CRCprPill
//
// Collapsed: status pill showing the CPR timer, cycle badge, and
// pause/resume button. Tapping anywhere except the pause button
// opens a full-screen animated overlay with CPR guidance.
//
// Expanded overlay:
//   - Header row mirrors the collapsed pill
//   - Rescuers button group updates patient state via onRescuers
//   - Pediatric patients get an Infant / Child sub-toggle
//   - Guidance section per rescuer count (ratio, technique, depth)
//   - Compression rate tapper (BPM between last two taps)
//   - Auto-collapses + plays a beep when elapsed ≥ 2:00
// ─────────────────────────────────────────────────────────────
export function CRCprPill({
  cpr,
  onPause,
  guidance: _guidance,
  rescuers,
  patientType,
  onRescuers,
}: CRCprPillProps) {
  const { t } = useTranslation();
  const paused = !!cpr.pausedAt;

  // Self-managed 250ms tick — only runs while CPR is active and not paused
  const [, setTick] = useState(0);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [paused]);

  const elapsed =
    cpr.active && !cpr.pausedAt
      ? Date.now() - cpr.cycleStartAt
      : cpr.pausedAt
        ? cpr.pausedAt - cpr.cycleStartAt
        : 0;
  const past = !paused && elapsed >= 120000;
  const near = !paused && !past && elapsed >= 105000;
  const cls = near ? "cr-near-2min" : "";

  // ── resize observer for pause/resume label ────────────────
  const pillRef = useRef<HTMLDivElement>(null);
  const [showLabel, setShowLabel] = useState(true);
  useEffect(() => {
    const el = pillRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.offsetWidth;
      setShowLabel(width >= 260);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── overlay open/close with CSS transition animation ──────
  const [overlayMounted, setOverlayMounted] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Captured pill position so the overlay snaps to exactly where the pill is
  const pillTopRef = useRef<number>(0);

  /** Opens the expanded guidance overlay, anchored to the pill's screen position. */
  function openOverlay() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (pillRef.current) {
      pillTopRef.current = pillRef.current.getBoundingClientRect().top;
    }
    setOverlayMounted(true);
    // Double rAF ensures the CSS transition fires after the element mounts
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setOverlayVisible(true)),
    );
  }

  /** Closes the overlay after the CSS transition completes. */
  function closeOverlay() {
    setOverlayVisible(false);
    closeTimerRef.current = setTimeout(() => setOverlayMounted(false), 300);
  }

  // ── pediatric sub-toggle ──────────────────────────────────
  const [pedAge, setPedAge] = useState<"infant" | "child">("child");

  // ── compression rate tapper ───────────────────────────────
  const [lastTap, setLastTap] = useState<number | null>(null);
  const [comprRate, setComprRate] = useState<number | null>(null);

  /** Records a tap; computes BPM between last two taps. Resets if >10 s idle. Rate < 50 means taps too far apart. */
  function handleComprTap() {
    const now = Date.now();
    if (lastTap !== null && now - lastTap < 10000) {
      const rate = Math.round(60000 / (now - lastTap));
      setComprRate(rate >= 50 ? rate : null);
    } else {
      setComprRate(null);
    }
    setLastTap(now);
  }

  // ── auto-collapse + 2-minute beep ────────────────────────
  const hasFiredRef = useRef(false);
  useEffect(() => {
    if (past && !hasFiredRef.current) {
      hasFiredRef.current = true;
      closeOverlay();
      try {
        const Ctx =
          window.AudioContext ??
          (window as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          // Two-tone alert: high then low
          ([880, 660] as const).forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.value = freq;
            const t = ctx.currentTime + i * 0.35;
            gain.gain.setValueAtTime(0.5, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.start(t);
            osc.stop(t + 0.3);
          });
          setTimeout(() => ctx.close(), 1000);
        }
      } catch {
        /* AudioContext unavailable in this environment */
      }
    }
    if (!past) hasFiredRef.current = false;
  }, [past]);

  // ── computed colors ───────────────────────────────────────
  const bg = paused
    ? "var(--surface-2)"
    : past
      ? "var(--red)"
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
      ? "rgba(255,255,255,0.9)"
      : "color-mix(in srgb, var(--red) 80%, white)";
  const badgeLabel = paused
    ? t("cpr.pausedBadge", { cycle: cpr.cycleNumber })
    : t("cpr.badge", { cycle: cpr.cycleNumber });

  // ── metronome ─────────────────────────────────────────────
  const period = 500;
  const since = Date.now() - cpr.metronomeAnchor;
  const beatIndex = Math.floor(since / period);

  // ── guidance helpers ──────────────────────────────────────
  const isPeds = patientType === "pediatric";
  const isInfant = isPeds && pedAge === "infant";

  function depthLabel(): string {
    return isInfant ? t("cpr.depthInfant") : t("cpr.depthChild");
  }

  function ratioLabel(): string {
    if (rescuers === "Team") return t("cpr.ratioTeam");
    if (isPeds && rescuers === "Two") return t("cpr.ratio15_2");
    return t("cpr.ratio30_2");
  }

  function techniqueLabel(): string {
    if (rescuers === "Team") return t("cpr.techniqueTeam");
    if (isInfant) {
      return rescuers === "Two"
        ? t("cpr.techniqueInfantTwo")
        : t("cpr.techniqueInfantOne");
    }
    if (isPeds) return t("cpr.techniquePeds");
    return t("cpr.techniqueAdult");
  }

  function breathLabel(): string {
    if (rescuers === "Team") return t("cpr.breathsTeam");
    if (isPeds && rescuers === "Two") return t("cpr.breathsPedsTwo");
    return t("cpr.breathsDefault");
  }

  const rateColor =
    comprRate === null
      ? "var(--ink-3)"
      : comprRate >= 100 && comprRate <= 120
        ? "var(--green)"
        : "var(--red)";

  // ── shared pill / header bar JSX ──────────────────────────
  const pauseBtn = (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onPause();
        if (!paused) closeOverlay();
      }}
      aria-label={paused ? t("cpr.resume") : t("cpr.pause")}
      style={{
        ...crCprBtn(past),
        width: "auto",
        minWidth: 34,
        padding: "0 10px",
        fontSize: 12,
        fontWeight: 700,
        gap: 5,
        display: "flex",
        flexDirection: "row",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <CRIcon
        name={paused ? "play" : "pause"}
        size={14}
        color={past ? "var(--red)" : "var(--ink)"}
      />
      {showLabel && (
        <span style={{ whiteSpace: "nowrap" }}>
          {paused ? t("cpr.resume") : t("cpr.pause")}
        </span>
      )}
    </button>
  );

  const metronomeDot = !paused ? (
    <span
      key={beatIndex}
      style={{
        flexShrink: 0,
        display: "inline-block",
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: past ? "white" : "var(--red)",
        animation: "crMetronome 500ms linear",
      }}
    />
  ) : null;

  const badgeEl = (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.08em",
        padding: "3px 7px",
        borderRadius: 6,
        background: badgeBg,
        color: past ? "var(--red)" : "white",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {badgeLabel}
    </div>
  );

  return (
    <>
      {/* ── Collapsed pill ── */}
      <div
        ref={pillRef}
        className={cls}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px 8px 10px",
          borderRadius: 14,
          background: bg,
          border: `1px solid ${border}`,
          color: ink,
          cursor: "pointer",
        }}
        onClick={openOverlay}
      >
        {/* Chevron toggle */}
        <CRIcon name="chevron-right" size={15} color={ink} />

        {badgeEl}

        {/* Timer */}
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

        {/* / 2:00 + "Tap to expand" hint */}
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
              color: past ? "rgba(255,255,255,0.7)" : "var(--ink-3)",
              opacity: past ? 0.7 : 1,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            / 2:00
          </span>
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
            {t("cpr.tapToExpand")}
          </span>
        </div>

        {metronomeDot}
        {pauseBtn}
      </div>

      {/* ── Expanded overlay ── */}
      {overlayMounted && (
        <div
          style={{
            position: "fixed",
            top: pillTopRef.current,
            left: 12,
            right: 12,
            bottom: 0,
            zIndex: 100,
            background: "var(--bg)",
            border: `1px solid ${border}`,
            borderRadius: 14,
            color: "var(--ink)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            opacity: overlayVisible ? 1 : 0,
            transform: overlayVisible
              ? "translateY(0) scale(1)"
              : "translateY(12px) scale(0.98)",
            transition:
              "opacity 260ms cubic-bezier(0.4,0,0.2,1), transform 260ms cubic-bezier(0.4,0,0.2,1)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {/* ── Header — solid red when past 2 min ── */}
          <div
            className={cls}
            onClick={closeOverlay}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 10px 10px 12px",
              borderBottom: `1px solid ${border}`,
              background: bg,
              color: ink,
              flexShrink: 0,
              cursor: "pointer",
            }}
          >
            {/* Collapse chevron — decorative only, whole bar is clickable */}
            <span
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CRIcon
                name="chevron-down"
                size={16}
                color={past ? "white" : "var(--ink)"}
              />
            </span>

            {badgeEl}

            {/* Timer (larger in overlay) */}
            <div
              className="mono"
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {crFmt(elapsed)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: past ? "rgba(255,255,255,0.7)" : "var(--ink-3)",
                  opacity: 0.8,
                }}
              >
                / 2:00
              </span>
            </div>

            {metronomeDot}
            {pauseBtn}
          </div>

          {/* ── Scrollable body ── */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {/* Rescuers + peds age selectors */}
            <div
              style={{
                padding: "12px 14px",
                borderBottom: `1px solid var(--line)`,
                background: "var(--surface-2)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--ink-3)",
                }}
              >
                {t("cpr.rescuers")}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["One", "Two", "Team"] as RescuersValue[]).map((v) => {
                  const labels: Record<string, string> = {
                    One: t("cpr.rescuerOne"),
                    Two: t("cpr.rescuerTwo"),
                    Team: t("opt.codeTeam"),
                  };
                  const active = rescuers === v;
                  return (
                    <button
                      key={v}
                      onClick={() => onRescuers(v)}
                      style={{
                        padding: "7px 16px",
                        borderRadius: 22,
                        border: `1.5px solid ${active ? "var(--accent)" : "var(--line-strong)"}`,
                        background: active
                          ? "var(--accent-soft)"
                          : "var(--surface)",
                        color: active ? "var(--accent)" : "var(--ink-2)",
                        fontSize: 13,
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 160ms ease",
                      }}
                    >
                      {labels[v]}
                    </button>
                  );
                })}
              </div>

              {/* Pediatric infant / child sub-toggle */}
              {isPeds && (
                <>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--ink-3)",
                    }}
                  >
                    {t("cpr.ageGroup")}
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["child", "infant"] as const).map((age: "child" | "infant") => {
                      const active = pedAge === age;
                      return (
                        <button
                          key={age}
                          onClick={() => setPedAge(age)}
                          style={{
                            padding: "7px 16px",
                            borderRadius: 22,
                            border: `1.5px solid ${active ? "var(--accent)" : "rgba(0,0,0,0.15)"}`,
                            background: active
                              ? "var(--accent-soft)"
                              : "rgba(255,255,255,0.55)",
                            color: active ? "var(--accent)" : "var(--ink-2)",
                            fontSize: 13,
                            fontWeight: active ? 700 : 500,
                            cursor: "pointer",
                            transition: "all 160ms ease",
                            textTransform: "capitalize",
                          }}
                        >
                          {t(`cpr.${age}`)}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Guidance content */}
            <div
              style={{
                padding: "16px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
                background: "rgba(255,255,255,0.55)",
                margin: 12,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              {/* Good compressions checklist */}
              <div>
                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--ink-3)",
                  }}
                >
                  {t("cpr.goodCompressions")}
                </p>
                {[
                  t("cpr.rateItem"),
                  depthLabel(),
                  t("cpr.recoil"),
                  t("cpr.interruptions"),
                  t("cpr.firmSurface"),
                ].map((item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      marginBottom: 7,
                    }}
                  >
                    <span
                      style={{
                        color: "var(--green)",
                        fontWeight: 800,
                        fontSize: 13,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      ✓
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        color: "var(--ink-2)",
                        lineHeight: 1.45,
                      }}
                    >
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              {/* Per-rescuer protocol */}
              <div>
                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--ink-3)",
                  }}
                >
                  {rescuers === "?"
                    ? t("cpr.selectRescuers")
                    : rescuers === "Team"
                      ? t("cpr.codeTeamProtocol")
                      : isInfant
                        ? t("cpr.protocolInfant", { rescuers })
                        : isPeds
                          ? t("cpr.protocolChild", { rescuers })
                          : t("cpr.protocol", { rescuers })}
                </p>
                {rescuers !== "?" && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {[
                      { label: t("cpr.ratio"), value: ratioLabel() },
                      { label: t("cpr.technique"), value: techniqueLabel() },
                      { label: t("cpr.breaths"), value: breathLabel() },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            width: 72,
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--ink-3)",
                            flexShrink: 0,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            paddingTop: 2,
                          }}
                        >
                          {label}
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            color: "var(--ink)",
                            lineHeight: 1.45,
                            fontWeight: label === "Ratio" ? 700 : 400,
                          }}
                        >
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Compression rate tapper */}
              <div>
                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--ink-3)",
                  }}
                >
                  {t("cpr.compressionRate")}
                </p>
                <button
                  onClick={handleComprTap}
                  style={{
                    width: "100%",
                    padding: "18px 16px",
                    borderRadius: 12,
                    border: `1.5px solid ${comprRate !== null ? rateColor : "var(--line-strong)"}`,
                    background:
                      comprRate !== null
                        ? `color-mix(in srgb, ${rateColor} 8%, white)`
                        : "white",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 5,
                    transition: "all 120ms ease",
                  }}
                >
                  {comprRate !== null ? (
                    <>
                      <span
                        style={{
                          fontSize: 40,
                          fontWeight: 800,
                          color: rateColor,
                          letterSpacing: "-0.03em",
                          fontFamily: "monospace",
                          lineHeight: 1,
                        }}
                      >
                        {comprRate}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--ink-3)",
                          fontWeight: 600,
                        }}
                      >
                        / min ·{" "}
                        {comprRate >= 100 && comprRate <= 120
                          ? t("cpr.goodRate")
                          : comprRate < 100
                            ? t("cpr.tooSlow")
                            : t("cpr.tooFast")}
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 24 }}>👆</span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--ink-2)",
                        }}
                      >
                        {lastTap !== null
                          ? t("cpr.tapAgain")
                          : t("cpr.tapToCount")}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
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
  const { t: tr } = useTranslation();
  const [activeTask, setActiveTask] = useState<NextTask | null>(null);

  const isFirstRender = useRef(true);
  const prevTaskIds = useRef<Set<string>>(new Set());
  const newTaskIds = useMemo(() => {
    if (isFirstRender.current) return new Set<string>();
    const ids = new Set<string>();
    for (const t of tasks) {
      if (!prevTaskIds.current.has(t.id)) ids.add(t.id);
    }
    return ids;
  }, [tasks]);
  useEffect(() => {
    isFirstRender.current = false;
    prevTaskIds.current = new Set(tasks.map((t) => t.id));
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div
        style={{ padding: "18px 14px", color: "var(--ink-3)", fontSize: 14 }}
      >
        {tr("nextSteps.empty")}
      </div>
    );
  }
  return (
    <div>
      {tasks.map((t, i) => {
        const critical = t.kind === "critical";
        const shock = t.kind === "shock";
        const isFading = fading[t.id];
        const isNew = newTaskIds.has(t.id);
        return (
          <div
            key={t.id}
            className={isFading ? "cr-fade" : isNew ? "cr-task-new" : ""}
            onClick={
              t.popup || t.medKey || t.id === "shock" || t.id === "cardiovert"
                ? () => setActiveTask(t)
                : !t.recurring
                  ? () => onCheck(t)
                  : undefined
            }
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
              cursor:
                t.popup ||
                t.medKey ||
                t.id === "shock" ||
                t.id === "cardiovert" ||
                !t.recurring
                  ? "pointer"
                  : undefined,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (
                  t.recurring &&
                  (t.popup ||
                    t.medKey ||
                    t.id === "shock" ||
                    t.id === "cardiovert")
                ) {
                  setActiveTask(t);
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
              {t.labelKey
                ? tr(t.labelKey, { ...t.labelParams, defaultValue: t.label })
                : tr(`task.${t.id}`, { defaultValue: t.label })}
            </div>
            {(t.popup ||
              t.medKey ||
              t.id === "shock" ||
              t.id === "cardiovert") && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTask(t);
                }}
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
            {critical &&
              !t.popup &&
              !t.medKey &&
              t.id !== "shock" &&
              t.id !== "cardiovert" &&
              t.id !== "start-cpr" &&
              t.id !== "resume-cpr" && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "var(--red)",
                    textTransform: "uppercase",
                  }}
                >
                  {tr("common.now")}
                </span>
              )}
          </div>
        );
      })}
      {activeTask &&
        (activeTask.medKey && activeTask.medKey !== "shock" ? (
          <CRMedDetailModal
            medKey={activeTask.medKey}
            patient={patient}
            onClose={() => setActiveTask(null)}
            onTrigger={
              !activeTask.recurring
                ? () => {
                    onCheck(activeTask);
                    setActiveTask(null);
                  }
                : undefined
            }
            triggerLabel={
              !activeTask.recurring
                ? activeTask.medKey
                  ? CR_CONTINUOUS_KEYS.has(activeTask.medKey)
                    ? `${(patient.gave.find((g) => g.key === activeTask.medKey)?.doses.length ?? 0) % 2 === 1 ? "Stop" : "Start"} ${activeTask.label}`
                    : `+1 ${CR_MED_BY_KEY[activeTask.medKey]?.name ?? activeTask.label}`
                  : activeTask.label
                : undefined
            }
          />
        ) : activeTask.popup ||
          activeTask.id === "shock" ||
          activeTask.id === "cardiovert" ? (
          <CRPopupModal
            type={
              activeTask.id === "shock" || activeTask.id === "cardiovert"
                ? "shock"
                : (activeTask.popup as
                    | "shock"
                    | "ht"
                    | "strokeSx"
                    | "strokeScale"
                    | "rhythm"
                    | "symptomatic"
                    | "rescueBreaths"
                    | "choking"
                    | "sinusTachDiff"
                    | "lactate")
            }
            patient={patient}
            onClose={() => setActiveTask(null)}
            onTrigger={
              !activeTask.recurring
                ? () => {
                    onCheck(activeTask);
                    setActiveTask(null);
                  }
                : undefined
            }
            triggerLabel={
              !activeTask.recurring
                ? activeTask.id === "shock"
                  ? tr("action.shock")
                  : activeTask.id === "cardiovert"
                    ? tr("action.cardiovert")
                    : activeTask.label
                : undefined
            }
          />
        ) : null)}
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
  onUpdatePatient,
}: CRGaveListProps) {
  const { t } = useTranslation();
  // Self-managed 1 s tick — keeps "time since last dose" counters updating
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const lastLog = state.log.at(-1) ?? null;
  const lastLogAt = lastLog ? lastLog.at : Date.now();
  const lastNonStatusLog =
    [...state.log]
      .reverse()
      .find((entry) => entry.type !== "status" && entry.type !== "note") ??
    null;
  const isCodeEnded =
    lastNonStatusLog?.type === "cpr" &&
    (lastNonStatusLog.event === "end" || lastNonStatusLog.event === "rosc");
  const isRecent = !isCodeEnded && Date.now() - lastLogAt < 5 * 60 * 1000;
  const currentTime =
    isRecent || state.cpr.active
      ? Date.now()
      : isCodeEnded && lastNonStatusLog
        ? lastNonStatusLog.at
        : lastLogAt;

  const givenKeys = state.gave
    .filter((g) => g.doses.length > 0)
    .sort((a, b) => Math.min(...a.doses) - Math.min(...b.doses))
    .map((g) => g.key);
  const keys = givenKeys;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isPills, setIsPills] = useState(false);

  const [historyMed, setHistoryMed] = useState<MedKey | null>(null);

  // Per-key animation counter — bumped on each give to restart count animation
  const [countKeys, setCountKeys] = useState<Record<string, number>>({});

  useEffect(() => {
    if (lastAction) {
      const { key } = lastAction;
      setCountKeys((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
    }
  }, [lastAction]);

  /** Delegates med give to parent handler. */
  function handleGive(k: MedKey) {
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
        {t("interventions.empty")}
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
            onClick={() => setHistoryMed(k)}
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
                    cursor: "pointer",
                  }
                : {
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 10px 10px 12px",
                    borderBottom:
                      i === keys.length - 1 ? "none" : "1px solid var(--line)",
                    cursor: "pointer",
                  }
            }
          >
            {isContinuous ? (
              /* Play / Pause button — stopPropagation keeps row click from opening modal */
              <button
                onClick={(e) => { e.stopPropagation(); handleGive(k); }}
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
              /* Dose count badge — same coloring as the old +1 button */
              <span
                key={countKeys[k]}
                className={countKeys[k] ? "mono cr-count-wipe" : "mono"}
                style={{
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
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {count > 0 ? `${count}x` : "—"}
              </span>
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
                {t(`med.${k}`, { defaultValue: med?.name ?? String(k) })}
              </span>
            </div>
            {/* (?) info button */}
            <button
              onClick={(e) => { e.stopPropagation(); setHistoryMed(k); }}
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink-3)",
                flexShrink: 0,
                padding: 0,
              }}
            >
              <CRIcon name="question" size={15} color="var(--ink-3)" />
            </button>
            {/* Right side: elapsed timer for continuous (when active), or time-since-last-dose */}
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
      {historyMed && (
        <CRMedHistoryModal
          medKey={historyMed}
          patient={state}
          onClose={() => setHistoryMed(null)}
          onUpdatePatient={onUpdatePatient}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CRMedHistoryModal — dosing info + editable dose history
// ─────────────────────────────────────────────────────────────
function CRMedHistoryModal({
  medKey,
  patient,
  onClose,
  onUpdatePatient,
}: {
  medKey: MedKey;
  patient: Patient;
  onClose: () => void;
  onUpdatePatient: (mut: (p: Patient) => Patient) => void;
}) {
  const { t } = useTranslation();
  const isContinuous = CR_CONTINUOUS_KEYS.has(medKey);
  const isShock = medKey === "shock";
  const med = CR_MED_BY_KEY[medKey];
  const detail = MED_DETAILS[medKey];
  const isPeds = patient.type === "pediatric";
  const wt = patient.weightKg;

  const medEntries = patient.log.filter(
    (e): e is MedLogEntry => e.type === "med" && e.key === medKey,
  );

  const doseRow = patient.gave.find((g) => g.key === medKey);
  const isCurrentlyActive = isContinuous && (doseRow?.doses.length ?? 0) % 2 === 1;

  function deleteEntry(at: number) {
    onUpdatePatient((p) => ({
      ...p,
      log: p.log.filter(
        (e) => !(e.type === "med" && e.key === medKey && e.at === at),
      ),
    }));
  }

  function addDiscreteEntry(at: number) {
    onUpdatePatient((p) => {
      const entry: LogEntry = {
        type: "med",
        action: "give",
        key: medKey as DiscreteMedKey,
        at,
      };
      return { ...p, log: [...p.log, entry].sort((a, b) => a.at - b.at) };
    });
  }

  function addContinuousEntry(action: "start" | "stop") {
    const at = Date.now();
    onUpdatePatient((p) => {
      const entry: LogEntry = {
        type: "med",
        action,
        key: medKey as ContinuousMedKey,
        at,
      };
      return { ...p, log: [...p.log, entry].sort((a, b) => a.at - b.at) };
    });
  }

  const title = isShock
    ? t("modal.shock.title")
    : t(`med.${medKey}`, { defaultValue: med?.name ?? String(medKey) });

  // Build dosing detail content (shown above history)
  let dosingSection: React.ReactNode = null;
  if (isShock) {
    dosingSection = (
      <>
        {isPeds && wt != null && (
          <div
            style={{
              background: "var(--accent-soft)",
              borderRadius: 8,
              padding: "5px 10px",
              marginBottom: 12,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t("modal.shock.pedsFor", {
              wt,
              first: (wt * 2).toFixed(0),
              second: (wt * 4).toFixed(0),
            })}
          </div>
        )}
        {isPeds ? (
          <>
            <p style={{ marginTop: 0, fontWeight: 600 }}>
              {t("modal.shock.pedsDefib")}
            </p>
            <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
              <li>
                {t("modal.shock.peds1st", { value: "2" })}
                {wt ? ` = ${(wt * 2).toFixed(0)} J` : ""}
              </li>
              <li>
                {t("modal.shock.peds2nd", { value: "4" })}
                {wt ? ` = ${(wt * 4).toFixed(0)} J` : ""}
              </li>
              <li>{t("modal.shock.pedsSubseq")}</li>
            </ul>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              {t("modal.shock.pedsCV")}
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>{t("modal.shock.pedsSvt")}</li>
              <li>{t("modal.shock.pedsVT")}</li>
            </ul>
          </>
        ) : (
          <>
            <p style={{ marginTop: 0, fontWeight: 600 }}>
              {t("modal.shock.adultDefib")}
            </p>
            <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
              <li>
                <strong>{t("modal.shock.adultBiphasic").split(":")[0]}:</strong>{" "}
                {t("modal.shock.adultBiphasic").split(":").slice(1).join(":")}
              </li>
              <li>
                <strong>{t("modal.shock.adultMono").split(":")[0]}:</strong>{" "}
                {t("modal.shock.adultMono").split(":").slice(1).join(":")}
              </li>
              <li>{t("modal.shock.adult2nd")}</li>
            </ul>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              {t("modal.shock.adultCV")}
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>{t("modal.shock.adultAFSVT")}</li>
              <li>{t("modal.shock.adultVT")}</li>
            </ul>
          </>
        )}
      </>
    );
  } else if (detail) {
    const primaryDose =
      detail.sharedDose ?? (isPeds ? detail.pedsDose : detail.adultDose);
    const primaryDoseKey = detail.sharedDose
      ? `medDetail.${medKey}.sharedDose`
      : isPeds
        ? `medDetail.${medKey}.pedsDose`
        : `medDetail.${medKey}.adultDose`;
    const displayDose = primaryDose
      ? t(primaryDoseKey, { defaultValue: primaryDose })
      : primaryDose;
    const secondaryDose = isPeds ? detail.adultDose : detail.pedsDose;
    const secondaryDoseKey = isPeds
      ? `medDetail.${medKey}.adultDose`
      : `medDetail.${medKey}.pedsDose`;
    const displaySecondaryDose = secondaryDose
      ? t(secondaryDoseKey, { defaultValue: secondaryDose })
      : secondaryDose;
    const weightCalc =
      isPeds && wt != null && detail.pedsDoseCalc
        ? detail.pedsDoseCalc(wt)
        : null;

    dosingSection = (
      <>
        {displayDose && (
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>
              {detail.sharedDose
                ? t("medDetail.dose")
                : isPeds
                  ? t("medDetail.peds")
                  : t("medDetail.adult")}
              :
            </span>{" "}
            {displayDose}
          </div>
        )}
        {weightCalc && (
          <div
            style={{
              background: "var(--accent-soft)",
              borderRadius: 8,
              padding: "5px 10px",
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t("medDetail.for", { wt: wt ?? 0, dose: weightCalc ?? "" })}
          </div>
        )}
        {!detail.sharedDose && displaySecondaryDose && (
          <div style={{ marginBottom: 8, color: "var(--ink-3)", fontSize: 12 }}>
            <span style={{ fontWeight: 600 }}>
              {isPeds ? t("medDetail.adult") : t("medDetail.peds")}:
            </span>{" "}
            {displaySecondaryDose}
          </div>
        )}
        {detail.freq && (
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>{t("medDetail.frequency")}:</span>{" "}
            {detail.freq}
          </div>
        )}
        {detail.route && (
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>{t("medDetail.route")}:</span>{" "}
            {t(`medDetail.${medKey}.route`, { defaultValue: detail.route })}
          </div>
        )}
        {detail.notes && detail.notes.length > 0 && (
          <ul style={{ margin: "8px 0 0", paddingLeft: 16, lineHeight: 1.6 }}>
            {detail.notes.map((note, i) => (
              <li key={i}>{t(`medDetail.${medKey}.note${i}`, { defaultValue: note })}</li>
            ))}
          </ul>
        )}
      </>
    );
  }

  const count = medEntries.length;

  function addNow() {
    if (isContinuous) return;
    addDiscreteEntry(Date.now());
  }

  function deleteLast() {
    if (medEntries.length === 0) return;
    deleteEntry(medEntries[medEntries.length - 1].at);
  }

  const titleRight = !isContinuous ? (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 6 }}>
      {count > 0 && (
        <span
          className="mono"
          style={{
            minWidth: 36,
            height: 26,
            padding: "0 8px",
            borderRadius: 7,
            background: "#fff",
            border: `1.5px solid ${isShock ? "var(--shock)" : "var(--accent)"}`,
            color: isShock ? "var(--shock)" : "var(--accent)",
            fontSize: 13,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {count}x
        </span>
      )}
      <div
        style={{
          display: "inline-flex",
          border: "1px solid var(--line-strong)",
          borderRadius: 7,
          overflow: "hidden",
        }}
      >
        <button
          onClick={deleteLast}
          disabled={count === 0}
          style={{
            width: 30,
            height: 26,
            background: "transparent",
            border: "none",
            borderRight: "1px solid var(--line-strong)",
            cursor: count === 0 ? "default" : "pointer",
            fontSize: 16,
            color: count === 0 ? "var(--ink-3)" : "var(--ink-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
          }}
        >
          −
        </button>
        <button
          onClick={addNow}
          style={{
            width: 30,
            height: 26,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 16,
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
          }}
        >
          +
        </button>
      </div>
    </div>
  ) : null;

  return (
    <CRModalShell title={title} onClose={onClose} titleRight={titleRight}>
      {/* Dosing info */}
      {dosingSection && (
        <>
          {dosingSection}
          <hr
            style={{
              border: "none",
              borderTop: "1px solid var(--line)",
              margin: "14px 0 12px",
            }}
          />
        </>
      )}

      {/* Entry list */}
      <div>
        {medEntries.length === 0 ? (
          <div style={{ color: "var(--ink-3)", fontSize: 13, padding: "8px 0" }}>
            {t("interventions.noDoses")}
          </div>
        ) : (
          medEntries.map((entry, i) => {
            const n = isContinuous ? Math.floor(i / 2) + 1 : i + 1;
            const label = isContinuous
              ? t(i % 2 === 0 ? "interventions.startLabel" : "interventions.stopLabel", { n })
              : t("interventions.doseLabel", { n });
            const d = new Date(entry.at);
            const h = d.getHours();
            const m = d.getMinutes().toString().padStart(2, "0");
            const ampm = h >= 12 ? "PM" : "AM";
            const h12 = h % 12 || 12;
            const timeLabel = `${h12}:${m} ${ampm}`;
            return (
              <div
                key={entry.at}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 0",
                  borderBottom:
                    i < medEntries.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 13, color: "var(--ink-2)", flex: 1 }}
                >
                  {timeLabel}
                  <span style={{ color: "var(--ink-3)", marginLeft: 8, fontSize: 12 }}>
                    {label}
                  </span>
                </span>
                <button
                  onClick={() => deleteEntry(entry.at)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: "transparent",
                    border: "1px solid var(--line)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ink-3)",
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Continuous-only controls */}
      {isContinuous && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={() => addContinuousEntry(isCurrentlyActive ? "stop" : "start")}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1.5px solid var(--accent)",
              background: isCurrentlyActive ? "transparent" : "var(--accent)",
              color: isCurrentlyActive ? "var(--accent)" : "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {isCurrentlyActive ? t("interventions.stopNow") : t("interventions.startNow")}
          </button>
        </div>
      )}
    </CRModalShell>
  );
}

// ─────────────────────────────────────────────────────────────
// CRAddInterventionModal — searchable full-modal add screen
// ─────────────────────────────────────────────────────────────
const ADD_SECTIONS: { labelKey: string; cat: string }[] = [
  { labelKey: "addIntervention.electrical", cat: "Electrical" },
  { labelKey: "addIntervention.meds", cat: "Code" },
  { labelKey: "addIntervention.infusions", cat: "Drip" },
  { labelKey: "addIntervention.blood", cat: "Blood" },
];

function CRAddInterventionModal({
  recKeys,
  patient,
  onPick,
  onClose,
  onUpdatePatient,
}: {
  recKeys: Set<MedKey>;
  patient: Patient;
  onPick: (key: MedKey) => void;
  onClose: () => void;
  onUpdatePatient: (mut: (p: Patient) => Patient) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmKey, setConfirmKey] = useState<MedKey | null>(null);
  const [historyKey, setHistoryKey] = useState<MedKey | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const searching = q.trim().length > 0;

  function toggleSection(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function isSectionOpen(label: string) {
    return searching || expanded.has(label);
  }

  function handleAction(key: MedKey) {
    const isBlood = CR_MED_BY_KEY[key]?.cat === "Blood";
    const isContinuousMed = CR_CONTINUOUS_KEYS.has(key);
    const indicated = recKeys.has(key);
    const gaveRow = gave.find((g) => g.key === key);
    const isCurrentlyActive = isContinuousMed && (gaveRow?.doses.length ?? 0) % 2 === 1;
    // No confirmation needed if: indicated, blood, or stopping an active infusion
    if (!indicated && !isBlood && !isCurrentlyActive) {
      setConfirmKey(key);
    } else {
      onPick(key);
    }
  }

  const gave = patient.gave ?? [];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        background: "rgba(20,18,12,0.55)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "16px 20px 20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: 0,
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px 10px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            placeholder={t("interventions.searchPlaceholder")}
            style={{
              flex: 1,
              height: 34,
              padding: "0 10px",
              borderRadius: 8,
              border: "1px solid var(--line-strong)",
              fontSize: 14,
              background: "var(--surface)",
              color: "var(--ink)",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
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
              flexShrink: 0,
            }}
          >
            <CRIcon name="close" size={18} />
          </button>
        </div>

        {/* Sections */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {ADD_SECTIONS.map(({ labelKey, cat }) => {
            const label = t(labelKey);
            const allMeds = CR_MEDS.filter((m) => m.cat === cat);
            const filtered = searching
              ? allMeds.filter(
                  (m) =>
                    m.name.toLowerCase().includes(q.toLowerCase()) ||
                    m.short.toLowerCase().includes(q.toLowerCase()),
                )
              : allMeds;
            if (filtered.length === 0) return null;

            // Sort: indicated first
            const sorted = [...filtered].sort((a, b) => {
              const aRec = recKeys.has(a.key) ? 0 : 1;
              const bRec = recKeys.has(b.key) ? 0 : 1;
              return aRec - bRec;
            });

            const isOpen = isSectionOpen(labelKey);

            return (
              <div key={labelKey} style={{ borderBottom: "1px solid var(--line)" }}>
                {/* Section header */}
                <button
                  onClick={() => !searching && toggleSection(labelKey)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 16px",
                    background: "transparent",
                    border: "none",
                    cursor: searching ? "default" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--ink-3)",
                    }}
                  >
                    {label}
                  </span>
                  {!searching && (
                    <span style={{ color: "var(--ink-3)", fontSize: 12 }}>
                      {isOpen ? "▲" : "▼"}
                    </span>
                  )}
                </button>

                {/* Rows */}
                {isOpen &&
                  sorted.map((med) => {
                    const isBlood = cat === "Blood";
                    const indicated = recKeys.has(med.key);
                    const dimmed = !indicated && !isBlood;
                    const isContinuous = CR_CONTINUOUS_KEYS.has(med.key);
                    const isShockMed = med.key === "shock";
                    const gaveRow = gave.find((g) => g.key === med.key);
                    const count = gaveRow?.doses.length ?? 0;
                    const isActive = isContinuous && count % 2 === 1;
                    const hasDetail =
                      !!MED_DETAILS[med.key] || isShockMed || med.key === "pace";

                    return (
                      <div
                        key={med.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 16px",
                          opacity: dimmed ? 0.45 : 1,
                          borderTop: "1px solid var(--line)",
                        }}
                      >
                        {/* Name */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: isShockMed ? "var(--shock)" : "var(--ink)",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            {isShockMed && (
                              <CRIcon name="bolt" size={13} color="var(--shock)" />
                            )}
                            {t(`med.${med.key}.full`, { defaultValue: t(`med.${med.key}`, { defaultValue: med.name }) })}
                            {indicated && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "var(--accent)",
                                  background: "var(--accent-soft)",
                                  borderRadius: 4,
                                  padding: "1px 5px",
                                  letterSpacing: "0.05em",
                                  textTransform: "uppercase",
                                }}
                              >
                                {t("interventions.indicated")}
                              </span>
                            )}
                          </span>
                        </div>

                        {/* (?) info button */}
                        {hasDetail && (
                          <button
                            onClick={() => setHistoryKey(med.key)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 7,
                              background: "transparent",
                              border: "1px solid var(--line)",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--ink-3)",
                              flexShrink: 0,
                            }}
                          >
                            <CRIcon name="question" size={15} color="var(--ink-3)" />
                          </button>
                        )}

                        {/* Action button */}
                        {isContinuous ? (
                          <button
                            onClick={() => handleAction(med.key)}
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
                              flexShrink: 0,
                            }}
                          >
                            <CRIcon
                              name={isActive ? "pause" : "play"}
                              size={13}
                              color={isActive ? "#fff" : "var(--accent)"}
                            />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction(med.key)}
                            style={{
                              minWidth: 44,
                              height: 30,
                              padding: "0 9px",
                              borderRadius: 7,
                              background:
                                count === 0 && indicated
                                  ? isShockMed
                                    ? "var(--shock)"
                                    : "var(--accent)"
                                  : "#fff",
                              border: `1.5px solid ${isShockMed ? "var(--shock)" : "var(--accent)"}`,
                              color:
                                count === 0 && indicated
                                  ? "#fff"
                                  : isShockMed
                                    ? "var(--shock)"
                                    : "var(--accent)",
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              fontFamily: "inherit",
                            }}
                          >
                            {count > 0 ? `${count}x` : "+"}
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation overlay for non-indicated pick */}
      {confirmKey && (
        <div
          onClick={(e) => { e.stopPropagation(); setConfirmKey(null); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 160,
            background: "rgba(20,18,12,0.4)",
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
              borderRadius: 14,
              padding: 20,
              maxWidth: 300,
              width: "100%",
              boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
            }}
          >
            <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 15 }}>
              {t("addIntervention.notIndicated.title")}
            </p>
            <p style={{ margin: "0 0 16px", color: "var(--ink-2)", fontSize: 13 }}>
              {t("addIntervention.notIndicated.body", { name: CR_MED_BY_KEY[confirmKey]?.name })}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setConfirmKey(null)}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 8,
                  border: "1px solid var(--line-strong)",
                  background: "transparent",
                  color: "var(--ink-2)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => {
                  onPick(confirmKey);
                  setConfirmKey(null);
                }}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t("addIntervention.giveAnyway")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History modal for (?) button */}
      {historyKey && (
        <CRMedHistoryModal
          medKey={historyKey}
          patient={patient}
          onClose={() => setHistoryKey(null)}
          onUpdatePatient={onUpdatePatient}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CRGaveSearch
// ─────────────────────────────────────────────────────────────
export function CRGaveSearch({ onPick, recKeys, patient, onUpdatePatient }: CRGaveSearchProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
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
        <CRIcon name="plus" size={14} /> {t("common.add")}
      </button>
      {open && (
        <CRAddInterventionModal
          recKeys={recKeys}
          patient={patient}
          onUpdatePatient={onUpdatePatient}
          onPick={(k) => { onPick(k); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// CRPopupModal — contextual info overlays for tasks and status rows
// ─────────────────────────────────────────────────────────────
// CRMedDetailModal
// ─────────────────────────────────────────────────────────────
function CRMedDetailModal({
  medKey,
  patient,
  onClose,
  onTrigger,
  triggerLabel,
}: {
  medKey: MedKey;
  patient: Patient;
  onClose: () => void;
  onTrigger?: () => void;
  triggerLabel?: string;
}) {
  const { t } = useTranslation();
  const med = CR_MED_BY_KEY[medKey];
  const detail = MED_DETAILS[medKey];
  if (!detail) return null;

  const isPeds = patient.type === "pediatric";
  const wt = patient.weightKg;

  const primaryDose =
    detail.sharedDose ?? (isPeds ? detail.pedsDose : detail.adultDose);
  const secondaryDose = isPeds ? detail.adultDose : detail.pedsDose;
  const weightCalc =
    isPeds && wt != null && detail.pedsDoseCalc
      ? detail.pedsDoseCalc(wt)
      : null;

  const primaryDoseKey = detail.sharedDose
    ? `medDetail.${medKey}.sharedDose`
    : isPeds
      ? `medDetail.${medKey}.pedsDose`
      : `medDetail.${medKey}.adultDose`;
  const displayDose = primaryDose
    ? t(primaryDoseKey, { defaultValue: primaryDose })
    : primaryDose;
  const secondaryDoseKey = isPeds
    ? `medDetail.${medKey}.adultDose`
    : `medDetail.${medKey}.pedsDose`;
  const displaySecondaryDose = secondaryDose
    ? t(secondaryDoseKey, { defaultValue: secondaryDose })
    : secondaryDose;

  return (
    <CRModalShell title={t(`med.${medKey}`, { defaultValue: med?.name ?? String(medKey) })} onClose={onClose}>
      {displayDose && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 700 }}>
            {detail.sharedDose ? t("medDetail.dose") : isPeds ? t("medDetail.peds") : t("medDetail.adult")}:
          </span>{" "}
          {displayDose}
        </div>
      )}
      {weightCalc && (
        <div
          style={{
            background: "var(--accent-soft)",
            borderRadius: 8,
            padding: "5px 10px",
            marginBottom: 8,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {t("medDetail.for", { wt: wt ?? 0, dose: weightCalc ?? "" })}
        </div>
      )}
      {!detail.sharedDose && displaySecondaryDose && (
        <div style={{ marginBottom: 8, color: "var(--ink-3)", fontSize: 12 }}>
          <span style={{ fontWeight: 600 }}>{isPeds ? t("medDetail.adult") : t("medDetail.peds")}:</span>{" "}
          {displaySecondaryDose}
        </div>
      )}
      {detail.freq && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>{t("medDetail.frequency")}:</span> {detail.freq}
        </div>
      )}
      {detail.route && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>{t("medDetail.route")}:</span>{" "}
          {t(`medDetail.${medKey}.route`, { defaultValue: detail.route })}
        </div>
      )}
      {detail.notes && detail.notes.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 16, lineHeight: 1.6 }}>
          {detail.notes.map((note, i) => (
            <li key={i}>{t(`medDetail.${medKey}.note${i}`, { defaultValue: note })}</li>
          ))}
        </ul>
      )}
      {onTrigger && triggerLabel && (
        <button
          onClick={onTrigger}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "-0.01em",
          }}
        >
          {triggerLabel}
        </button>
      )}
    </CRModalShell>
  );
}

// ─────────────────────────────────────────────────────────────
function CRModalShell({
  title,
  onClose,
  children,
  titleRight,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  titleRight?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
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
          maxWidth: wide ? 480 : 360,
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
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, flex: 1 }}>{title}</h3>
          {titleRight}
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
  onTrigger,
  triggerLabel,
}: {
  type:
    | "shock"
    | "ht"
    | "strokeSx"
    | "strokeScale"
    | "rhythm"
    | "symptomatic"
    | "rescueBreaths"
    | "choking"
    | "sinusTachDiff"
    | "lactate";
  patient: Patient;
  onClose: () => void;
  onTrigger?: () => void;
  triggerLabel?: string;
}) {
  const { t } = useTranslation();
  const isPeds = patient.type === "pediatric";
  const wt = patient.weightKg;

  if (type === "shock") {
    return (
      <CRModalShell title={t("modal.shock.title")} onClose={onClose}>
        {isPeds && wt != null && (
          <div
            style={{
              background: "var(--accent-soft)",
              borderRadius: 8,
              padding: "5px 10px",
              marginBottom: 12,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t("modal.shock.pedsFor", { wt, first: (wt * 2).toFixed(0), second: (wt * 4).toFixed(0) })}
          </div>
        )}
        {isPeds ? (
          <>
            <p style={{ marginTop: 0, fontWeight: 600 }}>
              {t("modal.shock.pedsDefib")}
            </p>
            <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
              <li>
                {t("modal.shock.peds1st", { value: "2" })}
                {wt ? ` = ${(wt * 2).toFixed(0)} J` : ""}
              </li>
              <li>
                {t("modal.shock.peds2nd", { value: "4" })}
                {wt ? ` = ${(wt * 4).toFixed(0)} J` : ""}
              </li>
              <li>{t("modal.shock.pedsSubseq")}</li>
            </ul>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              {t("modal.shock.pedsCV")}
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>{t("modal.shock.pedsSvt")}</li>
              <li>{t("modal.shock.pedsVT")}</li>
            </ul>
          </>
        ) : (
          <>
            <p style={{ marginTop: 0, fontWeight: 600 }}>
              {t("modal.shock.adultDefib")}
            </p>
            <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
              <li><strong>{t("modal.shock.adultBiphasic").split(":")[0]}:</strong> {t("modal.shock.adultBiphasic").split(":").slice(1).join(":")}</li>
              <li><strong>{t("modal.shock.adultMono").split(":")[0]}:</strong> {t("modal.shock.adultMono").split(":").slice(1).join(":")}</li>
              <li>{t("modal.shock.adult2nd")}</li>
            </ul>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              {t("modal.shock.adultCV")}
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>{t("modal.shock.adultAFSVT")}</li>
              <li>{t("modal.shock.adultVT")}</li>
            </ul>
          </>
        )}
        {onTrigger && triggerLabel && (
          <button
            onClick={onTrigger}
            style={{
              marginTop: 16,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 10,
              border: "none",
              background: "var(--shock)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "-0.01em",
            }}
          >
            {triggerLabel}
          </button>
        )}
      </CRModalShell>
    );
  }

  if (type === "ht") {
    return (
      <CRModalShell title={t("modal.ht.title")} onClose={onClose}>
        {isPeds && (
          <div
            style={{
              background: "#fef3c7",
              border: "1px solid #fcd34d",
              borderRadius: 6,
              padding: "7px 12px",
              marginBottom: 12,
              fontWeight: 600,
              fontSize: "0.9em",
              color: "#92400e",
              textAlign: "center",
            }}
          >
            {t("modal.ht.hypoxiaWarning")}
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 16px",
          }}
        >
          <div>
            <p style={{ marginTop: 0, fontWeight: 600 }}>{t("modal.ht.h")}</p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>{t("modal.ht.hypovolemia")}</li>
              <li>{t("modal.ht.hypoxia")}</li>
              <li>{t("modal.ht.hydrogen")}</li>
              <li>{t("modal.ht.kalemia")}</li>
              {isPeds && <li>{t("modal.ht.hypoglycemia")}</li>}
              <li>{t("modal.ht.hypothermia")}</li>
            </ul>
          </div>
          <div>
            <p style={{ marginTop: 0, fontWeight: 600 }}>{t("modal.ht.t")}</p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>{t("modal.ht.tension")}</li>
              <li>{t("modal.ht.tamponade")}</li>
              <li>{t("modal.ht.toxins")}</li>
              <li>{t("modal.ht.pulmonary")}</li>
              <li>{t("modal.ht.coronary")}</li>
            </ul>
          </div>
        </div>
      </CRModalShell>
    );
  }

  if (type === "sinusTachDiff") {
    return (
      <CRModalShell title="Sinus Tachycardia Differential" onClose={onClose}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 16px",
          }}
        >
          <div>
            <p style={{ marginTop: 0, fontWeight: 600 }}>Shock Causes</p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>Sepsis / Septic shock</li>
              <li>Hemorrhage / Hypovolemia</li>
              <li>Pulmonary embolism</li>
              <li>Anaphylaxis / Allergic reaction</li>
              <li>Transfusion reaction (TRALI/TACO)</li>
              <li>Tension pneumothorax</li>
              <li>Cardiac tamponade</li>
              <li>Neurogenic shock</li>
            </ul>
          </div>
          <div>
            <p style={{ marginTop: 0, fontWeight: 600 }}>Other Causes</p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>Hypoxia / hypercapnia</li>
              <li>Pain / anxiety</li>
              <li>Fever / infection (non-septic)</li>
              <li>Hyperthyroidism / thyroid storm</li>
              <li>Drug effect (stimulants, sympathomimetics)</li>
            </ul>
          </div>
        </div>
      </CRModalShell>
    );
  }

  if (type === "lactate") {
    return (
      <CRModalShell title="Serum Lactate" onClose={onClose}>
        <p style={{ marginTop: 0, marginBottom: 8 }}>
          Lactate reflects tissue oxygen debt — elevated levels identify occult
          hypoperfusion even when blood pressure appears normal.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <tbody>
            {[
              ["< 2 mmol/L", "Normal", "var(--ink)"],
              ["2 – 4 mmol/L", "Elevated — suggests hypoperfusion; resuscitate and recheck", "var(--amber, #d97706)"],
              ["≥ 4 mmol/L", "Septic shock criteria (even without hypotension)", "var(--red)"],
            ].map(([range, meaning, color]) => (
              <tr key={range} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "6px 8px 6px 0", fontWeight: 600, color, whiteSpace: "nowrap" }}>{range}</td>
                <td style={{ padding: "6px 0 6px 8px", color: "var(--ink-2)" }}>{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 10, marginBottom: 0, color: "var(--ink-3)", fontSize: 12 }}>
          If initial lactate ≥ 2: repeat within 2 hours — target &gt; 10% clearance as a sign of response.
          Part of CMS SEP-1 Hour-1 Bundle.
        </p>
        {onTrigger && triggerLabel && (
          <button
            onClick={onTrigger}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "10px 0",
              borderRadius: 10,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {triggerLabel}
          </button>
        )}
      </CRModalShell>
    );
  }

  if (type === "strokeSx") {
    return (
      <CRModalShell title={t("modal.strokeSx.title")} onClose={onClose}>
        <p style={{ marginTop: 0, fontWeight: 600 }}>
          {t("modal.strokeSx.cpss")}
        </p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
          <li>{t("modal.strokeSx.facial")}</li>
          <li>{t("modal.strokeSx.arm")}</li>
          <li>{t("modal.strokeSx.speech")}</li>
        </ul>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{t("modal.strokeSx.other")}</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>{t("modal.strokeSx.vision")}</li>
          <li>{t("modal.strokeSx.headache")}</li>
          <li>{t("modal.strokeSx.balance")}</li>
        </ul>
        <p style={{ marginTop: 10, marginBottom: 0, color: "var(--ink-3)", fontSize: 12 }}>
          {t("modal.strokeSx.note")}
        </p>
      </CRModalShell>
    );
  }

  if (type === "strokeScale") {
    return (
      <CRModalShell title={t("modal.strokeScale.title")} onClose={onClose}>
        <p style={{ marginTop: 0, fontWeight: 600 }}>{t("modal.strokeScale.fast")}</p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
          <li>{t("modal.strokeScale.face")}</li>
          <li>{t("modal.strokeScale.arms")}</li>
          <li>{t("modal.strokeScale.speechItem")}</li>
          <li>{t("modal.strokeScale.time")}</li>
        </ul>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{t("modal.strokeScale.nihss")}</p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
          <li>{t("modal.strokeScale.loc")}</li>
          <li>{t("modal.strokeScale.gaze")}</li>
          <li>{t("modal.strokeScale.facial")}</li>
          <li>{t("modal.strokeScale.motor")}</li>
          <li>{t("modal.strokeScale.other")}</li>
        </ul>
        <p style={{ marginBottom: 0, color: "var(--ink-3)", fontSize: 12 }}>
          {t("modal.strokeScale.score")}
        </p>
      </CRModalShell>
    );
  }

  if (type === "rhythm") {
    const rhythmEntries = [
      { name: "VF", descKey: "modal.rhythm.vf" },
      { name: "pVT", descKey: "modal.rhythm.pvt" },
      { name: "Torsades (TdP)", descKey: "modal.rhythm.tdp" },
      { name: "PEA", descKey: "modal.rhythm.pea" },
      { name: "Asystole", descKey: "modal.rhythm.asystole" },
      { name: "NSR", descKey: "modal.rhythm.nsr" },
      { name: "SVT", descKey: "modal.rhythm.svt" },
      { name: "AF", descKey: "modal.rhythm.af" },
      { name: "Wide VT", descKey: "modal.rhythm.wideVT" },
      { name: "Sinus Brady", descKey: "modal.rhythm.sinusBrady" },
      { name: "1° AVB", descKey: "modal.rhythm.avb1" },
      { name: "2° AVB", descKey: "modal.rhythm.avb2" },
      { name: "3° AVB", descKey: "modal.rhythm.avb3" },
    ];
    return (
      <CRModalShell title={t("modal.rhythm.title")} onClose={onClose}>
        {rhythmEntries.map(({ name, descKey }) => (
          <div key={name} style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{name}</span>
            <span style={{ color: "var(--ink-3)", marginLeft: 6 }}>—</span>
            <span style={{ marginLeft: 6 }}>{t(descKey)}</span>
          </div>
        ))}
      </CRModalShell>
    );
  }

  if (type === "rescueBreaths") {
    return (
      <CRModalShell title={t("modal.rescueBreaths.title")} onClose={onClose}>
        <p style={{ marginTop: 0, fontWeight: 600 }}>
          {isPeds ? t("modal.rescueBreaths.pedsRate") : t("modal.rescueBreaths.adultRate")}
        </p>
        <p style={{ margin: "0 0 10px" }}>
          {isPeds
            ? t("modal.rescueBreaths.pedsRateValue")
            : t("modal.rescueBreaths.adultRateValue")}
        </p>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{t("modal.rescueBreaths.technique")}</p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
          <li>{t("modal.rescueBreaths.openAirway")}</li>
          <li>{isPeds ? t("modal.rescueBreaths.sealMouthNose") : t("modal.rescueBreaths.sealMouth")}</li>
          <li>{t("modal.rescueBreaths.deliver")}</li>
          <li>{t("modal.rescueBreaths.exhale")}</li>
          {isPeds && <li>{t("modal.rescueBreaths.gentle")}</li>}
        </ul>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>
          {t("modal.rescueBreaths.advanced")}
        </p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
          <li>{t("modal.rescueBreaths.advancedRate")}</li>
          <li>{t("modal.rescueBreaths.noPause")}</li>
        </ul>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
          {t("modal.rescueBreaths.reassess")}
        </p>
      </CRModalShell>
    );
  }

  if (type === "symptomatic") {
    const isBrady = patient.rate === "Slow";
    return (
      <CRModalShell title={t("modal.symptomatic.title")} onClose={onClose}>
        <p style={{ marginTop: 0, fontWeight: 600, marginBottom: 8 }}>
          {isBrady ? t("modal.symptomatic.bradyHeading") : t("modal.symptomatic.tachyHeading")}
        </p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
          <li>{t("modal.symptomatic.hypotension")}</li>
          <li>{t("modal.symptomatic.mental")}</li>
          <li>{t("modal.symptomatic.shock")}</li>
          <li>{t("modal.symptomatic.chest")}</li>
          <li>{t("modal.symptomatic.heartFailure")}</li>
        </ul>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
          {isBrady ? t("modal.symptomatic.bradyNote") : t("modal.symptomatic.tachyNote")}
        </p>
      </CRModalShell>
    );
  }

  if (type === "choking") {
    return (
      <CRModalShell title={t("modal.choking.title")} onClose={onClose}>
        <p style={{ marginTop: 0, fontWeight: 600 }}>
          {t("modal.choking.cycle")}
        </p>
        <ol style={{ margin: "0 0 12px", paddingLeft: 18 }}>
          <li>{t("modal.choking.backBlows")}</li>
          <li>{isPeds ? t("modal.choking.abdominalPeds") : t("modal.choking.abdominalAdult")}</li>
        </ol>
        {isPeds && (
          <div
            style={{
              background: "#fef3c7",
              border: "1px solid #fcd34d",
              borderRadius: 6,
              padding: "7px 12px",
              marginBottom: 12,
              fontSize: "0.9em",
              color: "#92400e",
            }}
          >
            {t("modal.choking.infantNote")}
          </div>
        )}
        <p style={{ fontWeight: 600, marginBottom: 4 }}>
          {t("modal.choking.unresponsive")}
        </p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
          <li>{t("modal.choking.lowerToGround")}</li>
          <li>{t("modal.choking.lookForObject")}</li>
        </ul>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
          {t("modal.choking.reassess")}
        </p>
      </CRModalShell>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// CRRoscModal — shown when ROSC is obtained
// ─────────────────────────────────────────────────────────────
function CRRoscModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
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
          maxWidth: 500,
          width: "100%",
          boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
          maxHeight: "90vh",
          overflowY: "auto",
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
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "var(--green)",
            }}
          >
            {t("modal.rosc.title")}
          </h3>
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
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 14,
            color: "var(--ink-2)",
            lineHeight: 1.5,
          }}
        >
          {t("modal.rosc.body")}
        </p>
        <img
          src={`${import.meta.env.BASE_URL}guidelines/pcac-Figure-1-Adult-PCAC-Algorithm.jpg`}
          alt="Adult Post-Cardiac Arrest Care Algorithm"
          style={{ width: "100%", borderRadius: 10, display: "block" }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CRInfoModal
// ─────────────────────────────────────────────────────────────
export function CRInfoModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
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
          maxWidth: 480,
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
            {t("modal.info.title")}
          </h3>
          <button onClick={onClose} style={crIconBtn()}>
            <CRIcon name="close" size={20} />
          </button>
        </div>
        <div
          style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)" }}
        >
          <p style={{ marginTop: 0, marginBottom: "1em" }}>
            <strong style={{ color: "var(--red)" }}>
              {t("modal.info.notDevice")}
            </strong>{" "}
            {t("modal.info.body1")}
          </p>
          <p style={{ marginBottom: "1em" }}>{t("modal.info.body2")}</p>
          <p style={{ marginBottom: "1em" }}>
            {t("home.disclaimer.before")}{" "}
            <a
              href="https://cpr.heart.org/en/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}
            >
              {t("home.disclaimer.ahaName")}
            </a>
            {t("home.disclaimer.after")}
          </p>
          <p style={{ marginBottom: 0, color: "var(--ink-3)", fontSize: 12 }}>
            {t("modal.info.version")}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CRStopConfirmationModal — shown to confirm stopping the code
// ─────────────────────────────────────────────────────────────
function CRStopConfirmationModal({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
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
          padding: 20,
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div
            style={
              {
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "var(--red-soft)",
                color: "var(--red)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                "--stop-fill-opacity": 1,
              } as React.CSSProperties
            }
          >
            <CRIcon name="stop-sign" size={24} color="var(--red)" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "var(--ink)",
              }}
            >
              {t("modal.stop.title")}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "var(--ink-3)",
                lineHeight: 1.4,
              }}
            >
              {t("modal.stop.body")}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            marginTop: 4,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--line-strong)",
              background: "#fff",
              color: "var(--ink-2)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--red)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("modal.stop.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
