# CodeRunner — Conditional Task Logic Reference

This document enumerates every condition that controls whether a task appears,
is hidden, or changes behaviour in the CodeRunner app. It is intended for
external validation of the clinical decision logic.

**Primary sources:**
- `src/data.ts` — `crNextTasks()` task generation engine (lines 391–793)
- `src/utils.ts` — state reconstruction and implicit field transitions (lines 17–199)
- `src/components/patient.tsx` — task execution handlers and UI visibility guards

---

## 1. Task Generation Engine (`crNextTasks`)

`crNextTasks()` in `src/data.ts` inspects the reconstructed patient state `s`
and returns an ordered list of recommended tasks. Tasks omitted from the return
value are not shown to the user.

### 1.1 Pre-computed Derived Values

Before any pathway logic runs, several values are derived from the log:

```
shockable      = rhythm ∈ {VF, VT, VF_pVT}
aedDone        = doneTasks["get-aed"] === true
shockCount     = number of "shock" doses given
shockDoses     = timestamps of every shock
epiDoses       = timestamps of every epinephrine dose
amioDoses      = timestamps of every amiodarone dose
lidoDoses      = timestamps of every lidocaine dose
adenoDoses     = timestamps of every adenosine dose
atropineDoses  = timestamps of every atropine dose
lastLogAt      = timestamp of the most recent log entry
isRecent       = now − lastLogAt < 5 min
refTime        = isRecent || cpr.active ? now : lastLogAt
roscDone       = doneTasks["rosc"] === true
```

`refTime` is used instead of `now` for timing checks when the case has been
idle for more than 5 minutes, preventing stale sessions from producing
incorrect "medication due" states.

---

### 1.2 Initial Assessment Tasks

These appear before any pathway is entered to establish baseline information.

| Task | Condition to show |
|------|-------------------|
| `check-alert` | `alert === "?"` |
| `check-breath` | `breathing === "?"` |
| `check-pulse` | `pulse === "?" && !cpr.active && alert !== "Yes"` |
| `check-rate` | `pulse === "Yes" && rate === "?"` |
| `check-rhythm` | `pulse === "Yes" && rate ∈ {Fast, Slow} && rhythm === "?"` |
| `check-symptomatic` | `pulse === "Yes" && rate ∈ {Fast, Slow} && alert ∉ {No, Altered} && symptomatic === "?"` |
| `check-weight` | `type === "pediatric" && weightKg == null` |

---

### 1.3 Cardiac Arrest Pathway

**Entry condition:** `pulse === "No" || cpr.active`

#### 1.3.1 Always-shown task within pathway

| Task | Condition |
|------|-----------|
| `get-aed` | `!aedDone` |

#### 1.3.2 Medication Readiness

**Epinephrine (`epi`)**

```
epiReady =
  epiDoses.length === 0
    ? (!shockable || shockCount >= 2)   // first dose: no shock needed unless shockable (requires 2 shocks)
    : refTime − epiDoses[last] >= 3 min // repeat: ≥ 3 min since last dose
```

Shown when: `epiReady && !roscDone`

**Amiodarone (`amio`)**

```
amioReady =
  amioDoses.length === 0
    || refTime − amioDoses[last] >= 5 min
```

Shown when: `shockable && shockCount >= 3 && amioReady`

Dose logic:
- First dose → 300 mg
- Repeat dose → 150 mg

**Lidocaine (`lido`)** (alternative antiarrhythmic)

```
lidoReady =
  lidoDoses.length === 0
    || refTime − lidoDoses[last] >= 5 min
```

Shown when: `shockable && shockCount >= 3 && lidoReady`

#### 1.3.3 Pre-CPR State (`!cpr.active`)

| Task | Condition |
|------|-----------|
| `shock` | `shockable && aedDone` |
| `start-cpr` | Always; label changes to "Single Rescuer" when `rescuers === "Two" && !aedDone` |

#### 1.3.4 CPR Paused State (`cpr.pausedAt` is set)

