import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook to manage the Screen Wake Lock API.
 * Prevents mobile screens from turning off or dimming during high-stakes resuscitations.
 */
export const useScreenWakeLock = () => {
  const [supported, setSupported] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);
  const wakeLockSentinel = useRef<any>(null);

  // Check support on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      setSupported(true);
    }
  }, []);

  /**
   * Request a Screen Wake Lock.
   */
  const requestWakeLock = useCallback(async () => {
    if (!supported || wakeLockSentinel.current) return;

    try {
      wakeLockSentinel.current = await (navigator as any).wakeLock.request('screen');
      setIsActive(true);

      // Event triggered if wake lock is released externally (e.g., locking screen manually)
      wakeLockSentinel.current.addEventListener('release', () => {
        wakeLockSentinel.current = null;
        setIsActive(false);
      });
    } catch (err) {
      console.warn('Failed to acquire Screen Wake Lock:', err);
      setIsActive(false);
    }
  }, [supported]);

  /**
   * Release the Screen Wake Lock.
   */
  const releaseWakeLock = useCallback(async () => {
    if (!wakeLockSentinel.current) return;

    try {
      await wakeLockSentinel.current.release();
      wakeLockSentinel.current = null;
      setIsActive(false);
    } catch (err) {
      console.warn('Failed to release Screen Wake Lock:', err);
    }
  }, []);

  // Re-acquire lock on visibility changes if it was previously active
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (supported && wakeLockSentinel.current === null && isActive && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supported, isActive, requestWakeLock]);

  // Clean up lock on unmount
  useEffect(() => {
    return () => {
      if (wakeLockSentinel.current) {
        wakeLockSentinel.current.release().catch(() => {});
      }
    };
  }, []);

  return {
    supported,
    isActive,
    requestWakeLock,
    releaseWakeLock
  };
};
