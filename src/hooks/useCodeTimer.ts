import { useState, useEffect, useRef, useCallback } from 'react';

interface UseCodeTimerProps {
  epiIntervalSeconds: number; // Configurable Epi interval (e.g. 180, 240, 300)
  onCprWarning: () => void;   // Triggered at 15s remaining in CPR cycle
  onCprComplete: () => void;  // Triggered when CPR cycle reaches 0
  onEpiWarning: () => void;   // Triggered when Epi countdown reaches 0
}

export const useCodeTimer = ({
  epiIntervalSeconds,
  onCprWarning,
  onCprComplete,
  onEpiWarning
}: UseCodeTimerProps) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  
  // Total elapsed code time in milliseconds
  const [totalElapsedMs, setTotalElapsedMs] = useState<number>(0);
  
  // CPR cycle elapsed time in milliseconds (counts up to 120,000ms)
  const [cprElapsedMs, setCprElapsedMs] = useState<number>(0);
  
  // Epinephrine cycle elapsed time in milliseconds (counts up to epiInterval * 1000)
  const [epiElapsedMs, setEpiElapsedMs] = useState<number>(0);

  // References to anchor absolute wall clock calculations
  const codeStartTimeRef = useRef<number | null>(null);
  const accumulatedCodeMsRef = useRef<number>(0);

  const cprStartTimeRef = useRef<number | null>(null);
  const accumulatedCprMsRef = useRef<number>(0);

  const epiStartTimeRef = useRef<number | null>(null);
  const accumulatedEpiMsRef = useRef<number>(0);

  // Prevent double-firing of alerts at specific tick values
  const hasTriggeredCprWarningRef = useRef<boolean>(false);
  const hasTriggeredCprCompleteRef = useRef<boolean>(false);
  const hasTriggeredEpiWarningRef = useRef<boolean>(false);

  // Keep callback references fresh
  const onCprWarningRef = useRef(onCprWarning);
  const onCprCompleteRef = useRef(onCprComplete);
  const onEpiWarningRef = useRef(onEpiWarning);

  useEffect(() => {
    onCprWarningRef.current = onCprWarning;
    onCprCompleteRef.current = onCprComplete;
    onEpiWarningRef.current = onEpiWarning;
  }, [onCprWarning, onCprComplete, onEpiWarning]);

  // Main tick updates
  useEffect(() => {
    let intervalId: any = null;

    if (isRunning) {
      const tick = () => {
        const now = Date.now();

        // 1. Calculate overall elapsed time
        const total = (now - (codeStartTimeRef.current || now)) + accumulatedCodeMsRef.current;
        setTotalElapsedMs(total);

        // 2. Calculate CPR elapsed time
        const cpr = (now - (cprStartTimeRef.current || now)) + accumulatedCprMsRef.current;
        setCprElapsedMs(cpr);
        const cprSecs = Math.floor(cpr / 1000);
        const cprRemaining = Math.max(0, 120 - cprSecs);

        // Single-fire CPR 15s warning
        if (cprRemaining <= 15 && cprRemaining > 0 && !hasTriggeredCprWarningRef.current) {
          hasTriggeredCprWarningRef.current = true;
          onCprWarningRef.current();
        }

        // Single-fire CPR completion
        if (cprRemaining === 0 && !hasTriggeredCprCompleteRef.current) {
          hasTriggeredCprCompleteRef.current = true;
          onCprCompleteRef.current();
        }

        // 3. Calculate Epinephrine elapsed time
        const epi = (now - (epiStartTimeRef.current || now)) + accumulatedEpiMsRef.current;
        setEpiElapsedMs(epi);
        const epiSecs = Math.floor(epi / 1000);
        const epiRemaining = Math.max(0, epiIntervalSeconds - epiSecs);

        // Single-fire Epinephrine due
        if (epiRemaining === 0 && !hasTriggeredEpiWarningRef.current) {
          hasTriggeredEpiWarningRef.current = true;
          onEpiWarningRef.current();
        }
      };

      // Run 10 times a second for super responsive UI rendering
      intervalId = setInterval(tick, 100);
      tick(); // Immediate tick on run
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRunning, epiIntervalSeconds]);

  /**
   * Action: Starts the overall code timer and individual countdowns
   */
  const startTimer = useCallback(() => {
    if (isRunning) return;

    const now = Date.now();
    codeStartTimeRef.current = now;
    cprStartTimeRef.current = now;
    epiStartTimeRef.current = now;

    setIsRunning(true);
  }, [isRunning]);

  /**
   * Action: Pauses all active timers
   */
  const pauseTimer = useCallback(() => {
    if (!isRunning) return;

    const now = Date.now();
    
    // Accumulate running times before pausing
    accumulatedCodeMsRef.current += now - (codeStartTimeRef.current || now);
    accumulatedCprMsRef.current += now - (cprStartTimeRef.current || now);
    accumulatedEpiMsRef.current += now - (epiStartTimeRef.current || now);

    setIsRunning(false);
  }, [isRunning]);

  /**
   * Action: Resets all timers back to baseline
   */
  const resetTimer = useCallback(() => {
    setIsRunning(false);

    codeStartTimeRef.current = null;
    accumulatedCodeMsRef.current = 0;
    cprStartTimeRef.current = null;
    accumulatedCprMsRef.current = 0;
    epiStartTimeRef.current = null;
    accumulatedEpiMsRef.current = 0;

    hasTriggeredCprWarningRef.current = false;
    hasTriggeredCprCompleteRef.current = false;
    hasTriggeredEpiWarningRef.current = false;

    setTotalElapsedMs(0);
    setCprElapsedMs(0);
    setEpiElapsedMs(0);
  }, []);

  /**
   * Action: Resets the 2-minute CPR countdown cycle
   */
  const resetCprTimer = useCallback(() => {
    const now = Date.now();
    cprStartTimeRef.current = now;
    accumulatedCprMsRef.current = 0;
    hasTriggeredCprWarningRef.current = false;
    hasTriggeredCprCompleteRef.current = false;
    setCprElapsedMs(0);
  }, []);

  /**
   * Action: Resets the Epinephrine countdown cycle
   */
  const resetEpiTimer = useCallback(() => {
    const now = Date.now();
    epiStartTimeRef.current = now;
    accumulatedEpiMsRef.current = 0;
    hasTriggeredEpiWarningRef.current = false;
    setEpiElapsedMs(0);
  }, []);

  // Format milliseconds into mm:ss
  const formatTime = (ms: number): string => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const elapsedSeconds = Math.floor(totalElapsedMs / 1000);
  const cprRemaining = Math.max(0, 120 - Math.floor(cprElapsedMs / 1000));
  const epiRemaining = Math.max(0, epiIntervalSeconds - Math.floor(epiElapsedMs / 1000));

  return {
    isRunning,
    totalElapsedMs,
    cprElapsedMs,
    epiElapsedMs,
    elapsedSeconds,
    cprCountdown: cprRemaining,
    epiCountdown: epiRemaining,
    formatTime,
    startTimer,
    pauseTimer,
    resetTimer,
    resetCprTimer,
    resetEpiTimer
  };
};
