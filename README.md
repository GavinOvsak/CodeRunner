# CodeRunner — Clinical Resuscitation Reference

**CodeRunner** is a free, web-based tool that guides healthcare providers through ACLS and PALS resuscitation protocols in real time. It calculates weight-based medication doses, tracks CPR cycles, and logs every action automatically — so you can focus on your patient instead of a reference card.

> **Open the app:** [gavinovsak.github.io/CodeRunner](https://gavinovsak.github.io/CodeRunner/)

No download, no login, no installation required. Works on any phone, tablet, or computer — even without an internet connection once the page has loaded.

---

## Who is this for?

CodeRunner is designed for **trained emergency providers** including:

- Emergency physicians and hospitalists managing cardiac arrest or acute arrhythmias
- Nurses and advanced practice providers during code situations
- Paramedics and EMTs in the field
- ACLS/PALS instructors running simulations

> **Important:** CodeRunner is a bedside reference tool, not a replacement for clinical training or judgment. All treatment decisions remain the responsibility of the licensed provider.

---

## What it does

### Walks you through resuscitation algorithms step by step

Based on the patient's current rhythm, pulse, and mental status, CodeRunner displays the next recommended clinical actions — so nothing gets missed during a high-stress code.

Supported pathways include:
- **Cardiac arrest** (VF, pVT, PEA, Asystole) — shocks, CPR, epinephrine, amiodarone/lidocaine, airway, reversible causes (H's & T's)
- **Symptomatic tachycardia** — adenosine, amiodarone, synchronized cardioversion
- **Symptomatic bradycardia** — atropine, transcutaneous pacing, dopamine
- **Altered mental status** — glucose check, dextrose administration, stroke protocol
- **Respiratory arrest** — rescue breathing, naloxone
- **Choking** — back blows and abdominal thrusts cycle guidance

### Calculates pediatric doses automatically

Enter the child's weight in kilograms once, and CodeRunner computes every weight-based dose — epinephrine, amiodarone, defibrillation energy, and more — throughout the resuscitation.

### Tracks CPR cycles with a timer

A built-in timer shows how long the current CPR cycle has been running. The display turns amber when a rhythm check is approaching and red when it is overdue.

### Logs everything as you go

Every assessment, medication, shock, and action is recorded with a timestamp. The log is saved automatically on the device, requires no server, and can serve as a documentation reference after the event.

### Manages multiple patients

The home screen lists all active patients. Tap a patient to return to their record at any time.

---

## Getting started (no coding required)

1. **Open the app** at [gavinovsak.github.io/CodeRunner](https://gavinovsak.github.io/CodeRunner/) on any modern browser.
2. Tap **New Patient** and choose **Adult** or **Pediatric**.
   - For pediatric patients, enter the patient's weight in kilograms.
3. Fill in what you know about the patient's current status — pulse, rhythm, breathing — using the dropdowns at the top of the screen.
4. The **Next Actions** panel updates automatically with recommended steps.
5. Tap any action to mark it done. Medication buttons show the correct dose before you confirm.
6. Use the **Log** tab at any point to review or annotate what has happened.

---

## Installing on your phone (optional)

CodeRunner can be saved to your home screen like a native app:

- **iPhone/iPad:** Open the link in Safari → tap the Share icon → select *Add to Home Screen*
- **Android:** Open the link in Chrome → tap the three-dot menu → select *Add to Home Screen*

Once installed, CodeRunner works fully offline.

---

## Medications covered

CodeRunner includes dosing references for all major resuscitation medications, including:

| Category | Examples |
|---|---|
| Cardiac arrest drugs | Epinephrine, Amiodarone, Lidocaine, Atropine, Sodium bicarbonate, Calcium, Magnesium |
| Tachycardia drugs | Adenosine, Amiodarone |
| Bradycardia drugs | Atropine, Dopamine (infusion) |
| Vasopressors / infusions | Norepinephrine, Vasopressin, Procainamide, Transcutaneous pacing |
| Reversal agents | Naloxone |
| Glucose / metabolic | Dextrose 50% |
| Blood products | pRBC, FFP, Platelets, Cryoprecipitate, Albumin, TXA |

All medications show adult fixed doses and, where applicable, weight-based pediatric doses.

---

## Privacy and data

- **No account needed.** Nothing is collected or transmitted.
- **All data stays on your device.** Patient records are stored in your browser's local storage and never leave your device.
- Clearing your browser data or uninstalling the app will erase all saved patient records.

---

## Frequently asked questions

**Do I need the internet to use this?**
Only to open the app for the first time. After that, it works offline. Installing it to your home screen makes it available even without a network connection.

**Is this approved for clinical use?**
CodeRunner is a reference aid. It follows published ACLS/PALS guidelines, but it has not been cleared by the FDA as a medical device. Clinical decisions are always the provider's responsibility.

**Can I use this during a real code?**
Yes — that is what it is designed for. Open it, create a patient, and follow the prompts.

**What if the patient's rhythm changes mid-resuscitation?**
Update the rhythm field in the Status panel. The recommended next actions will update immediately.

**Will my records be there next time I open the app?**
Yes, as long as you use the same browser on the same device and haven't cleared browser storage.

**Something looks wrong or I have a suggestion.**
Please open an issue at [github.com/gavinovsak/CodeRunner/issues](https://github.com/gavinovsak/CodeRunner/issues).

---

## Reference guidelines

CodeRunner's algorithms are based on the current American Heart Association (AHA) ACLS and PALS guidelines. Embedded reference images from the guidelines are included in the app for quick visual review.

---

## Technical reference

Detailed documentation of the conditional logic that drives task generation,
state transitions, and medication timing is in
[`docs/conditional-task-logic.md`](docs/conditional-task-logic.md).
It covers every guard condition for each task, implicit field transitions,
CPR state machine rules, and the priority sort order — intended for
external validation of the clinical decision logic.

---

*Built for providers, by a provider.*
