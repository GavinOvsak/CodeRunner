import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Patient, PatientType } from "../types";
import { CRIcon } from "./ui";
import { SUPPORTED_LANGUAGES } from "../i18n/config";

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

const LANG_FLAGS: Record<string, string> = {
  en: "🇺🇸",
  fr: "🇫🇷",
  es: "🇪🇸",
  id: "🇮🇩",
  vi: "🇻🇳",
  zh: "🇨🇳",
  de: "🇩🇪",
};

function CRLangSwitcher() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = i18n.resolvedLanguage ?? "en";
  const ref = useState(() => ({ current: null as HTMLDivElement | null }))[0];

  return (
    <div
      ref={(el) => { ref.current = el; }}
      style={{ position: "relative" }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px 5px 8px",
          borderRadius: 20,
          background: "var(--surface)",
          border: "1px solid var(--line-strong)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink)",
          cursor: "pointer",
          boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
        }}
        aria-label="Language"
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{LANG_FLAGS[current] ?? "🌐"}</span>
        <span style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 600 }}>{current.toUpperCase()}</span>
        <CRIcon name="chevron-down" size={12} color="var(--ink-3)" />
      </button>
      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 49 }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 50,
              background: "var(--surface)",
              border: "1px solid var(--line-strong)",
              borderRadius: 12,
              boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
              minWidth: 190,
              overflow: "hidden",
              padding: "4px 0",
            }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => {
                  i18n.changeLanguage(lang);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "9px 14px",
                  background: lang === current ? "var(--accent-soft)" : "transparent",
                  border: "none",
                  textAlign: "left",
                  fontSize: 14,
                  fontWeight: lang === current ? 700 : 400,
                  color: lang === current ? "var(--accent)" : "var(--ink)",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{LANG_FLAGS[lang]}</span>
                <span>{t(`lang.${lang}`)}</span>
                {lang === current && (
                  <span style={{ marginLeft: "auto", color: "var(--accent)" }}>
                    <CRIcon name="check" size={14} color="var(--accent)" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function CRHomeScreen({
  patients,
  onNew,
  onOpen,
  onRename,
  onDelete,
}: CRHomeScreenProps) {
  const { t } = useTranslation();
  const [isDisclaimerCollapsed, setIsDisclaimerCollapsed] = useState(() => {
    return localStorage.getItem("cr_disclaimer_collapsed") === "true";
  });
  const [installPrompt, setInstallPrompt] = useState<
    (Event & { prompt: () => Promise<void> }) | null
  >(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
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
    if (sameDay) return `${t("home.today")} · ${time}`;
    if (isYesterday) return `${t("home.yesterday")} · ${time}`;
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
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ paddingTop: "env(safe-area-inset-top, 0px)" }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 120,
          height: 120,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <a
          href="https://gavinovsak.github.io/FOAMapps/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: "absolute",
            top: 26,
            right: -60,
            transform: "rotate(45deg)",
            width: 200,
            display: "block",
            padding: "7px 0",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            textAlign: "center",
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
            textDecoration: "none",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            pointerEvents: "auto",
          }}
        >
          #FOAM App
        </a>
      </div>
      <div
        style={{
          padding: "8px 22px 6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
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
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
              {t("home.subtitle")}
            </div>
            <CRLangSwitcher />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
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
              }}
            >
              <CRIcon name="download" size={14} />
              {t("home.installApp")}
            </button>
          )}
        </div>

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
          label={t("home.newAdult")}
          sub="ACLS"
          onClick={() => onNew("adult")}
        />
        <CRNewButton
          label={t("home.newChild")}
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
          {t("home.recent")}
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
            {t("home.noCodes")}
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
                          {t("home.activeCpr")}
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
                      {p.type === "pediatric" ? t("home.peds") : t("home.adult")} ·{" "}
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
                      const n = prompt(t("home.renamePrompt"), p.name);
                      if (n) onRename(p.id, n);
                    }}
                    style={crIconBtn()}
                  >
                    <CRIcon name="edit" size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t("home.confirmDelete"))) onDelete(p.id);
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

      {/* Collapsible Fixed-Bottom Medical Disclaimer */}
      <div
        onClick={(e) => {
          if ((e.target as HTMLElement).tagName === "A") return;
          const nextVal = !isDisclaimerCollapsed;
          localStorage.setItem("cr_disclaimer_collapsed", String(nextVal));
          setIsDisclaimerCollapsed(nextVal);
        }}
        style={{
          background: "var(--amber-soft)",
          borderTop: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
          borderLeft: "4px solid var(--amber)",
          padding: isDisclaimerCollapsed
            ? "10px 16px calc(10px + env(safe-area-inset-bottom, 0px))"
            : "14px 16px calc(14px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          flexDirection: "column",
          gap: isDisclaimerCollapsed ? 0 : 8,
          flexShrink: 0,
          position: "relative",
          transition: "padding 200ms ease",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: "var(--ink)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {t("home.disclaimer.title")}
          </div>
          <div
            style={{
              padding: 4,
              color: "var(--ink-2)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label={isDisclaimerCollapsed ? t("home.disclaimer.expand") : t("home.disclaimer.collapse")}
          >
            <CRIcon name={isDisclaimerCollapsed ? "plus" : "minus"} size={16} color="var(--ink-2)" />
          </div>
        </div>

        {!isDisclaimerCollapsed && (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-2)",
              lineHeight: 1.45,
              paddingRight: 12,
              animation: "crCountWipe 200ms ease both",
            }}
          >
            {t("home.disclaimer.before")}{" "}
            <a
              href="https://cpr.heart.org/en/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}
            >
              {t("home.disclaimer.ahaName")}
            </a>
            {t("home.disclaimer.after")}
          </div>
        )}
      </div>
    </div>
  );
}
