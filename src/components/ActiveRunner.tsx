import React from 'react';
import { Activity, ShieldAlert, Zap, RefreshCw, Plus, Play, Pause, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ActiveRunnerProps {
  isRunning: boolean;
  totalElapsedMs: number;
  cprCountdown: number;
  epiCountdown: number;
  formatTime: (ms: number) => string;
  startTimer: () => void;
  pauseTimer: () => void;
  resetCprTimer: () => void;
  resetEpiTimer: () => void;
  rhythmType: 'none' | 'shockable' | 'non-shockable' | 'rosc';
  setRhythmType: (type: 'none' | 'shockable' | 'non-shockable' | 'rosc') => void;
  shockCount: number;
  setShockCount: (count: number | ((prev: number) => number)) => void;
  epiCount: number;
  setEpiCount: (count: number | ((prev: number) => number)) => void;
  amioCount: number;
  setAmioCount: (count: number | ((prev: number) => number)) => void;
  lidoCount: number;
  setLidoCount: (count: number | ((prev: number) => number)) => void;
  addLogEntry: (label: string, type: 'timer' | 'drug' | 'procedure' | 'rhythm' | 'outcome') => void;
  playShockDelivered: () => void;
  playRoscAchieved: () => void;
}

export const ActiveRunner: React.FC<ActiveRunnerProps> = ({
  isRunning,
  totalElapsedMs,
  cprCountdown,
  epiCountdown,
  formatTime,
  startTimer,
  pauseTimer,
  resetCprTimer,
  resetEpiTimer,
  rhythmType,
  setRhythmType,
  shockCount,
  setShockCount,
  epiCount,
  setEpiCount,
  amioCount,
  setAmioCount,
  lidoCount,
  setLidoCount,
  addLogEntry,
  playShockDelivered,
  playRoscAchieved
}) => {
  // CPR Cycle values (120 seconds total)
  const cprPercent = ((120 - cprCountdown) / 120) * 100;
  const strokeDashoffset = 283 - (283 * cprPercent) / 100;

  // Determine timer ring glowing colors based on countdown remaining
  let timerRingColor = 'stroke-brand-accent shadow-brand-accent/30';
  let timerTextColor = 'text-brand-accent';
  
  if (cprCountdown <= 15 && cprCountdown > 0) {
    timerRingColor = 'stroke-brand-warning animate-pulse';
    timerTextColor = 'text-brand-warning';
  } else if (cprCountdown === 0) {
    timerRingColor = 'stroke-brand-danger animate-pulse';
    timerTextColor = 'text-brand-danger';
  }

  // Quick logging helpers
  const handleDeliverShock = (energy: number) => {
    if (!isRunning) startTimer();
    setShockCount(prev => prev + 1);
    addLogEntry(`Shock #${shockCount + 1} Delivered (${energy} J)`, 'procedure');
    playShockDelivered();
    resetCprTimer();
  };

  const handleAdministerDrug = (drugName: string, dose: string, isEpi = false) => {
    if (!isRunning) startTimer();
    addLogEntry(`${drugName} ${dose} administered`, 'drug');
    if (isEpi) {
      setEpiCount(prev => prev + 1);
      resetEpiTimer();
    } else if (drugName.toLowerCase().includes('amiodarone')) {
      setAmioCount(prev => prev + 1);
    } else if (drugName.toLowerCase().includes('lidocaine')) {
      setLidoCount(prev => prev + 1);
    }
  };

  const handleProcedure = (procedureName: string) => {
    if (!isRunning) startTimer();
    addLogEntry(procedureName, 'procedure');
  };

  const handleRhythmToggle = (type: 'shockable' | 'non-shockable') => {
    if (!isRunning) startTimer();
    setRhythmType(type);
    addLogEntry(`Rhythm assessed: ${type === 'shockable' ? 'Shockable (VF/pVT)' : 'Non-shockable (Asystole/PEA)'}`, 'rhythm');
  };

  const handleRosc = () => {
    pauseTimer();
    setRhythmType('rosc');
    addLogEntry('ROSC (Return of Spontaneous Circulation) achieved!', 'outcome');
    playRoscAchieved();
  };

  // Determine current guideline instruction box
  const renderGuidelineBox = () => {
    if (!isRunning && totalElapsedMs === 0) {
      return (
        <div className="bg-brand-panel border border-brand-accent/20 rounded-2xl p-6 text-center shadow-lg">
          <Activity className="w-12 h-12 text-brand-accent mx-auto mb-3 animate-pulse" />
          <h3 className="text-xl font-bold text-white mb-2">Resuscitation Ready</h3>
          <p className="text-gray-400 text-sm mb-4">Tap "Start Code" to activate continuous clock, CPR cycle alarm, and Speech Synthesis dispatch.</p>
          <button 
            onClick={() => { startTimer(); addLogEntry('ACLS Resuscitation Code Started', 'timer'); }}
            className="w-full py-4 bg-brand-accent hover:bg-blue-600 text-white rounded-xl font-bold text-lg transition duration-200 shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5 fill-white" /> Start Resuscitation
          </button>
        </div>
      );
    }

    if (cprCountdown === 0) {
      return (
        <div className="bg-brand-danger/10 border-2 border-brand-danger rounded-2xl p-5 text-center shadow-lg animate-pulse">
          <AlertTriangle className="w-10 h-10 text-brand-danger mx-auto mb-2" />
          <h3 className="text-lg font-black text-brand-danger uppercase tracking-wider mb-2">RHYTHM CHECK / PULSE CHECK</h3>
          <p className="text-white text-sm mb-4">Pause chest compressions. Palpate pulse (max 10s). Assess monitor rhythm.</p>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => handleRhythmToggle('shockable')}
              className={`py-3 rounded-xl font-bold text-sm transition ${rhythmType === 'shockable' ? 'bg-brand-danger text-white border-2 border-white' : 'bg-brand-panel hover:bg-brand-panel/80 text-brand-danger border border-brand-danger/30'}`}
            >
              Shockable (VF/pVT)
            </button>
            <button 
              onClick={() => handleRhythmToggle('non-shockable')}
              className={`py-3 rounded-xl font-bold text-sm transition ${rhythmType === 'non-shockable' ? 'bg-brand-warning text-brand-dark border-2 border-white' : 'bg-brand-panel hover:bg-brand-panel/80 text-brand-warning border border-brand-warning/30'}`}
            >
              Non-shockable (Asystole/PEA)
            </button>
          </div>
        </div>
      );
    }

    if (rhythmType === 'shockable') {
      return (
        <div className="bg-brand-danger/5 border border-brand-danger/30 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2 text-brand-danger font-bold mb-2">
            <Zap className="w-5 h-5 fill-brand-danger text-brand-danger" />
            <span>Shockable Rhythm Flow (VF/pVT)</span>
          </div>
          <p className="text-gray-300 text-sm mb-4">
            {shockCount === 0 ? "Deliver shock immediately. Resume high-quality CPR." : 
             shockCount === 1 ? "Deliver shock. Resume CPR. Prepare Epinephrine 1mg." :
             "Deliver shock. Resume CPR. Consider Amiodarone 300mg or Lidocaine."}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button 
              onClick={() => handleDeliverShock(200)}
              className="col-span-2 py-3 bg-brand-danger hover:bg-red-600 text-white rounded-xl font-black text-sm transition active:scale-95 shadow-md shadow-red-500/20"
            >
              DELIVER SHOCK (200J)
            </button>
            <button 
              onClick={resetCprTimer}
              className="py-3 bg-brand-panel hover:bg-brand-panel/80 border border-gray-700 text-gray-300 rounded-xl font-bold text-sm transition active:scale-95 flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-4 h-4" /> Reset CPR
            </button>
          </div>
        </div>
      );
    }

    if (rhythmType === 'non-shockable') {
      return (
        <div className="bg-brand-warning/5 border border-brand-warning/30 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2 text-brand-warning font-bold mb-2">
            <ShieldAlert className="w-5 h-5 text-brand-warning" />
            <span>Non-Shockable Flow (Asystole/PEA)</span>
          </div>
          <p className="text-gray-300 text-sm mb-4">
            Resume CPR immediately. Administer Epinephrine 1mg as soon as IV/IO access is secured, then every 3-5 minutes.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => { resetCprTimer(); addLogEntry('CPR Resumed (Non-shockable)', 'timer'); }}
              className="py-3 bg-brand-warning hover:bg-amber-600 text-brand-dark rounded-xl font-black text-sm transition active:scale-95 shadow-md shadow-amber-500/20"
            >
              RESUME CPR (2 MIN)
            </button>
            <button 
              onClick={resetCprTimer}
              className="py-3 bg-brand-panel hover:bg-brand-panel/80 border border-gray-700 text-gray-300 rounded-xl font-bold text-sm transition active:scale-95 flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-4 h-4" /> Reset CPR
            </button>
          </div>
        </div>
      );
    }

    if (rhythmType === 'rosc') {
      return (
        <div className="bg-brand-success/10 border border-brand-success rounded-2xl p-5 text-center shadow-lg">
          <CheckCircle2 className="w-10 h-10 text-brand-success mx-auto mb-2" />
          <h3 className="text-lg font-black text-brand-success uppercase mb-2">ROSC ACHIEVED</h3>
          <p className="text-gray-300 text-sm mb-4">Pulse palpable. Blood pressure audible. Switch to Post-Cardiac Arrest Care checklists.</p>
          <button 
            onClick={() => { setRhythmType('none'); startTimer(); addLogEntry('ACLS Resuscitation Resumed from ROSC', 'timer'); }}
            className="w-full py-3 bg-brand-panel border border-brand-success/30 hover:border-brand-success text-brand-success rounded-xl font-bold text-sm transition active:scale-95"
          >
            Resume Active Code
          </button>
        </div>
      );
    }

    return (
      <div className="bg-brand-panel border border-gray-800 rounded-2xl p-5 text-center shadow-lg">
        <h3 className="text-md font-bold text-white mb-3">Assess Rhythm at Rhythm Check</h3>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => handleRhythmToggle('shockable')}
            className="py-3 bg-brand-danger/10 border border-brand-danger/30 hover:bg-brand-danger/20 text-brand-danger rounded-xl font-bold text-sm transition"
          >
            Shockable (VF/pVT)
          </button>
          <button 
            onClick={() => handleRhythmToggle('non-shockable')}
            className="py-3 bg-brand-warning/10 border border-brand-warning/30 hover:bg-brand-warning/20 text-brand-warning rounded-xl font-bold text-sm transition"
          >
            Non-shockable (PEA/Asystole)
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header Timer Strip */}
      <div className="bg-brand-panel border border-gray-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wider block">TOTAL ELAPSED TIME</span>
          <span className="text-3xl font-black font-mono text-white tracking-wider">
            {formatTime(totalElapsedMs)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button 
              onClick={pauseTimer}
              className="p-3 bg-brand-warning hover:bg-amber-600 text-brand-dark rounded-xl font-bold transition active:scale-95 flex items-center gap-1.5 text-sm"
            >
              <Pause className="w-4 h-4 fill-brand-dark" /> Pause
            </button>
          ) : (
            totalElapsedMs > 0 && (
              <button 
                onClick={startTimer}
                className="p-3 bg-brand-accent hover:bg-blue-600 text-white rounded-xl font-bold transition active:scale-95 flex items-center gap-1.5 text-sm"
              >
                <Play className="w-4 h-4 fill-white" /> Resume
              </button>
            )
          )}
        </div>
      </div>

      {/* Primary Circular Countdown Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Circular Countdown Progress ring */}
          <div className="bg-brand-panel border border-gray-800 rounded-3xl p-6 flex flex-col items-center justify-center shadow-lg relative aspect-square max-w-[280px] mx-auto w-full">
            <svg className="w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 100 100">
              {/* Outer Track Circle */}
              <circle 
                className="stroke-gray-800" 
                strokeWidth="6" 
                fill="transparent" 
                r="45" 
                cx="50" 
                cy="50" 
              />
              {/* Progress Circle */}
              <circle 
                className={`transition-all duration-300 ${timerRingColor}`} 
                strokeWidth="6" 
                strokeDasharray="283" 
                strokeDashoffset={strokeDashoffset} 
                strokeLinecap="round" 
                fill="transparent" 
                r="45" 
                cx="50" 
                cy="50" 
              />
            </svg>

            {/* In-Ring Text display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">CPR COUNTDOWN</span>
              <span className={`text-4xl font-black font-mono tracking-wider ${timerTextColor}`}>
                {cprCountdown > 0 ? formatTime(cprCountdown * 1000) : '00:00'}
              </span>
              <span className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wide">
                Cycle Progress: {Math.round(cprPercent)}%
              </span>
            </div>
          </div>

          {/* Guidelines instruction helper */}
          <div className="space-y-4">
            {renderGuidelineBox()}

            {/* Quick stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-brand-panel/40 border border-gray-850 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block font-bold">SHOCKS GIVEN</span>
                  <span className="text-xl font-extrabold text-white">{shockCount}</span>
                </div>
                {shockCount > 0 && (
                  <button 
                    onClick={() => setShockCount(prev => Math.max(0, (prev as number) - 1))}
                    className="p-1 text-gray-600 hover:text-brand-danger transition text-xs"
                    title="Decrement"
                  >
                    -1
                  </button>
                )}
              </div>
              <div className="bg-brand-panel/40 border border-gray-850 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block font-bold">EPINEPHRINE</span>
                  <span className="text-xl font-extrabold text-white">{epiCount}</span>
                </div>
                {epiCount > 0 && (
                  <button 
                    onClick={() => setEpiCount(prev => Math.max(0, (prev as number) - 1))}
                    className="p-1 text-gray-600 hover:text-brand-warning transition text-xs"
                    title="Decrement"
                  >
                    -1
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* Epinephrine Active Timer Box */}
      <div className={`p-4 rounded-2xl border transition duration-200 shadow-md ${(epiCountdown === 0) ? 'bg-brand-warning/10 border-brand-warning animate-pulse' : 'bg-brand-panel border-gray-800'}`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-400 font-bold block">EPINEPHRINE NEXT DUE</span>
              <span className={`text-xl font-bold font-mono tracking-wider ${epiCountdown === 0 ? 'text-brand-warning' : 'text-white'}`}>
                {epiCountdown > 0 ? formatTime(epiCountdown * 1000) : 'DUE NOW'}
              </span>
            </div>
            <button 
              onClick={() => handleAdministerDrug('Epinephrine', '1mg', true)}
              className={`px-4 py-3 rounded-xl font-black text-xs transition active:scale-95 flex items-center gap-1 ${epiCountdown === 0 ? 'bg-brand-warning text-brand-dark shadow-md shadow-amber-500/20' : 'bg-brand-panel border border-gray-700 text-white hover:bg-gray-850'}`}
            >
              <Plus className="w-4 h-4" /> Administer Epi (1mg)
            </button>
          </div>
        </div>

      {/* Clinical Interventions Panel */}
      <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Resuscitation Interventions</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Medications Grid */}
            <div className="bg-brand-panel border border-gray-800 rounded-2xl p-4 space-y-3 shadow-md">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">MEDICATIONS (TAP TO LOG)</span>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handleAdministerDrug('Amiodarone', '300mg')}
                  className="py-2.5 bg-brand-panel hover:bg-gray-850 border border-gray-700 rounded-xl text-xs font-bold text-white transition active:scale-95"
                >
                  Amio 300mg ({amioCount})
                </button>
                <button 
                  onClick={() => handleAdministerDrug('Amiodarone', '150mg')}
                  className="py-2.5 bg-brand-panel hover:bg-gray-850 border border-gray-700 rounded-xl text-xs font-bold text-white transition active:scale-95"
                >
                  Amio 150mg
                </button>
                <button 
                  onClick={() => handleAdministerDrug('Lidocaine', '100mg')}
                  className="py-2.5 bg-brand-panel hover:bg-gray-850 border border-gray-700 rounded-xl text-xs font-bold text-white transition active:scale-95"
                >
                  Lido 100mg ({lidoCount})
                </button>
                <button 
                  onClick={() => handleAdministerDrug('Lidocaine', '50mg')}
                  className="py-2.5 bg-brand-panel hover:bg-gray-850 border border-gray-700 rounded-xl text-xs font-bold text-white transition active:scale-95"
                >
                  Lido 50mg
                </button>
                <button 
                  onClick={() => handleAdministerDrug('Sodium Bicarbonate', '50 mEq')}
                  className="py-2.5 bg-brand-panel hover:bg-gray-850 border border-gray-700 rounded-xl text-xs font-bold text-white transition active:scale-95"
                >
                  NaHCO3 50mEq
                </button>
                <button 
                  onClick={() => handleAdministerDrug('Calcium Gluconate', '1g')}
                  className="py-2.5 bg-brand-panel hover:bg-gray-850 border border-gray-700 rounded-xl text-xs font-bold text-white transition active:scale-95"
                >
                  Calcium 1g
                </button>
              </div>
            </div>

            {/* Procedures & Outcomes Grid */}
            <div className="bg-brand-panel border border-gray-800 rounded-2xl p-4 space-y-3 shadow-md">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">PROCEDURES & OUTCOMES</span>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handleProcedure('Intubation (ET Tube) secured')}
                  className="py-2.5 bg-brand-panel hover:bg-gray-850 border border-gray-700 rounded-xl text-xs font-bold text-white transition active:scale-95"
                >
                  Intubate (ET)
                </button>
                <button 
                  onClick={() => handleProcedure('Laryngeal Mask Airway (LMA) placed')}
                  className="py-2.5 bg-brand-panel hover:bg-gray-850 border border-gray-700 rounded-xl text-xs font-bold text-white transition active:scale-95"
                >
                  Place LMA
                </button>
                <button 
                  onClick={() => handleProcedure('IV Access established')}
                  className="py-2.5 bg-brand-panel hover:bg-gray-850 border border-gray-700 rounded-xl text-xs font-bold text-white transition active:scale-95"
                >
                  Secure IV
                </button>
                <button 
                  onClick={() => handleProcedure('IO Access established')}
                  className="py-2.5 bg-brand-panel hover:bg-gray-850 border border-gray-700 rounded-xl text-xs font-bold text-white transition active:scale-95"
                >
                  Secure IO
                </button>
                <button 
                  onClick={handleRosc}
                  className="col-span-2 py-3 bg-brand-success/20 hover:bg-brand-success/30 border border-brand-success/40 text-brand-success rounded-xl text-xs font-black transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> ACHIEVE ROSC (PULSE OK)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};
