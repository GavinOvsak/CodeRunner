import { useState, useEffect, useRef, useCallback } from "react";
import type { DropdownOption } from "../types";

// ─────────────────────────────────────────────────────────────
// CRIcon
// ─────────────────────────────────────────────────────────────
export function CRIcon({
  name,
  size = 18,
  color = "currentColor",
}: {
  name: string;
  size?: number;
  color?: string;
}): React.ReactElement | null {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    flex: "none",
  };
  switch (name) {
    case "chevron-left":
      return (
        <svg {...props}>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...props}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...props}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case "list":
      return (
        <svg {...props}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "kebab":
      return (
        <svg {...props}>
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      );
    case "pause":
      return (
        <svg {...props} fill={color} stroke="none">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      );
    case "play":
      return (
        <svg {...props} fill={color} stroke="none">
          <path d="M7 5l12 7-12 7z" />
        </svg>
      );
    case "info":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v0M11 12h1v5h1" />
        </svg>
      );
    case "close":
      return (
        <svg {...props}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      );
    case "sync":
      return (
        <svg {...props}>
          <path d="M23 4v6h-6M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
        </svg>
      );
    case "bolt":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
        </svg>
      );
    case "heart":
      return (
        <svg {...props}>
          <path d="M12 21s-7-4.5-9-9c-1.5-3 0-6 3-6 2 0 3 1 4 3 1-2 2-3 4-3 3 0 4.5 3 3 6-2 4.5-9 9-9 9z" />
        </svg>
      );
    case "trash":
      return (
        <svg {...props}>
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
        </svg>
      );
    case "edit":
      return (
        <svg {...props}>
          <path d="M4 20h4l10-10-4-4L4 16zM14 6l4 4" />
        </svg>
      );
    case "download":
      return (
        <svg {...props}>
          <path d="M12 3v13M7 11l5 5 5-5M5 20h14" />
        </svg>
      );
    case "question":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3" />
          <line
            x1="12"
            y1="17"
            x2="12.01"
            y2="17"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
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
  size?: "md" | "lg";
  tone?: string;
  disabled?: boolean;
  flashRedKey?: number | null;
  buttonGroup?: boolean;
}

function CRDropdownLabel({
  value,
  options,
  placeholder,
}: {
  value: string;
  options: DropdownOption[];
  placeholder: string;
}) {
  if (value === "?" || value == null || value === "")
    return <span>{placeholder}</span>;
  const opt = options.find(
    (o) => (typeof o === "string" ? o : o.value) === value,
  );
  if (!opt || typeof opt === "string") return <span>{value}</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      {opt.icon}
      <span>{opt.label}</span>
    </span>
  );
}

/**
 * Estimates the minimum pixel width needed to render options as a button group.
 * Uses 14px per character (approximate glyph width at 15px font) + 24px for padding/borders.
 */
function estimateButtonGroupWidth(
  options: DropdownOption[],
  size: "md" | "lg",
): number {
  const charWidth = size === "lg" ? 10 : 8.5;
  const padPerBtn = size === "lg" ? 32 : 24;
  return options.reduce((sum, opt) => {
    const lbl = typeof opt === "string" ? opt : opt.label;
    return sum + lbl.length * charWidth + padPerBtn;
  }, 2); // +2 for outer border
}

