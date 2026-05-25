import { useState, useEffect, useCallback, useRef } from 'react';
import { ActiveRunner } from './components/ActiveRunner';
import { DiagnosticsCard } from './components/DiagnosticsCard';
import { LogReview } from './components/LogReview';
import type { LogEntry } from './components/LogReview';
import { ReferenceDrawer } from './components/ReferenceDrawer';
import { SettingsModal } from './components/SettingsModal';
import { useAudioSynth } from './hooks/useAudioSynth';
import { useScreenWakeLock } from './hooks/useScreenWakeLock';
import { useCodeTimer } from './hooks/useCodeTimer';
import { Activity, BookOpen, Settings, Shield, Volume2, VolumeX } from 'lucide-react';

function App() {
  // Configurable states
  const [epiIntervalSeconds, setEpiIntervalSeconds] = useState<number>(240); // 4-minute default
  const [rhythmType, setRhythmType] = useState<'none' | 'shockable' | 'non-shockable' | 'rosc'>('none');
  const [shockCount, setShockCount] = useState<number>(0);
  const [epiCount, setEpiCount] = useState<number>(0);
  const [amioCount, setAmioCount] = useState<number>(0);
  const [lidoCount, setLidoCount] = useState<number>(0);

  // Resuscitation Action log
  const [log, setLog] = useState<LogEntry[]>([]);

  // Navigation / Modal visibility states
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isReferenceOpen, setIsReferenceOpen] = useState<boolean>(false);

  // Capture PWA "Add to Home Screen" install prompt
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Load custom hooks
  const audio = useAudioSynth();
  const wakeLock = useScreenWakeLock();

  // Anchor to keep track of elapsed time for logging, avoiding JS Temporal Dead Zone errors
  const elapsedMsRef = useRef<number>(0);

  const formatTimeHelper = (ms: number): string => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper to push a formatted log entry
  const addLogEntry = useCallback((label: string, type: LogEntry['type']) => {
    const wallClockStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLog(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(), // Unique ID
        time: wallClockStr,
        relativeTime: formatTimeHelper(elapsedMsRef.current),
        label,
        type
      }
    ]);
  }, []);

  // Timer callbacks
  const onCprWarning = useCallback(() => {
    audio.playRhythmWarning();
    addLogEntry('CPR Cycle Warning (15 seconds remaining in cycle)', 'timer');
  }, [audio, addLogEntry]);

  const onCprComplete = useCallback(() => {
    audio.playCprComplete();
    addLogEntry('CPR Cycle Complete - Rhythm check recommended!', 'timer');
  }, [audio, addLogEntry]);

  const onEpiWarning = useCallback(() => {
    audio.playEpiWarning();
    addLogEntry('Epinephrine administration is due!', 'timer');
  }, [audio, addLogEntry]);

  // High precision code timer stopwatch hook
  const timer = useCodeTimer({
    epiIntervalSeconds,
    onCprWarning,
    onCprComplete,
    onEpiWarning
  });

  // Sync the elapsed stopwatch time to ref on every tick render
  elapsedMsRef.current = timer.totalElapsedMs;

  // Keep screen wake lock synchronized with stopwatch state
  useEffect(() => {
    if (timer.isRunning) {
      wakeLock.requestWakeLock();
    } else {
      wakeLock.releaseWakeLock();
    }
  }, [timer.isRunning]);

  // Capture standard browser PWA install prompts
  useEffect(() => {
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleToggleMute = () => {
    audio.setIsMuted(!audio.isMuted);
  };

  return (
    <div 
      className="min-h-screen bg-brand-dark text-gray-100 flex flex-col antialiased selection:bg-brand-accent/20"
      onClick={audio.unlockAudio} // Unlocks WebAudio on very first clinical screen interaction
    >
      {/* Top Application Header */}
      <header className="bg-brand-panel border-b border-gray-800 py-3.5 px-4 sticky top-0 z-40 shadow-md select-none shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center shadow-inner">
              <Activity className="w-5.5 h-5.5 text-brand-accent animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-wide leading-tight">FOAM CodeRunner</h1>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">ACLS Clinical Assistant</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Screen Wake Lock active badge status */}
            {wakeLock.supported && (
              <span 
                className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 border rounded-lg hidden sm:inline-block transition ${wakeLock.isActive ? 'bg-brand-success/15 border-brand-success/30 text-brand-success shadow-sm shadow-emerald-500/5' : 'bg-gray-900 border-gray-850 text-gray-500'}`}
                title={wakeLock.isActive ? 'Screen remaining active continuously' : 'Screen power active only during active codes'}
              >
                Wake Lock: {wakeLock.isActive ? 'ACTIVE' : 'STANDBY'}
              </span>
            )}

            {/* Mute button toggles */}
            <button 
              onClick={handleToggleMute}
              className={`p-2 rounded-xl border transition active:scale-95 flex items-center justify-center ${audio.isMuted ? 'bg-brand-danger/10 border-brand-danger/25 text-brand-danger' : 'bg-brand-dark/50 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'}`}
              title={audio.isMuted ? 'Unmute Audio alerts' : 'Mute Audio alerts'}
            >
              {audio.isMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
            </button>

            {/* Reference Drawer selector */}
            <button 
              onClick={() => setIsReferenceOpen(true)}
              className="p-2 bg-brand-dark/50 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white rounded-xl transition active:scale-95 flex items-center gap-1 text-xs font-bold"
              title="Guidelines Reference Library"
            >
              <BookOpen className="w-4.5 h-4.5" />
              <span className="hidden md:inline">Guidelines</span>
            </button>

            {/* Settings button */}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-brand-dark/50 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white rounded-xl transition active:scale-95 flex items-center justify-center"
              title="Configuration Settings"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main responsive grid workspace */}
      <main className="flex-grow p-4 md:p-6 overflow-y-auto max-w-6xl mx-auto w-full space-y-6">
        
        {/* Glowing PWA Download Banner */}
        {installPrompt && (
          <div className="bg-gradient-to-r from-brand-accent/20 to-brand-success/10 border border-brand-accent/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shadow-blue-500/5 animate-fadeIn select-none shrink-0">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <Shield className="w-8 h-8 text-brand-accent shrink-0 hidden sm:block animate-bounce" />
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider leading-snug">Install Offline Resus Assistant</h3>
                <p className="text-[11px] text-gray-350 mt-0.5 leading-relaxed font-medium">Download to your home screen for instantaneous loading and 100% offline security in hospital units.</p>
              </div>
            </div>
            <button 
              onClick={handleInstallApp}
              className="px-4.5 py-2.5 bg-brand-accent hover:bg-blue-600 text-white rounded-xl text-xs font-black transition active:scale-95 shadow shadow-blue-500/20 whitespace-nowrap"
            >
              INSTALL APP
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Column 1: Active timers & Runner Controls (Span 7) */}
          <div className="lg:col-span-7 space-y-6">
            <ActiveRunner 
              isRunning={timer.isRunning}
              totalElapsedMs={timer.totalElapsedMs}
              cprCountdown={timer.cprCountdown}
              epiCountdown={timer.epiCountdown}
              formatTime={timer.formatTime}
              startTimer={timer.startTimer}
              pauseTimer={timer.pauseTimer}
              resetCprTimer={timer.resetCprTimer}
              resetEpiTimer={timer.resetEpiTimer}
              rhythmType={rhythmType}
              setRhythmType={setRhythmType}
              shockCount={shockCount}
              setShockCount={setShockCount}
              epiCount={epiCount}
              setEpiCount={setEpiCount}
              amioCount={amioCount}
              setAmioCount={setAmioCount}
              lidoCount={lidoCount}
              setLidoCount={setLidoCount}
              addLogEntry={addLogEntry}
              playShockDelivered={audio.playShockDelivered}
              playRoscAchieved={audio.playRoscAchieved}
            />
          </div>

          {/* Column 2: Log chronological feed & H's / T's checkoffs (Span 5) */}
          <div className="lg:col-span-5 space-y-6">
            <LogReview 
              log={log}
              totalElapsedMs={timer.totalElapsedMs}
              formatTime={timer.formatTime}
              addLogEntry={addLogEntry}
              resetTimer={timer.resetTimer}
              setShockCount={setShockCount}
              setEpiCount={setEpiCount}
              setAmioCount={setAmioCount}
              setLidoCount={setLidoCount}
              setRhythmType={setRhythmType}
              clearLog={() => setLog([])}
            />

            <DiagnosticsCard />
          </div>
        </div>
      </main>

      {/* Slide-over algorithm drawer library */}
      <ReferenceDrawer 
        isOpen={isReferenceOpen}
        onClose={() => setIsReferenceOpen(false)}
      />

      {/* Settings Modal popover */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        epiIntervalSeconds={epiIntervalSeconds}
        setEpiIntervalSeconds={setEpiIntervalSeconds}
        voiceEnabled={audio.voiceEnabled}
        setVoiceEnabled={audio.setVoiceEnabled}
        chimeEnabled={audio.chimeEnabled}
        setChimeEnabled={audio.setChimeEnabled}
        isMuted={audio.isMuted}
        setIsMuted={audio.setIsMuted}
      />
    </div>
  );
}

export default App;