The paused state follows **three mutually exclusive branches** evaluated in order:

**Branch 1 — ROSC detected** (`pulse === "Yes"`):

| Task | Notes |
|------|-------|
| `rosc` | Only task shown in this branch |

**Branch 2 — Pulse or rhythm unknown** (`pulse === "?" || rhythm === "?"`):

| Task | Notes |
|------|-------|
| `pulse-rhythm-check` | Shown unless shock-during-pause suppression applies |
| `resume-cpr` | Shown instead of `pulse-rhythm-check` when a shock was delivered in this pause window and `pulse === "No"` |

**Shock-during-pause suppression rule** (`src/data.ts` lines 566–573):
If `lastShockDose > cpr.pausedAt && pulse === "No"`, skip the rhythm check and
show `resume-cpr` directly (ACLS protocol: resume CPR immediately after shock).

**Branch 3 — Pulse No, rhythm known** (all other cases):

| Task | Condition |
|------|-----------|
| `shock` | `shockable && aedDone` |
| `epi` / `amio` / `lido` | Per medication readiness rules (§ 1.3.2) |
| `reversible` (H's & T's) | Always — `recurring: true` |
| `airway` | `breathing !== "ETT"` |
| `access` | `!doneTasks["access"]` |
| `resume-cpr` | Always |

#### 1.3.5 CPR Running State (`cpr.active && !cpr.pausedAt`)

```
shockBeforeCpr = shockDoses.some(d => d < cpr.cycleStartAt)
```

| Task | Condition |
|------|-----------|
| `pause-to-shock` | `shockable && aedDone && !shockBeforeCpr` |
| `pause-pulse-check` | `pulse === "Yes"` — label: "Pause CPR (Patient responsive)" if `alert === "Yes"`, else "Pause CPR (Pulse detected)" |
| `pause-pulse-check` | `rhythm === "NSR" && pulse !== "Yes"` — label: "Pause for Pulse Check" (same task ID, different label) |
| `pause-pulse-check` | `now − cpr.cycleStartAt >= 120 000 ms && pulse !== "Yes" && rhythm !== "NSR" && !(shockable && aedDone && !shockBeforeCpr)` — label: "Pause for Rhythm Check" (2-minute ACLS cycle) |
| `airway` | `breathing !== "ETT"` |
| `access` | `!doneTasks["access"]` |
| `epi` / `amio` / `lido` | `pulse === "No" && rhythm !== "?"` — per medication readiness rules (§ 1.3.2) |
| `reversible` (H's & T's) | Always — `recurring: true` |

#### 1.3.6 Rescuer confirmation (all cardiac arrest states)

`check-rescuers` is evaluated **outside** all three CPR sub-states and can appear
even before CPR starts:

| Task | Condition |
|------|-----------|
| `check-rescuers` | `rescuers === "?" && breathing !== "ETT" && epiDoses.length === 0` |

---

### 1.4 Respiratory Arrest Pathway

**Entry condition:** `breathing === "No" && pulse !== "No" && !cpr.active`

| Task | Condition |
|------|-----------|
| `opioid-reversal` | Always |
| `rescue-breaths` | `pulse === "Yes"` — `recurring: true` |

---

### 1.5 Pacing Wean

**Condition:** `rate === "Fast" && given("pace") % 2 === 1`

The modulo-2 check determines if pacing is currently active (odd start/stop count = running).

- Task: `wean-pacing` — `recurring: true`

---

### 1.6 Tachycardia Pathway

**Entry condition:** `pulse === "Yes" && rate === "Fast" && symptomatic === "Yes"`

These tasks appear for **all** rhythms when the entry condition is met:

| Task | Condition |
|------|-----------|
| `ecg` | Always |
| `access` | `!doneTasks["access"]` |

**SVT sub-pathway** (`rhythm === "SVT"`):

```
adenoGiven = adenoDoses.length
```