export function CRDropdown({
  value,
  options,
  onChange,
  placeholder = "?",
  size = "md",
  tone = "neutral",
  disabled,
  flashRedKey,
  buttonGroup,
}: CRDropdownProps) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(0);
  const wrapRef = useRef<HTMLSpanElement>(null);

  /**
   * `useButtonGroup`: true when the parent container has enough room to display
   * all options inline. Only meaningful when the `buttonGroup` prop is set.
   * Defaults to true so there's no flicker on first render.
   */
  const [useButtonGroup, setUseButtonGroup] = useState(true);

  /**
   * Walks up the DOM from wrapRef to find the first ancestor whose width is
   * substantially wider than our own element (i.e. a full-width container rather
   * than a shrink-wrapped parent). We compare that stable width — minus a fixed
   * label allowance — against the estimated button group minimum width.
   */
  const checkWidth = useCallback(() => {
    if (!buttonGroup || !wrapRef.current) return;
    // Walk up until we find an ancestor at least 2× wider than our element,
    // stopping at body. This skips the shrink-wrapped wrapper divs.
    let el: HTMLElement | null = wrapRef.current.parentElement;
    const selfWidth = wrapRef.current.getBoundingClientRect().width || 1;
    while (el && el !== document.body) {
      const w = el.getBoundingClientRect().width;
      if (w > selfWidth * 1.5) break;
      el = el.parentElement;
    }
    const rowWidth = el ? el.getBoundingClientRect().width : window.innerWidth;
    // Measure the actual label element (first child of the row) + row padding
    const labelEl = el?.firstElementChild;
    const labelWidth = labelEl ? labelEl.getBoundingClientRect().width : 100;
    // CRStatusRow padding: 14px left + 8px right, plus 8px gap between label and control
    const labelAllowance = labelWidth + 30;
    const available = rowWidth - labelAllowance;
    const needed = estimateButtonGroupWidth(options, size);
    setUseButtonGroup(available >= needed);
  }, [buttonGroup, options, size]);

  useEffect(() => {
    if (!buttonGroup) return;
    // Initial check after paint so layout is settled
    const raf = requestAnimationFrame(checkWidth);
    // Observe the document root so any layout change (panel resize etc.) triggers
    const ro = new ResizeObserver(checkWidth);
    ro.observe(document.documentElement);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [buttonGroup, checkWidth]);

  useEffect(() => {
    if (flashRedKey != null) setFlash((f) => f + 1);
  }, [flashRedKey]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pad = size === "lg" ? "8px 12px" : "4px 10px";
  const fs = size === "lg" ? 18 : 16;

  const toneBg: Record<string, string> = {
    neutral: "#fff",
    accent: "var(--accent-soft)",
    yes: "var(--green-soft)",
    no: "var(--red-soft)",
    altered: "var(--amber-soft)",
  };
  const toneInk: Record<string, string> = {
    neutral: "var(--ink)",
    accent: "var(--accent)",
    yes: "var(--green)",
    no: "var(--red)",
    altered: "var(--amber)",
  };

  const getTone = (v: string) => {
    // 'symptomatic' tone: Yes=red (bad), No=green (good) — inverse of default
    if (tone === "symptomatic") {
      if (v === "Yes") return "no";
      if (v === "No") return "yes";
      return "neutral";
    }
    if (tone !== "auto") return tone;
    if (v === "Yes") return "yes";
    if (v === "No") return "no";
    if (v === "Altered") return "altered";
    if (v === "Sedated") return "accent";
    if (v === "ETT") return "accent";
    if (v === "Choking") return "no";
    if (v === "Low") return "no";
    if (v === "High") return "altered";
    if (v === "Fast") return "altered";
    if (v === "Slow") return "altered";
    if (v === "Normal") return "yes";
    if (v === "NSR") return "yes";
    if (["VF", "VT", "VF_pVT"].includes(v)) return "no";
    if (["PEA", "Asystole"].includes(v)) return "altered";
    if (["SVT", "AF", "WideTach", "SinusBrady"].includes(v)) return "accent";
    return "neutral";
  };
  const currentTone = getTone(value);

  if (buttonGroup && useButtonGroup) {
    if (disabled) {
      if (value === "?" || !value) {
        return (
          <span
            ref={wrapRef}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 10px",
              color: "var(--ink-3)",
              fontSize: fs,
              opacity: 0.45,
            }}
          >
            —
          </span>
        );
      }
      const opt = options.find(
        (o) => (typeof o === "string" ? o : o.value) === value,
      );
      const lbl = opt ? (typeof opt === "string" ? opt : opt.label) : value;
      const icon = opt && typeof opt !== "string" ? opt.icon : null;
      return (
        <span
          ref={wrapRef}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: size === "lg" ? "8px 14px" : "4px 10px",
            borderRadius: 8,
            background: toneBg[currentTone] || "var(--surface-2)",
            color: toneInk[currentTone] || "var(--ink-3)",
            fontSize: fs,
            fontWeight: 600,
            opacity: 0.65,
            border: "1px solid var(--line-strong)",
          }}
        >
          {icon}
          {lbl}
        </span>
      );
    }

    return (
      <span
        ref={wrapRef}
        key={"k" + flash}
        className={flash > 0 ? "cr-flash-red" : ""}
        style={{
          display: "inline-flex",
          alignItems: "stretch",
          border: "1px solid var(--line-strong)",
          borderRadius: 9,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {options.map((opt, i) => {
          const v = typeof opt === "string" ? opt : opt.value;
          const lbl = typeof opt === "string" ? opt : opt.label;
          const icon = typeof opt === "string" ? null : opt.icon;
          const selected = v === value;
          const btnTone = getTone(v);
          return (
            <button
              key={v}
              onClick={() => onChange(v)}
              style={{
                padding: size === "lg" ? "8px 14px" : "5px 10px",
                background: selected
                  ? toneBg[btnTone] || "var(--accent-soft)"
                  : "#fff",
                border: "none",
                borderLeft: i > 0 ? "1px solid var(--line-strong)" : "none",
                color: selected
                  ? toneInk[btnTone] || "var(--accent)"
                  : "var(--ink-3)",
                fontSize: fs - 1,
                fontWeight: selected ? 700 : 400,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                letterSpacing: "-0.005em",
                whiteSpace: "nowrap",
              }}
            >
              {icon}
              <span>{lbl}</span>
            </button>
          );
        })}
      </span>
    );
  }

  return (
    <span
      ref={wrapRef}
      style={{ position: "relative", display: "inline-flex" }}
      className={flash > 0 ? "cr-dd-wrap" : ""}
    >
      <button
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        key={"k" + flash}
        className={flash > 0 ? "cr-flash-red" : ""}
        style={{
          background: disabled
            ? "var(--surface-2)"
            : toneBg[currentTone] || "#fff",
          color: disabled
            ? "var(--ink-3)"
            : toneInk[currentTone] || "var(--ink)",
          border: "1px solid var(--line-strong)",
          borderRadius: 8,
          padding: pad,
          fontSize: fs,
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: disabled ? "not-allowed" : "pointer",
          minWidth: 56,
          letterSpacing: "-0.005em",
          opacity: disabled ? 0.55 : 1,
          filter: disabled ? "grayscale(60%)" : "none",
        }}
      >
        <CRDropdownLabel
          value={value}
          options={options}
          placeholder={placeholder}
        />
        <CRIcon name="chevron-down" size={14} />
      </button>
      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 30,
            background: "#fff",
            border: "1px solid var(--line-strong)",
            borderRadius: 10,
            padding: 4,
            boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
            minWidth: 140,
            maxWidth: 200,
          }}
        >
          {options.map((opt) => {
            const v = typeof opt === "string" ? opt : opt.value;
            const label = typeof opt === "string" ? opt : opt.label;
            const icon = typeof opt === "string" ? null : opt.icon;
            return (
              <button
                key={v}
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  background: v === value ? "var(--surface-2)" : "transparent",
                  border: "none",
                  padding: "8px 10px",
                  borderRadius: 6,
                  fontSize: 15,
                  fontWeight: 500,
                  color: "var(--ink)",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {icon && <span style={{ color: "var(--accent)" }}>{icon}</span>}
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
  className?: string;
}

export function CRSection({
  title,
  right,
  children,
  accent: _accent,
  className,
}: CRSectionProps) {
  return (
    <section
      className={className}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        position: "relative",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px 8px 14px",
          borderBottom: "1px solid var(--line)",
          background: "var(--accent-soft)",
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--accent)",
          }}
        >
          {title}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {right}
        </div>
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
  uncertain?: boolean;
  onInfo?: () => void;
  flashKey?: number | null;
}

export function CRStatusRow({
  label,
  children,
  disabled,
  uncertain,
  onInfo,
  flashKey,
}: CRStatusRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (flashKey == null) return;
    const el = rowRef.current;
    if (!el) return;
    el.classList.remove("cr-flash-row");
    void el.offsetWidth;
    el.classList.add("cr-flash-row");
  }, [flashKey]);

  return (
    <div
      ref={rowRef}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 8px 10px 14px",
        borderBottom: "1px solid var(--line)",
        background: disabled ? "var(--surface-2)" : "transparent",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingRight: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: disabled
              ? "var(--ink-3)"
              : uncertain
                ? "var(--ink-3)"
                : "var(--ink-2)",
          }}
        >
          {label}
          {uncertain && <span style={{ fontWeight: 400 }}>?</span>}
        </span>
        {onInfo && (
          <button
            onClick={onInfo}
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-3)",
              padding: 0,
            }}
          >
            <CRIcon name="question" size={15} color="var(--ink-3)" />
          </button>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
