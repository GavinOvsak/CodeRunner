import { useState, useRef } from 'react'
import type { Patient } from '../types'
import { crClock } from '../utils'
import { CRIcon } from './ui'

// ─────────────────────────────────────────────────────────────
// Color maps
// ─────────────────────────────────────────────────────────────
const CR_LOG_BG: Record<string, string> = {
  status: 'var(--surface-2)', task: 'var(--accent-soft)',
  med: 'var(--green-soft)', cpr: 'var(--red-soft)',
};
const CR_LOG_FG: Record<string, string> = {
  status: 'var(--ink-2)', task: 'var(--accent)',
  med: 'var(--green)', cpr: 'var(--red)',
};

// ─────────────────────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────────────────────
function crIconBtnLocal(): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: 8,
    background: 'transparent', border: 'none', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--ink-2)',
  };
}
function crIconBtnNav(): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 10,
    background: 'transparent', border: 'none', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--ink-2)',
  };
}
function crInputStyle(): React.CSSProperties {
  return {
    height: 36, padding: '0 10px', borderRadius: 8,
    background: '#fff', border: '1px solid var(--line-strong)',
    fontFamily: 'inherit', fontSize: 14, color: 'var(--ink)',
    outline: 'none',
  };
}
function crBtnSecondary(): React.CSSProperties {
  return {
    height: 34, padding: '0 12px', borderRadius: 8,
    background: '#fff', border: '1px solid var(--line-strong)',
    color: 'var(--ink)', fontSize: 13, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
  };
}
function crBtnPrimary(): React.CSSProperties {
  return {
    height: 34, padding: '0 14px', borderRadius: 8,
    background: 'var(--accent)', border: '1px solid var(--accent)',
    color: '#fff', fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
  };
}

// ─────────────────────────────────────────────────────────────
// CRLogEditModal
// ─────────────────────────────────────────────────────────────
interface CRLogEditModalProps {
  entry: { idx: number; at: number; text: string };
  startedAt: number;
  onChange: (patch: Partial<{ idx: number; at: number; text: string }>) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function CRLogEditModal({ entry, startedAt: _startedAt, onChange, onSave, onDelete, onClose }: CRLogEditModalProps) {
  const d = new Date(entry.at);
  const timeStr = d.toTimeString().slice(0, 8); // HH:MM:SS

  function applyTime(str: string) {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(str.trim());
    if (!m) return;
    const newD = new Date(entry.at);
    newD.setHours(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3] || '0', 10), 0);
    onChange({ at: newD.getTime() });
  }

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 70,
      background: 'rgba(20,18,12,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 16, padding: 16,
        maxWidth: 320, width: '100%',
        boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Edit event</h3>
          <button onClick={onClose} style={crIconBtnLocal()}><CRIcon name="close" size={20}/></button>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Time</span>
          <input
            className="mono"
            defaultValue={timeStr}
            onBlur={e => applyTime(e.target.value)}
            placeholder="HH:MM:SS"
            style={crInputStyle()}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Description</span>
          <input
            value={entry.text}
            onChange={e => onChange({ text: e.target.value })}
            style={crInputStyle()}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onDelete} style={{
            ...crBtnSecondary(), color: 'var(--red)', borderColor: 'color-mix(in srgb, var(--red) 30%, var(--line-strong))',
          }}>
            <CRIcon name="trash" size={14} /> Delete
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={crBtnSecondary()}>Cancel</button>
          <button onClick={onSave} style={crBtnPrimary()}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CRLogScreen
// ─────────────────────────────────────────────────────────────
interface CRLogScreenProps {
  patient: Patient;
  onBack: () => void;
  onUpdate: (mut: (p: Patient) => Patient) => void;
}

