// Format mm:ss from a duration in ms
export function crFmt(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

// Format relative "time since" (e.g. "0:33" or "12m")
export function crSince(ms: number | null | undefined): string {
  if (ms == null) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 600) {
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${ss.toString().padStart(2, '0')}`;
  }
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${(m % 60).toString().padStart(2, '0')}`;
}

export function crClock(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