| Task | Condition |
|------|-----------|
| `adenosine` | `adenoGiven < 3` — dose: 6 mg (1st), 12 mg (2nd+) |
| `cardiovert` | `rhythm ∈ {AF, SVT, WideTach}` |

**Wide tachycardia sub-pathway** (`rhythm === "WideTach"`):

```
amioReadyTach =
  amioDoses.length === 0
    || refTime − amioDoses[last] >= 5 min
```

| Task | Condition | Dose |
|------|-----------|------|
| `amio` | `amioReadyTach` | 150 mg over 10 min (both 1st and repeat doses — slower rate than arrest amio) |
| `cardiovert` | `rhythm ∈ {AF, SVT, WideTach}` | — |

**AF sub-pathway** (`rhythm === "AF"`): only `cardiovert` shown.

---

### 1.7 Bradycardia Pathway

**Entry condition:** `pulse === "Yes" && rate === "Slow" && symptomatic === "Yes"`

```
atropineReady =
  atropineDoses.length === 0
    || now − atropineDoses[last] >= 3 min
```

| Task | Condition |
|------|-----------|
| `access` | Always |
| `atropine` | `given("atropine") < 3 && atropineReady` |
| `pace` | `given("pace") === 0` |
| `dopamine` | `given("dopamine") === 0` |

---

### 1.8 Altered Alertness Pathway

**Entry condition:** `alert === "Altered" && pulse !== "No"`

| Task | Condition |
|------|-----------|
| `glucose` | `glucose === "?"` |
| `d50` | `glucose === "Low"` |
| `check-stroke-sx` | `strokeSx === "?"` |
| `fast` | `strokeSx === "Yes"` |
| `ct` | `strokeSx === "Yes"` |

---

### 1.9 Choking Pathway

**Entry condition:** `breathing === "Choking"`

| Task | Condition | Recurring |
|------|-----------|-----------|
| `choking-cycles` | Always | Yes |
| `reassess-responsiveness` | Always | Yes |

---

### 1.10 Task Filtering and Priority Sort

After all pathways generate their task lists:

```
filtered = tasks.filter(t => t.recurring || !doneTasks[t.id])
```

Recurring tasks always remain visible. Non-recurring tasks are hidden once
`doneTasks[taskId] === true`.

**Priority order** (lower index = higher priority, `src/data.ts` lines 327–375):

1. Cardiac arrest actions: `shock`, `cardiovert`, `pause-to-shock`, `start-cpr`, `rosc`, `resume-cpr`, `pause-pulse-check`, `pause-nsr-check`, `pulse-rhythm-check`
2. Respiratory arrest: `rescue-breaths`, `opioid-reversal`
3. Cardiac support: `get-aed`, `airway`, `epi`, `amio`, `lido`, `access`, `reversible`, `check-rescuers`, `meds-support`
4. Tachycardia: `ecg`, `adenosine`
5. Bradycardia: `atropine`, `pace`, `dopamine`, `wean-pacing`
6. Altered/stroke: `glucose`, `d50`, `check-stroke-sx`, `fast`, `ct`
7. Choking: `choking-cycles`, `reassess-responsiveness`
8. Assessment: `check-alert`, `check-breath`, `check-pulse`, `check-rate`, `check-rhythm`, `check-symptomatic`
9. Lowest: `check-weight`

Tasks not found in the priority list are appended after all prioritised tasks,
preserving their relative order.

---

## 2. State Reconstruction — Implicit Field Transitions (`src/utils.ts`)

The patient state is fully reconstructed by replaying the log. Several status
field changes trigger automatic secondary changes.

### 2.1 Alert field changes

| New `alert` value | Secondary effect |
|-------------------|-----------------|
| `"No"` or `"Altered"` (from `"Yes"`) | `pulse = "?"` |
| `"Sedated"` | Only set implicitly when `breathing` is set to `"ETT"` |

### 2.2 Breathing field changes

| New `breathing` value | Secondary effect |
|-----------------------|-----------------|
| `"ETT"` | `alert = "Sedated"` |

