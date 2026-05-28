import { useState, useEffect } from "react";
import type { Patient, PatientType } from "../types";
import { CRIcon } from "./ui";

interface CRHomeScreenProps {
  patients: Patient[];
  onNew: (type: PatientType) => void;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function crIconBtn(): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--ink-2)",
  };
}

export function crMenuItem(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    background: "transparent",
    border: "none",
    padding: "8px 10px",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    color: "var(--ink)",
    textAlign: "left",
    cursor: "pointer",
  };
}

export function CRNewButton({
  label,
  sub,
  onClick,
}: {
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "16px 14px",
        borderRadius: 14,
        background: "var(--ink)",
        color: "white",
        border: "none",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        textAlign: "left",
        width: "100%",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {sub}
      </div>
    </button>
  );
}

export function CRHomeScreen({
  patients,
  onNew,
  onOpen,
  onRename,
  onDelete,
}: CRHomeScreenProps) {
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt: () => Promise<void> } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function startedLabel(ts: number) {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const isYesterday = d.toDateString() === y.toDateString();
    const time = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    if (sameDay) return `Today · ${time}`;
    if (isYesterday) return `Yesterday · ${time}`;
    const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${date} · ${time}`;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg)",
      }}
    >
      <div style={{ paddingTop: "env(safe-area-inset-top, 0px)" }} />
      <div style={{ padding: "8px 22px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
            }}
          >
            Code<span style={{ color: "var(--accent)" }}>Runner</span>
          </h1>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-3)" }}>
            ACLS / PALS companion
          </div>
        </div>
        {installPrompt && (
          <button
            onClick={async () => {
              await installPrompt.prompt();
              setInstallPrompt(null);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              background: "var(--surface-2)",
              border: "1px solid var(--line-strong)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <CRIcon name="download" size={14} />
            Install App
          </button>
        )}
      </div>

      <div
        style={{
          padding: "14px 16px 8px",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 220px))",
          gap: 8,
        }}
      >
        <CRNewButton
          label="New Adult"
          sub="ACLS"
          onClick={() => onNew("adult")}
        />
        <CRNewButton
          label="New Child"
          sub="PALS"
          onClick={() => onNew("pediatric")}
        />
      </div>

      <div style={{ padding: "12px 22px 6px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
          }}
        >
          Recent
        </h2>
      </div>

      <div
        className="cr-scroll"
        style={{ flex: 1, overflowY: "auto", padding: "4px 12px 24px" }}
      >
        {patients.length === 0 && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px dashed var(--line-strong)",
              borderRadius: 14,
              padding: "22px 14px",
              textAlign: "center",
              color: "var(--ink-3)",
              fontSize: 13.5,
            }}
          >
            No prior codes. Start one above.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {patients.map((p) => {
            const active = p.cpr.active;
            return (
              <div
                key={p.id}
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${active ? "var(--red)" : "var(--line)"}`,
                  borderRadius: 14,
                  position: "relative",
                }}
              >
                <button
                  onClick={() => onOpen(p.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "12px 14px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: active
                        ? "color-mix(in srgb, var(--red) 12%, white)"
                        : "var(--surface-2)",
                      color: active ? "var(--red)" : "var(--ink-2)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "none",
                    }}
                  >
                    <CRIcon name="heart" size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "var(--ink)",
                        }}
                      >
                        {p.name}
                      </div>
                      {active && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            padding: "1px 5px",
                            borderRadius: 3,
                            background: "var(--red)",
                            color: "white",
                          }}
                        >
                          LIVE
                        </span>
                      )}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-3)",
                        marginTop: 2,
                      }}
                    >
                      {p.type === "pediatric" ? "PEDS" : "ADULT"} ·{" "}
                      {startedLabel(p.startedAt)}
                    </div>
                  </div>
                </button>
                <div
                  style={{
                    position: "absolute",
                    right: 6,
                    top: 6,
                    display: "flex",
                    gap: 2,
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const n = prompt("Rename patient", p.name);
                      if (n) onRename(p.id, n);
                    }}
                    style={crIconBtn()}
                  >
                    <CRIcon name="edit" size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this code?")) onDelete(p.id);
                    }}
                    style={{ ...crIconBtn(), color: "var(--red)" }}
                  >
                    <CRIcon name="close" size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
