import { useState, useCallback } from 'react';

/**
 * Custom hook for medical grade audio synthesis and clinical speech prompts.
 * Designed to work 100% offline using native Web Audio API oscillators
 * and the SpeechSynthesis engine, bypassing any external media assets.
 * 
 * Provides clear beeps and vocal directions to keep the clinical team
 * synced without needing to continuously read a device screen.
 */

// Shared AudioContext across hook instances to prevent resource leaks
let sharedAudioCtx: AudioContext | null = null;

export const useAudioSynth = () => {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [chimeEnabled, setChimeEnabled] = useState<boolean>(true);

  // Keep a reference to the active AudioContext
  const getAudioContext = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!sharedAudioCtx) {
      // Gracefully support Webkit prefix for legacy/mobile browsers
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }
    // Resume context if suspended (browser autoplay security policy)
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch((err) => console.warn('Could not resume AudioContext:', err));
    }
    return sharedAudioCtx;
  };

  /**
   * Generates a native synthesizer beep of specified frequency, duration, and type.
   */
  const playBeep = useCallback((freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) => {
    if (isMuted || !chimeEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.value = freq;

      // Smooth envelope to prevent audio clicks and popping sounds
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
      gainNode.gain.setValueAtTime(volume, ctx.currentTime + duration - 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (error) {
      console.warn('Web Audio synthesis failed:', error);
    }
  }, [isMuted, chimeEnabled]);

  /**
   * Vocalizes clinical directions using the browser SpeechSynthesis engine.
   * Cancels prior announcements to prevent cumulative timing delays.
   */
  const speak = useCallback((text: string) => {
    if (isMuted || !voiceEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      // Cancel any ongoing speaking queues to immediately state-sync
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1; // Slightly accelerated pace for clear resus dispatch
      utterance.pitch = 1.0;
      
      // Auto-unlock speech synthesis if it hangs on iOS
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('Speech synthesis failed:', error);
    }
  }, [isMuted, voiceEnabled]);

  /**
   * Action: Rising triple chime signaling the start of the overall resuscitation code.
   */
  const playCodeStart = useCallback(() => {
    speak('Code timer started. Initiate continuous quality CPR.');
    setTimeout(() => playBeep(523.25, 0.12), 0); // C5
    setTimeout(() => playBeep(659.25, 0.12), 120); // E5
    setTimeout(() => playBeep(783.99, 0.25), 240); // G5
  }, [playBeep, speak]);

  /**
   * Action: Rhythm and pulse check warning chime (e.g. 15s before CPR cycle completes).
   */
  const playRhythmWarning = useCallback(() => {
    speak('Fifteen seconds left in CPR cycle. Prepare compressor swap and rhythm check.');
    // Double pulse tone
    for (let i = 0; i < 2; i++) {
      setTimeout(() => playBeep(440, 0.15, 'triangle'), i * 300);
    }
  }, [playBeep, speak]);

  /**
   * Action: CPR Cycle Complete alarm. Loud, repeating alarm.
   */
  const playCprComplete = useCallback(() => {
    speak('CPR cycle complete. Pause compressions. Check rhythm. Palpate pulse.');
    // Alternating high attention alarm
    for (let i = 0; i < 3; i++) {
      setTimeout(() => playBeep(880, 0.18, 'sine', 0.2), i * 350);
      setTimeout(() => playBeep(587.33, 0.18, 'sine', 0.2), i * 350 + 175);
    }
  }, [playBeep, speak]);

  /**
   * Action: Epinephrine administration warning.
   */
  const playEpiWarning = useCallback(() => {
    speak('Epinephrine is due. Prepare one milligram IV or IO.');
    setTimeout(() => playBeep(349.23, 0.15), 0); // F4
    setTimeout(() => playBeep(523.25, 0.25), 150); // C5
  }, [playBeep, speak]);

  /**
   * Action: Shock advised alert.
   */
  const playShockAdvised = useCallback(() => {
    speak('Shock advised. Clear the patient. Charging defibrillator.');
    // High alert triangle wave
    setTimeout(() => playBeep(659.25, 0.6, 'triangle', 0.25), 0);
  }, [playBeep, speak]);

  /**
   * Action: Shock administered alert.
   */
  const playShockDelivered = useCallback(() => {
    speak('Shock delivered. Resume compressions immediately.');
    setTimeout(() => playBeep(523.25, 0.15), 0);
    setTimeout(() => playBeep(261.63, 0.4, 'sine'), 150);
  }, [playBeep, speak]);

  /**
   * Action: ROSC achieved positive chimes.
   */
  const playRoscAchieved = useCallback(() => {
    speak('Return of spontaneous circulation achieved. Move to post cardiac arrest care.');
    // Happy, ascending arpeggio
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C4 to G5
    notes.forEach((freq, idx) => {
      setTimeout(() => playBeep(freq, 0.15, 'sine', 0.15), idx * 100);
    });
  }, [playBeep, speak]);

  /**
   * Unlocks the browser's AudioContext. Must be triggered from a direct user tap event.
   */
  const unlockAudio = useCallback(() => {
    getAudioContext();
  }, []);

  return {
    isMuted,
    voiceEnabled,
    chimeEnabled,
    setIsMuted,
    setVoiceEnabled,
    setChimeEnabled,
    playCodeStart,
    playRhythmWarning,
    playCprComplete,
    playEpiWarning,
    playShockAdvised,
    playShockDelivered,
    playRoscAchieved,
    unlockAudio,
    speak,
    playBeep
  };
};