### 2.3 Pulse field changes

| New `pulse` value | Secondary effect |
|-------------------|-----------------|
| `"Yes"` | `rhythm = "?"` |
| `"?"` or `"No"` | `rate = "?"` |
| `"No"` | Also `rhythm = "?"` |

### 2.4 Rate field changes

| Trigger | Secondary effect |
|---------|-----------------|
| `rate` changes to a new value | `rhythm = "?"` |

### 2.5 Rhythm field changes

| New `rhythm` value | Secondary effect |
|-------------------|-----------------|
| `VT`, `VF`, `VF_pVT`, `PEA`, or `Asystole` | `pulse = "No"` |

### 2.6 Shock delivery

Giving a shock always resets `rhythm = "?"`.

### 2.7 Post-reconstruction overrides (applied after log replay)

**Alert "Yes" override:**
```
if alert === "Yes" → force pulse = "Yes"
```

**Symptomatic auto-promotion:**
```
if pulse === "Yes" && rate ∈ {Fast, Slow}:
  if alert ∈ {No, Altered}: symptomatic = "Yes"   // patient cannot self-report
else:
  symptomatic = "?"                                 // reset when not applicable
```

### 2.8 Medication type validation

Medications are categorised as either **discrete** or **continuous**:

| Category | Medications | Valid `action` |
|----------|-------------|----------------|
| Discrete | epi, amio, lido, adenosine, atropine, d50, naloxone | `"give"` |
| Continuous | dopamine, norepinephrine, vasopressin, procainamide, pacing (`pace`) | `"start"` / `"stop"` |

Log entries that use the wrong action for a medication type are ignored during
reconstruction.

### 2.9 CPR state transitions

| Log event | State change |
|-----------|-------------|
| `cpr.start` | `cpr.active = true`, `cpr.cycleNumber = 1`, resets `pulse = "?"`, `rhythm = "?"`, sets `cycleStartAt` |
| `cpr.resume` | `cpr.cycleNumber++`, clears `pausedAt`, resets `pulse = "?"`, `rhythm = "?"` |
| `cpr.pause` | Sets `pausedAt` timestamp, preserves `active = true` |
| `cpr.sync` | Updates metronome anchor timestamp |
| `cpr.rosc` / `cpr.end` | `cpr.active = false`, clears `pausedAt` |

### 2.10 Task completion side effects

| Task completed | Side effects |
|----------------|-------------|
| `airway` | `breathing = "ETT"`, `alert = "Sedated"` |
| Any other task | `doneTasks[taskId] = true` |

---

## 3. Medication Active-State Logic (`src/components/patient.tsx`)

Continuous medications use start/stop log entries. Active state is determined by:

```
isActive = isContinuous && count % 2 === 1
```

- Odd count (1, 3, 5…) → medication is currently **running**
- Even count (0, 2, 4…) → medication is currently **stopped**

**Pacing special case** (on each `pace` log entry):
- If pacing is being **stopped** (`isActive` before the stop), or if `rate !== "Fast"`:
  reset `rate = "?"` and `rhythm = "?"`

**Adenosine/Atropine special case** (on each `give` entry):
- Immediately reset `rate = "?"` and `rhythm = "?"` (patient re-assessed after bolus)

---

## 4. CPR Guidance Text Conditions

`getCprGuidance()` in `src/components/patient.tsx` determines the compression/ventilation
ratio label displayed during CPR:

| Condition | Displayed guidance |
|-----------|--------------------|
| `breathing === "ETT" && type === "pediatric"` | `"Continuous · 1 breath/2-3s"` |
| `breathing === "ETT" && type !== "pediatric"` | `"Continuous · 1 breath/6s"` |
| `rescuers === "Team"` | *(empty — team manages own ratio)* |
| `type === "pediatric" && rescuers === "Two"` | `"Ratio = 15:2"` |
| All other cases | `"Ratio = 30:2"` |

