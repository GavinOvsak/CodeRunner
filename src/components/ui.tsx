import { useState, useEffect, useRef } from 'react'
import type { DropdownOption } from '../types'

// ─────────────────────────────────────────────────────────────
// CRIcon
// ─────────────────────────────────────────────────────────────
export function CRIcon({ name, size = 18, color = 'currentColor' }: { name: string; size?: number; color?: string }): React.ReactElement | null {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'chevron-left':  return <svg {...props}><path d="M15 6l-6 6 6 6"/></svg>;
    case 'chevron-down':  return <svg {...props}><path d="M6 9l6 6 6-6"/></svg>;
    case 'chevron-right': return <svg {...props}><path d="M9 6l6 6-6 6"/></svg>;
    case 'list':          return <svg {...props}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
    case 'plus':          return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'kebab':         return <svg {...props}><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>;
    case 'pause':         return <svg {...props} fill={color} stroke="none"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>;
    case 'play':          return <svg {...props} fill={color} stroke="none"><path d="M7 5l12 7-12 7z"/></svg>;
    case 'info':          return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 8v0M11 12h1v5h1"/></svg>;
    case 'close':         return <svg {...props}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'search':        return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>;
    case 'check':         return <svg {...props}><path d="M5 12l5 5L20 7"/></svg>;
    case 'bolt':          return <svg viewBox="0 0 24 24" width={size} height={size} fill={color}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>;
    case 'heart':         return <svg {...props}><path d="M12 21s-7-4.5-9-9c-1.5-3 0-6 3-6 2 0 3 1 4 3 1-2 2-3 4-3 3 0 4.5 3 3 6-2 4.5-9 9-9 9z"/></svg>;
    case 'trash':         return <svg {...props}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>;
    case 'edit':          return <svg {...props}><path d="M4 20h4l10-10-4-4L4 16zM14 6l4 4"/></svg>;
    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────
// CRDropdown
// ─────────────────────────────────────────────────────────────
interface CRDropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  size?: 'md' | 'lg';
  tone?: string;
  disabled?: boolean;
  flashRedKey?: number | null;
}

function CRDropdownLabel({ value, options, placeholder }: { value: string; options: DropdownOption[]; placeholder: string }) {
  if (value === '?' || value == null || value === '') return <span>{placeholder}</span>;
  const opt = options.find(o => (typeof o === 'string' ? o : o.value) === value);
  if (!opt || typeof opt === 'string') return <span>{value}</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {opt.icon}
      <span>{opt.label}</span>
    </span>
  );
}

export function CRDropdown({ value, options, onChange, placeholder = '?', size = 'md', tone = 'neutral', disabled, flashRedKey }: CRDropdownProps) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(0);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (flashRedKey != null) setFlash(f => f + 1);
  }, [flashRedKey]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pad = size === 'lg' ? '8px 12px' : '4px 10px';
  const fs = size === 'lg' ? 18 : 16;

  const toneBg: Record<string, string> = {
    neutral: '#fff',
    accent: 'var(--accent-soft)',
    yes: 'var(--green-soft)',
    no: 'var(--red-soft)',
    altered: 'var(--amber-soft)',
  };
  const toneInk: Record<string, string> = {
    neutral: 'var(--ink)',
    accent: 'var(--accent)',
    yes: 'var(--green)',
    no: 'var(--red)',
    altered: 'var(--amber)',
  };

  const currentTone = (() => {
    if (tone !== 'auto') return tone;
    if (value === 'Yes')      return 'yes';
    if (value === 'No')       return 'no';
    if (value === 'Altered')  return 'altered';
    if (value === 'Sedated')  return 'accent';
    if (value === 'ETT')      return 'accent';
    if (value === 'Fast')     return 'altered';
    if (value === 'Slow')     return 'altered';
    if (value === 'Normal')   return 'yes';
    if (value === 'NSR')      return 'yes';
    if (['VF','VT'].includes(value))            return 'no';
    if (['PEA','Asystole'].includes(value))     return 'altered';
    if (['SVT','Afib','Aflutter','WideTach','SinusBrady'].includes(value)) return 'accent';
    return 'neutral';
  })();

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}
          className={flash > 0 ? 'cr-dd-wrap' : ''}>
      <button
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        key={'k'+flash}
        className={flash > 0 ? 'cr-flash-red' : ''}
        style={{
          background: disabled ? 'var(--surface-2)' : toneBg[currentTone] || '#fff',
          color: disabled ? 'var(--ink-3)' : toneInk[currentTone] || 'var(--ink)',
          border: '1px solid var(--line-strong)',
          borderRadius: 8,
          padding: pad, fontSize: fs, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          cursor: disabled ? 'not-allowed' : 'pointer',
          minWidth: 56,
          letterSpacing: '-0.005em',
          opacity: disabled ? 0.55 : 1,
          filter: disabled ? 'grayscale(60%)' : 'none',
        }}>
        <CRDropdownLabel value={value} options={options} placeholder={placeholder} />
        <CRIcon name="chevron-down" size={14} />
      </button>
      {open && !disabled && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 30,
          background: '#fff', border: '1px solid var(--line-strong)',
          borderRadius: 10, padding: 4, boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
          minWidth: 140, maxWidth: 200,
        }}>
          {options.map(opt => {
            const v = typeof opt === 'string' ? opt : opt.value;
            const label = typeof opt === 'string' ? opt : opt.label;
            const icon = typeof opt === 'string' ? null : opt.icon;
            return (
              <button key={v}
                onClick={() => { onChange(v); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  background: v === value ? 'var(--surface-2)' : 'transparent',
                  border: 'none', padding: '8px 10px', borderRadius: 6,
                  fontSize: 15, fontWeight: 500, color: 'var(--ink)',
                  textAlign: 'left', cursor: 'pointer',
                }}>
                {icon && <span style={{ color: 'var(--accent)' }}>{icon}</span>}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// CRSection
// ─────────────────────────────────────────────────────────────
interface CRSectionProps {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  accent?: boolean;
}

export function CRSection({ title, right, children, accent }: CRSectionProps) {
  return (
    <section style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 14,
      position: 'relative',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px 8px 14px',
        borderBottom: '1px solid var(--line)',
        background: accent ? 'var(--surface-2)' : 'transparent',
        borderTopLeftRadius: 14, borderTopRightRadius: 14,
      }}>
        <h2 style={{
          margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--ink-3)',
        }}>{title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{right}</div>
      </header>
      <div>{children}</div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// CRStatusRow
// ─────────────────────────────────────────────────────────────
interface CRStatusRowProps {
  label: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

export function CRStatusRow({ label, children, disabled }: CRStatusRowProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 8px 10px 14px', borderBottom: '1px solid var(--line)',
      background: disabled ? 'var(--surface-2)' : 'transparent',
    }}>
      <div style={{
        fontSize: 16, fontWeight: 500,
        color: disabled ? 'var(--ink-3)' : 'var(--ink-2)',
      }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
