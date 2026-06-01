# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # TypeScript check + Vite production build
npm run preview      # Preview production build locally
npm run test         # Run all tests (reconstruct + algorithms)
npm run test:reconstruct   # Test state reconstruction logic
npm run test:algorithms    # Test clinical algorithm logic
```

Tests use `tsx` directly (no test framework) — they `console.log` pass/fail and `process.exit(1)` on failure.

## Architecture

This is a React + TypeScript PWA (Vite + Tailwind v4). No backend — all state lives in `localStorage`.

### Event-sourced patient state

The central design pattern: **patient state is never stored directly**. The `Patient` object stores only an append-only `log: LogEntry[]`. Every time state is needed, `reconstructStateFromLog(p)` in [`src/utils.ts`](src/utils.ts) replays the log from scratch to derive current state. This means `patient.tsx` always calls `reconstructStateFromLog` before rendering.

Mutations append to the log — never mutate fields directly on the Patient object.

### Data flow

1. [`src/types.ts`](src/types.ts) — all types. `LogEntry` is a discriminated union (type + field/action/event). `Patient` is the stored shape. `NextTask` is what the algorithm returns.
2. [`src/data.ts`](src/data.ts) — medication definitions (`CR_MEDS`, `MED_DETAILS`) and the **rules engine** (`crNextTasks`). `crNextTasks(patient)` is the core clinical decision function — given reconstructed state, returns the ordered list of recommended next actions.
3. [`src/utils.ts`](src/utils.ts) — `reconstructStateFromLog`, `formatLogEntry`, time formatting helpers, and legacy migration detection.
4. [`src/components/app.tsx`](src/components/app.tsx) — root component; owns the `patients` array in state, persists to `localStorage` (key `cr_patients_v2`), handles screen routing (home / patient / log).
5. [`src/components/patient.tsx`](src/components/patient.tsx) — the main clinical screen. Status dropdowns, next-task panel, CPR timer, medication panel.
6. [`src/components/home.tsx`](src/components/home.tsx) — patient list, new patient creation.
7. [`src/components/log.tsx`](src/components/log.tsx) — scrollable event log with note entry.
8. [`src/components/ui.tsx`](src/components/ui.tsx) — shared UI primitives (`CRDropdown`, `CRSection`, `CRStatusRow`, `CRIcon`).

### Key invariants

- **State reconstruction on load**: `loadPatients()` in `app.tsx` calls `reconstructStateFromLog` on every patient loaded from storage — so derived fields (pulse, symptomatic, etc.) are always recomputed, never trusted from storage.
- **Implicit field transitions**: Changing one status field can silently reset others (e.g., setting `pulse = Yes` resets `rhythm = ?`; setting `rhythm` to a shockable rhythm forces `pulse = No`). All transitions live in `reconstructStateFromLog`.
- **`symptomatic` is always derived**: Never set directly by the user. `reconstructStateFromLog` auto-sets it based on `alert`, `pulse`, and `rate`.
- **CPR state machine**: Managed via `cpr` log entries (`start`, `pause`, `resume`, `sync`, `rosc`, `end`). The `metronomeAnchor` timestamp drives the 100 bpm metronome sound.
- **Continuous vs discrete meds**: `CR_CONTINUOUS_KEYS` distinguishes drips (start/stop) from bolus meds (+1 count). Use `CR_CONTINUOUS_KEYS.has(key)` to branch behavior.

### Clinical logic

All ACLS/PALS algorithm logic is in `crNextTasks()` in `src/data.ts`. When modifying clinical recommendations, also update [`docs/conditional-task-logic.md`](docs/conditional-task-logic.md) — it documents every guard condition and is used for external clinical validation.