---

## 5. CPR Cycle Timer Alert Thresholds

The CPR overlay tracks elapsed time within the current cycle:

```
elapsed = cpr.active && !cpr.pausedAt
  ? Date.now() − cpr.cycleStartAt
  : cpr.pausedAt ? cpr.pausedAt − cpr.cycleStartAt : 0

near = !paused && elapsed >= 1 min 45 s   // warning state
past = !paused && elapsed >= 2 min        // alert state; triggers auto-collapse + 2-tone beep
```

---

## 6. Status Field Visibility Guards

The following table summarises when each editable status field is rendered in the UI:

| Field | Visible when | Disabled when |
|-------|-------------|---------------|
| `alert` | Always | — |
| `breathing` | Always | — |
| `pulse` | `alert !== "Yes"` | `cpr.active && !cpr.pausedAt` |
| `rate` | `pulse === "Yes"` | — |
| `symptomatic` | `pulse === "Yes" && rate ∈ {Fast,Slow} && alert ∉ {No, Altered}` | — |
| `rhythm` (arrest options) | `pulse !== "Yes" && (pulse === "No" \|\| cpr.active) && (aedDone \|\| cpr.active)` | — |
| `rhythm` (pulse options) | `pulse === "Yes" && rate !== "?" && rate !== "Normal"` | — |
| `rescuers` | `(pulse === "No" \|\| cpr.active) && breathing !== "ETT" && epiDoses.length === 0` | — |
| `weightKg` | `type === "pediatric"` | — |
| `glucose` | `alert === "Altered" && pulse !== "No"` | — |
| `strokeSx` | `alert === "Altered" && pulse !== "No"` | — |

Rhythm option sets by context:

- **Arrest rhythm** options: VF/VT, PEA, Asystole, NSR
- **Fast pulse** options: SVT, AF, Wide VT
- **Slow pulse** options: Sinus Bradycardia, 1° AVB, 2° AVB, 3° AVB
- **Normal pulse** options: NSR, AF

---

## 7. Quick-Reference: Task Guard Summary

