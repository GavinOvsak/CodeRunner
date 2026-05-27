import { useState } from 'react'
import type { Patient, PatientType } from '../types'
import { CRIcon } from './ui'

interface CRHomeScreenProps {
  patients: Patient[];
  onNew: (type: PatientType) => void;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function crIconBtn(): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 10,
    background: 'transparent', border: 'none', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--ink-2)',
  };
}

export function crMenuItem(): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    background: 'transparent', border: 'none', padding: '8px 10px', borderRadius: 6,
    fontSize: 14, fontWeight: 500, color: 'var(--ink)',
    textAlign: 'left', cursor: 'pointer',
  };
}

export function CRNewButton({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '16px 14px',
      borderRadius: 14, background: 'var(--ink)',
      color: 'white', border: 'none', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
      textAlign: 'left',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{sub}</div>
    </button>
  );
}

export function CRHomeScreen({ patients, onNew, onOpen, onRename, onDelete }: CRHomeScreenProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);

  function startedLabel(ts: number) {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const y = new Date(now); y.setDate(y.getDate() - 1);
    const isYesterday = d.toDateString() === y.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    if (sameDay) return `Today · ${time}`;
    if (isYesterday) return `Yesterday · ${time}`;
    const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${date} · ${time}`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div style={{ paddingTop: 60 }} />
      <div style={{ padding: '8px 22px 6px' }}>
        <h1 style={{
          margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: '-0.025em',
          lineHeight: 1.05,
        }}>
          Code<span style={{ color: 'var(--accent)' }}>Runner</span>
        </h1>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--ink-3)' }}>
          ACLS companion · not for clinical decision-making
        </div>
      </div>

      <div style={{ padding: '14px 16px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <CRNewButton label="New Adult" sub="ACLS" onClick={() => onNew('adult')} />
        <CRNewButton label="New Child" sub="PALS"  onClick={() => onNew('pediatric')} />
      </div>

      <div style={{ padding: '12px 22px 6px' }}>
        <h2 style={{
          margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--ink-3)',
        }}>Recent</h2>
      </div>

      <div className="cr-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 24px' }}>
        {patients.length === 0 && (
          <div style={{
            background: 'var(--surface)', border: '1px dashed var(--line-strong)', borderRadius: 14,
            padding: '22px 14px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5,
          }}>
            No prior codes. Start one above.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {patients.map(p => {
            const active = p.cpr.active;
            return (
              <div key={p.id} style={{
                background: 'var(--surface)',
                border: `1px solid ${active ? 'var(--red)' : 'var(--line)'}`,
                borderRadius: 14, position: 'relative',
              }}>
                <button onClick={() => onOpen(p.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '12px 14px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  textAlign: 'left',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: active ? 'color-mix(in srgb, var(--red) 12%, white)' : 'var(--surface-2)',
                    color: active ? 'var(--red)' : 'var(--ink-2)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flex: 'none',
                  }}>
                    <CRIcon name="heart" size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</div>
                      {active && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                          padding: '1px 5px', borderRadius: 3,
                          background: 'var(--red)', color: 'white',
                        }}>LIVE</span>
                      )}
                    </div>
                    <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                      {p.type === 'pediatric' ? 'PEDS' : 'ADULT'} · {startedLabel(p.startedAt)}
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === p.id ? null : p.id); }}
                  style={{
                    position: 'absolute', right: 6, top: 6, ...crIconBtn(),
                  }}>
                  <CRIcon name="kebab" size={18} />
                </button>
                {menuFor === p.id && (
                  <div style={{
                    position: 'absolute', right: 8, top: 40, zIndex: 30,
                    background: '#fff', border: '1px solid var(--line-strong)',
                    borderRadius: 10, padding: 4, boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                    minWidth: 140,
                  }}>
                    <button onClick={() => { setMenuFor(null); const n = prompt('Rename patient', p.name); if (n) onRename(p.id, n); }} style={crMenuItem()}>
                      <CRIcon name="edit" size={14} /> Rename
                    </button>
                    <button onClick={() => { setMenuFor(null); if (confirm('Delete this code?')) onDelete(p.id); }} style={{ ...crMenuItem(), color: 'var(--red)' }}>
                      <CRIcon name="trash" size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
