import React from 'react';
import { X, Volume2, VolumeX, Check, Settings, MessageSquare, BellRing } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  epiIntervalSeconds: number;
  setEpiIntervalSeconds: (n: number) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (b: boolean) => void;
  chimeEnabled: boolean;
  setChimeEnabled: (b: boolean) => void;
  isMuted: boolean;
  setIsMuted: (b: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  epiIntervalSeconds,
  setEpiIntervalSeconds,
  voiceEnabled,
  setVoiceEnabled,
  chimeEnabled,
  setChimeEnabled,
  isMuted,
  setIsMuted
}) => {
  if (!isOpen) return null;

  const intervals = [
    { value: 180, label: '3 Minutes' },
    { value: 240, label: '4 Minutes (Default)' },
    { value: 300, label: '5 Minutes' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn select-none p-4">
      {/* Backdrop overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
      />

      {/* Modal Dialog Content */}
      <div className="relative w-full max-w-sm bg-brand-panel border border-gray-800 rounded-3xl p-6 shadow-2xl z-10 animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3.5 mb-5">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-accent" />
            <div>
              <h2 className="text-md font-bold text-white leading-tight">Configuration Settings</h2>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">ACLS Parameters</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configurations list */}
        <div className="space-y-5 text-xs">
          
          {/* Epinephrine dosage timer */}
          <div className="space-y-2">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">EPINEPHRINE TIMING INTERVAL</span>
            <div className="grid grid-cols-1 gap-2">
              {intervals.map(item => (
                <button
                  key={item.value}
                  onClick={() => setEpiIntervalSeconds(item.value)}
                  className={`w-full py-3 px-4 rounded-xl flex items-center justify-between font-bold border transition active:scale-[0.98] ${epiIntervalSeconds === item.value ? 'bg-brand-accent/10 border-brand-accent text-brand-accent' : 'bg-brand-dark/40 border-gray-800 text-gray-300'}`}
                >
                  <span>{item.label}</span>
                  {epiIntervalSeconds === item.value && <Check className="w-4 h-4 text-brand-accent" />}
                </button>
              ))}
            </div>
          </div>

          {/* Sound, voice, chimes switches */}
          <div className="space-y-2 pt-2 border-t border-gray-850">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">AUDIO RESUSCITATION SIGNALS</span>
            
            <div className="space-y-2">
              {/* Voice switch */}
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`w-full py-3 px-4 rounded-xl flex items-center gap-3 font-bold border transition ${voiceEnabled && !isMuted ? 'bg-brand-dark/65 border-gray-700 text-white' : 'bg-brand-dark/20 border-gray-850 text-gray-500'}`}
              >
                <MessageSquare className={`w-4 h-4 ${voiceEnabled && !isMuted ? 'text-brand-accent' : 'text-gray-600'}`} />
                <div className="text-left flex-grow">
                  <span className="block text-xs">Speech Cues (Text-to-Speech)</span>
                  <span className="text-[9px] text-gray-550 block font-normal mt-0.5">Spoken rhythm checks & drug prompts</span>
                </div>
                <div className={`w-8 h-4.5 rounded-full p-0.5 transition duration-200 ${voiceEnabled && !isMuted ? 'bg-brand-accent' : 'bg-gray-800'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white transition duration-200 ${voiceEnabled && !isMuted ? 'transform translate-x-3.5' : ''}`} />
                </div>
              </button>

              {/* Chime switch */}
              <button
                onClick={() => setChimeEnabled(!chimeEnabled)}
                className={`w-full py-3 px-4 rounded-xl flex items-center gap-3 font-bold border transition ${chimeEnabled && !isMuted ? 'bg-brand-dark/65 border-gray-700 text-white' : 'bg-brand-dark/20 border-gray-850 text-gray-500'}`}
              >
                <BellRing className={`w-4 h-4 ${chimeEnabled && !isMuted ? 'text-brand-warning' : 'text-gray-600'}`} />
                <div className="text-left flex-grow">
                  <span className="block text-xs">Warning Chimes & Alarms</span>
                  <span className="text-[9px] text-gray-550 block font-normal mt-0.5">Synthesizer oscillation tone beeps</span>
                </div>
                <div className={`w-8 h-4.5 rounded-full p-0.5 transition duration-200 ${chimeEnabled && !isMuted ? 'bg-brand-warning' : 'bg-gray-800'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white transition duration-200 ${chimeEnabled && !isMuted ? 'transform translate-x-3.5' : ''}`} />
                </div>
              </button>

              {/* Global Mute Toggle button */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-black transition active:scale-[0.98] ${isMuted ? 'bg-brand-danger/20 hover:bg-brand-danger/35 border border-brand-danger/35 text-brand-danger' : 'bg-brand-panel hover:bg-gray-850 border border-gray-700 text-gray-200'}`}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-4.5 h-4.5" /> RESUS SIGNALS MUTED
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4.5 h-4.5" /> MUTE ALL SOUNDS
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer OK */}
        <div className="pt-5 border-t border-gray-850 mt-5 shrink-0">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-brand-accent hover:bg-blue-600 text-white rounded-xl font-bold text-xs transition active:scale-95 shadow shadow-blue-500/10 flex items-center justify-center"
          >
            Save Configurations
          </button>
        </div>
      </div>
    </div>
  );
};
