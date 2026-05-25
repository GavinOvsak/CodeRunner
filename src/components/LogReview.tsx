import React, { useState, useRef, useEffect } from 'react';
import { ClipboardList, Copy, Download, Plus, Check, Clock, RotateCcw } from 'lucide-react';

export interface LogEntry {
  id: number;
  time: string;          // Wall clock time e.g., 09:47:12
  relativeTime: string;  // Code stopwatch time e.g., 04:12
  label: string;
  type: 'timer' | 'drug' | 'procedure' | 'rhythm' | 'outcome';
}

interface LogReviewProps {
  log: LogEntry[];
  totalElapsedMs: number;
  formatTime: (ms: number) => string;
  addLogEntry: (label: string, type: 'timer' | 'drug' | 'procedure' | 'rhythm' | 'outcome') => void;
  resetTimer: () => void;
  setShockCount: (c: number) => void;
  setEpiCount: (c: number) => void;
  setAmioCount: (c: number) => void;
  setLidoCount: (c: number) => void;
  setRhythmType: (t: 'none' | 'shockable' | 'non-shockable' | 'rosc') => void;
  clearLog: () => void;
}

export const LogReview: React.FC<LogReviewProps> = ({
  log,
  totalElapsedMs,
  formatTime,
  addLogEntry,
  resetTimer,
  setShockCount,
  setEpiCount,
  setAmioCount,
  setLidoCount,
  setRhythmType,
  clearLog
}) => {
  const [noteText, setNoteText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll only the timeline box internally when a new entry is added, leaving the viewport steady
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [log]);

  const handleAddManualNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    addLogEntry(`Manual Note: ${noteText.trim()}`, 'procedure');
    setNoteText('');
  };

  // Compile a clinical charting note compatible with Epic/Cerner
  const generateEhrNote = (): string => {
    const dateStr = new Date().toLocaleDateString();
    
    // Count stats
    let shocks = 0;
    let epi = 0;
    let amio = 0;
    let lido = 0;

    log.forEach(e => {
      const lower = e.label.toLowerCase();
      if (lower.includes('shock #') || lower.includes('delivered')) shocks++;
      if (lower.includes('epinephrine')) epi++;
      if (lower.includes('amiodarone')) amio++;
      if (lower.includes('lidocaine')) lido++;
    });

    let note = `=== FOAM CODERUNNER ACLS RESUSCITATION LOG ===\n`;
    note += `Date: ${dateStr}\n`;
    note += `Total Code Duration: ${formatTime(totalElapsedMs)}\n\n`;
    note += `INTERVENTION CHRONOLOGY:\n`;
    
    log.forEach(e => {
      note += `[${e.relativeTime}] (${e.time}) - ${e.label}\n`;
    });

    note += `\nCLINICAL SUMMARY:\n`;
    note += `- Total Defibrillation Shocks: ${shocks}\n`;
    note += `- Epinephrine 1mg Administered: ${epi} dose(s)\n`;
    note += `- Amiodarone Administered: ${amio} dose(s)\n`;
    note += `- Lidocaine Administered: ${lido} dose(s)\n`;
    note += `==============================================\n`;
    
    return note;
  };

  const handleCopyNote = async () => {
    try {
      const formattedNote = generateEhrNote();
      await navigator.clipboard.writeText(formattedNote);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  const handleDownloadLog = () => {
    const formattedNote = generateEhrNote();
    const blob = new Blob([formattedNote], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ACLS_Code_Log_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFullReset = () => {
    if (window.confirm("Are you sure you want to stop timers, reset all drug counts, and clear the active log? This cannot be undone.")) {
      resetTimer();
      setShockCount(0);
      setEpiCount(0);
      setAmioCount(0);
      setLidoCount(0);
      setRhythmType('none');
      clearLog();
    }
  };

  // Helper to color code log tags
  const getLogTypeBadgeClass = (type: LogEntry['type']) => {
    switch (type) {
      case 'timer': return 'bg-brand-accent/10 border-brand-accent/20 text-brand-accent';
      case 'drug': return 'bg-brand-warning/10 border-brand-warning/20 text-brand-warning';
      case 'procedure': return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      case 'rhythm': return 'bg-brand-danger/10 border-brand-danger/20 text-brand-danger';
      case 'outcome': return 'bg-brand-success/10 border-brand-success/20 text-brand-success';
      default: return 'bg-gray-800 border-gray-700 text-gray-400';
    }
  };

  return (
    <div className="bg-brand-panel border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4 flex flex-col h-full max-h-[500px]">
      {/* Log Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-brand-accent" />
          <div>
            <h2 className="text-md font-bold text-white leading-tight">Live Resuscitation Log</h2>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Clinical EMR Timeline</span>
          </div>
        </div>
        
        {log.length > 0 && (
          <button 
            onClick={handleFullReset}
            className="p-2 text-gray-500 hover:text-brand-danger border border-transparent hover:border-brand-danger/20 hover:bg-brand-danger/5 rounded-lg transition"
            title="Reset code data"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Log Timeline Container */}
      <div ref={containerRef} className="flex-grow overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[160px] bg-brand-dark/25 border border-gray-850 rounded-xl p-3">
        {log.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full py-10 text-gray-600">
            <Clock className="w-8 h-8 mb-2" />
            <p className="text-xs font-semibold">No logged actions yet.</p>
            <p className="text-[10px]">Actions taken on the dashboard will appear here in sequence.</p>
          </div>
        ) : (
          log.map(entry => (
            <div key={entry.id} className="flex gap-2.5 items-start text-xs border-b border-gray-900 pb-1.5 last:border-0 last:pb-0 animate-fadeIn">
              <span className="font-mono text-gray-500 font-bold shrink-0 mt-0.5 select-none">
                [{entry.relativeTime}]
              </span>
              <span className={`px-1.5 py-0.5 border rounded text-[9px] font-black uppercase tracking-wide shrink-0 scale-95 select-none ${getLogTypeBadgeClass(entry.type)}`}>
                {entry.type}
              </span>
              <div className="flex-grow">
                <span className="text-gray-200 leading-normal font-medium">{entry.label}</span>
                <span className="text-[9px] text-gray-550 block select-none mt-0.5 font-bold">Wall Clock: {entry.time}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Custom manual note capture input */}
      <form onSubmit={handleAddManualNote} className="flex gap-2 shrink-0">
        <input 
          type="text" 
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Type manual note (e.g. A-line placed)..." 
          className="flex-grow bg-brand-dark border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent transition"
        />
        <button 
          type="submit"
          className="p-2.5 bg-brand-accent hover:bg-blue-600 text-white rounded-xl transition active:scale-95 flex items-center justify-center"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {/* EMR Log Export Options */}
      {log.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 pt-1.5 border-t border-gray-850 shrink-0">
          <button 
            onClick={handleCopyNote}
            className={`py-3 rounded-xl font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5 ${copied ? 'bg-brand-success text-white' : 'bg-brand-accent hover:bg-blue-600 text-white shadow shadow-blue-500/10'}`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy EMR Note
              </>
            )}
          </button>
          <button 
            onClick={handleDownloadLog}
            className="py-3 bg-brand-panel hover:bg-gray-850 border border-gray-700 text-gray-200 rounded-xl font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Download Text
          </button>
        </div>
      )}
    </div>
  );
};