export function CRLogScreen({ patient, onBack, onUpdate }: CRLogScreenProps) {
  const entries = [...patient.log].map((e, idx) => ({ ...e, _idx: idx })).reverse();
  const [editing, setEditing] = useState<{ idx: number; at: number; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function askDelete(idx: number, ev: React.MouseEvent) {
    ev.stopPropagation();
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmDel(idx);
    confirmTimer.current = setTimeout(() => setConfirmDel(null), 2500);
  }
  function doDeleteFromRow(idx: number, ev: React.MouseEvent) {
    ev.stopPropagation();
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmDel(null);
    onUpdate(p => {
      const nextLog = p.log.filter((_, i) => i !== idx);
      nextLog.sort((a, b) => a.at - b.at);
      return { ...p, log: nextLog };
    });
  }

  function commitEdit() {
    if (!editing) return;
    const { idx, at, text } = editing;
    onUpdate(p => {
      const nextLog = p.log.map((e, i) => i === idx ? { ...e, at, text } : e);
      nextLog.sort((a, b) => a.at - b.at);
      return { ...p, log: nextLog };
    });
    setEditing(null);
  }
  function deleteEntry() {
    if (!editing) return;
    const { idx } = editing;
    onUpdate(p => {
      const nextLog = p.log.filter((_, i) => i !== idx);
      nextLog.sort((a, b) => a.at - b.at);
      return { ...p, log: nextLog };
    });
    setEditing(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <header style={{ paddingTop: 'env(safe-area-inset-top, 0px)', background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px 10px' }}>
          <button onClick={onBack} style={crIconBtnNav()}>
            <CRIcon name="chevron-left" size={22} />
          </button>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Event Log</div>
          <div style={{ width: 36 }} />
        </div>
      </header>
      <div className="cr-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 24px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
          {entries.length === 0 && (
            <div style={{ padding: '18px 14px', color: 'var(--ink-3)', fontSize: 14 }}>No events yet.</div>
          )}
          {entries.map((e, i) => {
            const isConfirming = confirmDel === e._idx;
            return (
              <div key={e._idx} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 6px 4px 14px',
                borderBottom: i === entries.length - 1 ? 'none' : '1px solid var(--line)',
                background: isConfirming ? 'color-mix(in srgb, var(--red) 8%, white)' : 'transparent',
              }}>
                <button onClick={() => setEditing({ idx: e._idx, at: e.at, text: e.text })} style={{
                  display: 'flex', alignItems: 'baseline', gap: 10, flex: 1,
                  padding: '8px 0',
                  background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer',
                  minWidth: 0,
                }}>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', minWidth: 76 }}>
                    {crClock(e.at)}
                  </div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '2px 5px', borderRadius: 4, minWidth: 38, textAlign: 'center',
                    background: CR_LOG_BG[e.type] || 'var(--surface-2)',
                    color: CR_LOG_FG[e.type] || 'var(--ink-2)',
                  }}>{e.type}</div>
                  <div style={{ flex: 1, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.text}</div>
                </button>
                {!isConfirming ? (
                  <button onClick={(ev) => askDelete(e._idx, ev)} aria-label="delete entry" style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: 'transparent', border: 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--ink-3)', cursor: 'pointer', flex: 'none',
                  }}>
                    <CRIcon name="close" size={16} />
                  </button>
                ) : (
                  <button onClick={(ev) => doDeleteFromRow(e._idx, ev)} style={{
                    height: 28, padding: '0 10px', borderRadius: 7,
                    background: 'var(--red)', border: 'none',
                    color: 'white', fontSize: 12, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    cursor: 'pointer', flex: 'none',
                  }}>
                    <CRIcon name="trash" size={12} color="white" />
                    Delete?
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 12, textAlign: 'center' }}>
          Started {crClock(patient.startedAt)} · {entries.length} event{entries.length === 1 ? '' : 's'} · tap a row to edit
        </div>
      </div>
      {editing && (
        <CRLogEditModal
          entry={editing}
          startedAt={patient.startedAt}
          onChange={(patch) => setEditing(prev => prev ? { ...prev, ...patch } : prev)}
          onSave={commitEdit}
          onDelete={deleteEntry}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