| Task | Pathway entry | Additional guards | Recurring |
|------|---------------|-------------------|-----------|
| `check-alert` | `alert === "?"` | — | No |
| `check-breath` | `breathing === "?"` | — | No |
| `check-pulse` | `pulse === "?" && alert !== "Yes"` | `!cpr.active` | No |
| `check-rate` | `pulse === "Yes"` | `rate === "?"` | No |
| `check-rhythm` | `pulse === "Yes" && rate ∈ {Fast,Slow}` | `rhythm === "?"` | No |
| `check-symptomatic` | `pulse === "Yes" && rate ∈ {Fast,Slow}` | `alert ∉ {No,Altered} && symptomatic === "?"` | No |
| `check-weight` | `type === "pediatric"` | `weightKg == null` | No |
| `get-aed` | `pulse === "No" \|\| cpr.active` | `!aedDone` | No |
| `start-cpr` | `pulse === "No" \|\| cpr.active` | `!cpr.active` | No |
| `shock` (pre-CPR) | `pulse === "No" \|\| cpr.active` | `shockable && aedDone && !cpr.active` | No |
| `shock` (paused) | `cpr.pausedAt` | `shockable && aedDone && pulse === "No"` | No |
| `pause-to-shock` | `cpr.active && !cpr.pausedAt` | `shockable && aedDone && !shockBeforeCpr` | No |
| `pause-pulse-check` | `cpr.active && !cpr.pausedAt` | `pulse === "Yes"` | No |
| `pause-pulse-check` (NSR) | `cpr.active && !cpr.pausedAt` | `rhythm === "NSR" && pulse !== "Yes"` — same task ID as above, label: "Pause for Pulse Check" | No |
| `pause-pulse-check` (2-min) | `cpr.active && !cpr.pausedAt` | `now − cpr.cycleStartAt >= 120 000 ms && pulse !== "Yes" && rhythm !== "NSR" && !(shockable && aedDone && !shockBeforeCpr)` — label: "Pause for Rhythm Check" | No |
| `resume-cpr` | `cpr.pausedAt` (branch 3 only) | `pulse === "No" && rhythm !== "?"` | No |
| `rosc` | `cpr.pausedAt` (branch 1) | `pulse === "Yes"` | No |
| `pulse-rhythm-check` | `cpr.pausedAt` (branch 2) | `pulse === "?" \|\| rhythm === "?"` (suppressed if shock-during-pause with pulse "No") | No |
| `epi` | `pulse === "No" \|\| cpr.active` | `epiReady && !roscDone` | No |
| `amio` (arrest) | `pulse === "No" \|\| cpr.active` | `shockable && shockCount >= 3 && amioReady` | No |
| `lido` | `pulse === "No" \|\| cpr.active` | `shockable && shockCount >= 3 && lidoReady` | No |
| `reversible` | `cpr.active` (both running and paused branch 3) | Paused: always in branch 3; Running: always | Yes |
| `airway` | `cpr.active` (both running and paused branch 3) | `breathing !== "ETT"` | No |
| `access` | `cpr.active` (both running and paused branch 3); also tach and brady pathways | `!doneTasks["access"]` (arrest); always (tach/brady) | No |
| `check-rescuers` | `pulse === "No" \|\| cpr.active` (all cardiac arrest states, including pre-CPR) | `rescuers === "?" && breathing !== "ETT" && epiDoses.length === 0` | No |
| `rescue-breaths` | `breathing === "No" && pulse !== "No" && !cpr.active` | `pulse === "Yes"` | Yes |
| `opioid-reversal` | `breathing === "No" && pulse !== "No" && !cpr.active` | — | No |
| `wean-pacing` | `rate === "Fast"` | `given("pace") % 2 === 1` | Yes |
| `ecg` | `pulse === "Yes" && rate === "Fast" && symptomatic === "Yes"` | Always within tach pathway | No |
| `access` (tach) | `pulse === "Yes" && rate === "Fast" && symptomatic === "Yes"` | Always within tach pathway | No |
| `adenosine` | `pulse === "Yes" && rate === "Fast" && symptomatic === "Yes"` | `rhythm === "SVT" && adenoGiven < 3` | No |
| `amio` (tach) | `pulse === "Yes" && rate === "Fast" && symptomatic === "Yes"` | `rhythm === "WideTach" && amioReadyTach` | No |
| `cardiovert` | `pulse === "Yes" && rate === "Fast" && symptomatic === "Yes"` | `rhythm ∈ {AF, SVT, WideTach}` | No |
| `access` (brady) | `pulse === "Yes" && rate === "Slow" && symptomatic === "Yes"` | Always within brady pathway | No |
| `atropine` | `pulse === "Yes" && rate === "Slow" && symptomatic === "Yes"` | `given < 3 && atropineReady` | No |
| `pace` | `pulse === "Yes" && rate === "Slow" && symptomatic === "Yes"` | `given("pace") === 0` | No |
| `dopamine` | `pulse === "Yes" && rate === "Slow" && symptomatic === "Yes"` | `given("dopamine") === 0` | No |
| `glucose` | `alert === "Altered" && pulse !== "No"` | `glucose === "?"` | No |
| `d50` | `alert === "Altered" && pulse !== "No"` | `glucose === "Low"` | No |
| `check-stroke-sx` | `alert === "Altered" && pulse !== "No"` | `strokeSx === "?"` | No |
| `fast` | `alert === "Altered" && pulse !== "No"` | `strokeSx === "Yes"` | No |
| `ct` | `alert === "Altered" && pulse !== "No"` | `strokeSx === "Yes"` — note: task ID is `ct`, not `ct-stroke` | No |
| `choking-cycles` | `breathing === "Choking"` | — | Yes |
| `reassess-responsiveness` | `breathing === "Choking"` | — | Yes |
