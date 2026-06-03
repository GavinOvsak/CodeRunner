import { useState, useRef, useEffect } from "react";
import type { Patient } from "../types";
import { crNextTasks } from "../data";
import { CRIcon } from "./ui";

// ─── Types ───────────────────────────────────────────────────────────────────

type NodeType = "action" | "decision" | "drug" | "start" | "terminal" | "label";
type Side = "top" | "bottom" | "left" | "right";

interface FCNode {
  id: string;
  type: NodeType;
  lines: string[];
  cx: number;
  cy: number;
  w: number;
  h: number;
}

interface FCEdge {
  from: string;
  fromSide?: Side;
  to: string;
  toSide?: Side;
  label?: string;
  labelSide?: "left" | "right";
  via?: [number, number][];
  dashed?: boolean;
}

interface AlgoDef {
  id: string;
  title: string;
  forType: "adult" | "pediatric" | "both";
  svgWidth: number;
  svgHeight: number;
  nodes: FCNode[];
  edges: FCEdge[];
  isApplicable: (s: Patient) => boolean;
  getActiveNodes: (s: Patient) => { current: Set<string>; done: Set<string> };
}

// ─── Node color palette ───────────────────────────────────────────────────────

const NODE_FILL: Record<NodeType, string> = {
  start:    "#fff3e0",
  action:   "#e3eeff",
  decision: "#fde8e8",
  drug:     "#ffebee",
  terminal: "#e8f5e9",
  label:    "#f0f0f0",
};
const NODE_STROKE: Record<NodeType, string> = {
  start:    "#e67e22",
  action:   "#3d6dd4",
  decision: "#c0392b",
  drug:     "#d32f2f",
  terminal: "#2e7d32",
  label:    "#9e9e9e",
};

// ─── SVG helpers ─────────────────────────────────────────────────────────────

function nodePoint(n: FCNode, side: Side): [number, number] {
  switch (side) {
    case "top":    return [n.cx, n.cy - n.h / 2];
    case "bottom": return [n.cx, n.cy + n.h / 2];
    case "left":   return [n.cx - n.w / 2, n.cy];
    case "right":  return [n.cx + n.w / 2, n.cy];
  }
}

function defaultEdgeSides(from: FCNode, to: FCNode): [Side, Side] {
  if (to.cy > from.cy + 10) return ["bottom", "top"];
  if (to.cx > from.cx + 10) return ["right", "left"];
  if (to.cx < from.cx - 10) return ["left", "right"];
  return ["bottom", "top"];
}

function buildPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  const [first, ...rest] = pts;
  return `M${first[0]},${first[1]} ` + rest.map(([x, y]) => `L${x},${y}`).join(" ");
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function renderNode(
  n: FCNode,
  isCurrent: boolean,
  isDone: boolean,
  fontSize: number = 9.5,
) {
  const fill = isCurrent ? "#fffde7" : isDone ? "#f0f4ff" : NODE_FILL[n.type];
  const stroke = isCurrent ? "#f59e0b" : isDone ? "#7986cb" : NODE_STROKE[n.type];
  const strokeW = isCurrent ? 2.5 : 1.5;
  const textColor = isCurrent ? "#7c4f00" : isDone ? "#3949ab" : "#1a1a2e";

  const lineH = fontSize * 1.3;
  const sharedText = (
    <text
      x={n.cx}
      y={n.cy}
      textAnchor="middle"
      fontSize={fontSize}
      fill={textColor}
      fontWeight={isCurrent ? 700 : 500}
      fontFamily="system-ui, sans-serif"
    >
      {n.lines.map((line, i) => (
        <tspan
          key={i}
          x={n.cx}
          dy={i === 0 ? -((n.lines.length - 1) * lineH) / 2 : lineH}
        >
          {line}
        </tspan>
      ))}
    </text>
  );

  if (n.type === "decision") {
    const hw = n.w / 2, hh = n.h / 2;
    const pts = `${n.cx},${n.cy - hh} ${n.cx + hw},${n.cy} ${n.cx},${n.cy + hh} ${n.cx - hw},${n.cy}`;
    return (
      <g key={n.id}>
        <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeW} />
        {sharedText}
      </g>
    );
  }

  if (n.type === "label") {
    return (
      <g key={n.id}>
        <rect
          x={n.cx - n.w / 2} y={n.cy - n.h / 2}
          width={n.w} height={n.h}
          rx={n.h / 2} ry={n.h / 2}
          fill={fill} stroke={stroke} strokeWidth={1}
        />
        {sharedText}
      </g>
    );
  }

  const rx = n.type === "terminal" ? n.h / 2 : 6;
  return (
    <g key={n.id}>
      <rect
        x={n.cx - n.w / 2} y={n.cy - n.h / 2}
        width={n.w} height={n.h}
        rx={rx} ry={rx}
        fill={fill} stroke={stroke} strokeWidth={strokeW}
      />
      {sharedText}
    </g>
  );
}

function renderEdge(
  e: FCEdge,
  nodeMap: Map<string, FCNode>,
  idx: number,
) {
  const fromN = nodeMap.get(e.from);
  const toN = nodeMap.get(e.to);
  if (!fromN || !toN) return null;

  const [defFrom, defTo] = defaultEdgeSides(fromN, toN);
  const fromSide = e.fromSide ?? defFrom;
  const toSide = e.toSide ?? defTo;
  const fp = nodePoint(fromN, fromSide);
  const tp = nodePoint(toN, toSide);

  const pts: [number, number][] = e.via
    ? [fp, ...e.via, tp]
    : [fp, tp];

  const mid = pts[Math.floor(pts.length / 2)];
  const labelX = e.labelSide === "right" ? mid[0] + 4 : e.labelSide === "left" ? mid[0] - 4 : mid[0];
  const labelAnchor = e.labelSide === "right" ? "start" : e.labelSide === "left" ? "end" : "middle";

  return (
    <g key={idx}>
      <path
        d={buildPath(pts)}
        fill="none"
        stroke="#555"
        strokeWidth={1.2}
        strokeDasharray={e.dashed ? "4 3" : undefined}
        markerEnd="url(#arw)"
      />
      {e.label && (
        <text
          x={labelX}
          y={mid[1] - 3}
          textAnchor={labelAnchor}
          fontSize={8}
          fill="#c0392b"
          fontWeight={600}
          fontFamily="system-ui, sans-serif"
        >
          {e.label}
        </text>
      )}
    </g>
  );
}

// ─── FlowChart SVG Component ─────────────────────────────────────────────────

function FlowChart({
  algo,
  current,
  done,
}: {
  algo: AlgoDef;
  current: Set<string>;
  done: Set<string>;
}) {
  const nodeMap = new Map(algo.nodes.map((n) => [n.id, n]));

  return (
    <svg
      viewBox={`0 0 ${algo.svgWidth} ${algo.svgHeight}`}
      width="100%"
      style={{ display: "block", maxWidth: algo.svgWidth }}
    >
      <defs>
        <marker id="arw" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
          <path d="M0,0 L7,3 L0,6 Z" fill="#555" />
        </marker>
      </defs>
      {/* Edges first (behind nodes) */}
      {algo.edges.map((e, i) => renderEdge(e, nodeMap, i))}
      {/* Nodes */}
      {algo.nodes.map((n) =>
        renderNode(n, current.has(n.id), done.has(n.id))
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Algorithm Definitions
// ─────────────────────────────────────────────────────────────────────────────

function isShockable(s: Patient) {
  return s.rhythm === "VF" || s.rhythm === "VT" || s.rhythm === "VF_pVT" || s.rhythm === "TdP";
}
function isNonShockable(s: Patient) {
  return s.rhythm === "PEA" || s.rhythm === "Asystole";
}
function givenCount(s: Patient, key: string) {
  return s.gave.find((g) => g.key === key)?.doses.length ?? 0;
}

// ─── Adult Cardiac Arrest ────────────────────────────────────────────────────

const ADULT_CA: AlgoDef = {
  id: "adult-ca",
  title: "Adult Cardiac Arrest",
  forType: "adult",
  svgWidth: 360,
  svgHeight: 870,
  isApplicable: (s) => s.type === "adult" && (s.pulse === "No" || s.cpr.active),
  getActiveNodes(s) {
    const current = new Set<string>();
    const done = new Set<string>();
    if (s.type !== "adult") return { current, done };
    if (s.pulse !== "No" && !s.cpr.active) return { current, done };

    const shocks = givenCount(s, "shock");
    const epis = givenCount(s, "epi");
    const amios = givenCount(s, "amio");
    const lidos = givenCount(s, "lido");
    const roscDone = s.doneTasks["rosc"] === true;

    if (!s.cpr.active) { current.add("n1"); return { current, done }; }
    done.add("n1");
    if (roscDone) { current.add("n12"); return { current, done }; }

    if (isShockable(s)) {
      done.add("dR"); current.add("lVF");
      if (shocks === 0) { current.add("n3"); }
      else {
        done.add("n3");
        if (shocks === 1) { current.add("n4"); }
        else {
          done.add("n4");
          if (shocks < 3) {
            if (s.cpr.pausedAt) current.add("n5"); else current.add("dR2L");
          } else if (shocks >= 3) {
            done.add("n5");
            if (epis < 2 && amios === 0 && lidos === 0) { current.add("n6"); }
            else if (amios === 0 && lidos === 0) {
              if (s.cpr.pausedAt) current.add("n7"); else current.add("dR3L");
            } else {
              done.add("n6");
              if (shocks < 4) current.add("n7"); else { done.add("n7"); current.add("n8"); }
            }
          }
        }
      }
    } else if (isNonShockable(s)) {
      done.add("dR"); current.add("lAS");
      if (epis === 0) { current.add("n9"); }
      else { done.add("n9"); }
      if (shocks === 0) { current.add("n10"); }
      else { done.add("n10"); current.add("n11"); }
    } else {
      current.add("dR");
    }
    return { current, done };
  },
  nodes: [
    { id: "n1",   type: "start",    lines: ["1 · Start CPR", "• Bag-mask ventilation", "• Attach monitor/defib"], cx: 180, cy: 50,  w: 205, h: 62 },
    { id: "dR",   type: "decision", lines: ["Rhythm", "shockable?"],         cx: 180, cy: 155, w: 168, h: 68 },
    { id: "lVF",  type: "label",    lines: ["2 VF/pVT"],                     cx: 64,  cy: 155, w: 85,  h: 30 },
    { id: "lAS",  type: "label",    lines: ["9 Asystole/PEA"],               cx: 296, cy: 155, w: 100, h: 30 },
    { id: "n3",   type: "drug",     lines: ["3 ⚡ Shock"],                    cx: 64,  cy: 218, w: 88,  h: 38 },
    { id: "n9",   type: "drug",     lines: ["Epinephrine", "ASAP"],          cx: 296, cy: 212, w: 95,  h: 42 },
    { id: "n4",   type: "action",   lines: ["4 CPR 2 min", "IV/IO access"],  cx: 64,  cy: 293, w: 118, h: 52 },
    { id: "n10",  type: "action",   lines: ["10 CPR 2 min", "• IV/IO", "• Epi q3-5min", "• Adv. airway"], cx: 296, cy: 303, w: 108, h: 80 },
    { id: "dR2L", type: "decision", lines: ["Rhythm", "shockable?"],         cx: 80,  cy: 402, w: 138, h: 58 },
    { id: "dR2R", type: "decision", lines: ["Rhythm", "shockable?"],         cx: 280, cy: 412, w: 138, h: 58 },
    { id: "n5",   type: "drug",     lines: ["5 ⚡ Shock"],                    cx: 80,  cy: 480, w: 88,  h: 38 },
    { id: "n11",  type: "action",   lines: ["11 CPR 2 min", "Treat reversible causes"], cx: 280, cy: 478, w: 114, h: 52 },
    { id: "n6",   type: "action",   lines: ["6 CPR 2 min", "• Epi q3-5min", "• Consider airway"], cx: 80, cy: 568, w: 120, h: 68 },
    { id: "dR3L", type: "decision", lines: ["Rhythm", "shockable?"],         cx: 80,  cy: 670, w: 138, h: 58 },
    { id: "dR3R", type: "decision", lines: ["Rhythm", "shockable?"],         cx: 280, cy: 568, w: 138, h: 58 },
    { id: "n7",   type: "drug",     lines: ["7 ⚡ Shock"],                    cx: 80,  cy: 748, w: 88,  h: 38 },
    { id: "n8",   type: "action",   lines: ["8 CPR 2 min", "• Amio or Lido", "• Treat reversible causes"], cx: 80, cy: 826, w: 122, h: 65 },
    { id: "n12",  type: "terminal", lines: ["12 · If no ROSC → step 10", "If ROSC → post-CA care"], cx: 220, cy: 856, w: 240, h: 52 },
  ],
  edges: [
    { from: "n1",   to: "dR" },
    { from: "dR",   fromSide: "left",   to: "lVF",  toSide: "right",  label: "Yes", labelSide: "left" },
    { from: "dR",   fromSide: "right",  to: "lAS",  toSide: "left",   label: "No",  labelSide: "right" },
    { from: "lVF",  to: "n3" },
    { from: "lAS",  to: "n9" },
    { from: "n3",   to: "n4" },
    { from: "n9",   to: "n10" },
    { from: "n4",   to: "dR2L" },
    { from: "n10",  to: "dR2R" },
    { from: "dR2L", fromSide: "bottom", to: "n5",  label: "Yes", labelSide: "left" },
    { from: "dR2L", fromSide: "right",  to: "dR2R", toSide: "left",  label: "No", via: [[190, 402]], dashed: true },
    { from: "dR2R", fromSide: "left",   to: "n5",   toSide: "right",  label: "Yes", via: [[175, 412], [175, 480]] },
    { from: "dR2R", fromSide: "bottom", to: "n11",  label: "No", labelSide: "right" },
    { from: "n5",   to: "n6" },
    { from: "n11",  to: "dR3R" },
    { from: "n6",   to: "dR3L" },
    { from: "dR3L", fromSide: "bottom", to: "n7",  label: "Yes", labelSide: "left" },
    { from: "dR3L", fromSide: "right",  to: "dR3R", toSide: "left",  label: "No", via: [[190, 670], [190, 568]], dashed: true },
    { from: "dR3R", fromSide: "left",   to: "n5",   toSide: "right",  label: "Yes", via: [[175, 568], [175, 480]], dashed: true },
    { from: "dR3R", fromSide: "bottom", to: "n12",  label: "No", via: [[280, 598], [280, 856]] },
    { from: "n7",   to: "n8" },
    { from: "n8",   fromSide: "right",  to: "n12",  toSide: "left",   via: [[155, 826], [155, 856]] },
  ],
};

// ─── Pediatric Cardiac Arrest ────────────────────────────────────────────────

const PEDS_CA: AlgoDef = {
  id: "peds-ca",
  title: "Pediatric Cardiac Arrest",
  forType: "pediatric",
  svgWidth: 360,
  svgHeight: 870,
  isApplicable: (s) => s.type === "pediatric" && (s.pulse === "No" || s.cpr.active),
  getActiveNodes(s) {
    const current = new Set<string>();
    const done = new Set<string>();
    if (s.type !== "pediatric") return { current, done };
    if (s.pulse !== "No" && !s.cpr.active) return { current, done };

    const shocks = givenCount(s, "shock");
    const epis = givenCount(s, "epi");
    const amios = givenCount(s, "amio");
    const lidos = givenCount(s, "lido");
    const roscDone = s.doneTasks["rosc"] === true;

    if (!s.cpr.active) { current.add("p1"); return { current, done }; }
    done.add("p1");
    if (roscDone) { current.add("p12"); return { current, done }; }

    if (isShockable(s)) {
      done.add("pdR"); current.add("plVF");
      if (shocks === 0) { current.add("p3"); }
      else {
        done.add("p3");
        if (shocks === 1) { current.add("p4"); }
        else {
          done.add("p4");
          if (shocks < 3) {
            if (s.cpr.pausedAt) current.add("p5"); else current.add("pdR2L");
          } else {
            done.add("p5");
            if (epis < 2 && amios === 0 && lidos === 0) { current.add("p6"); }
            else if (amios === 0 && lidos === 0) {
              if (s.cpr.pausedAt) current.add("p7"); else current.add("pdR3L");
            } else {
              done.add("p6"); current.add("p8");
            }
          }
        }
      }
    } else if (isNonShockable(s)) {
      done.add("pdR"); current.add("plAS");
      if (epis === 0) current.add("p9"); else done.add("p9");
      if (shocks === 0) current.add("p10"); else { done.add("p10"); current.add("p11"); }
    } else {
      current.add("pdR");
    }
    return { current, done };
  },
  nodes: [
    { id: "p1",    type: "start",    lines: ["1 · Start CPR", "• Bag-mask ventilation", "• Attach monitor/defib"], cx: 180, cy: 50,  w: 205, h: 62 },
    { id: "pdR",   type: "decision", lines: ["Rhythm", "shockable?"],          cx: 180, cy: 155, w: 168, h: 68 },
    { id: "plVF",  type: "label",    lines: ["2 VF/pVT"],                      cx: 64,  cy: 155, w: 85,  h: 30 },
    { id: "plAS",  type: "label",    lines: ["9 Asystole/PEA"],                cx: 296, cy: 155, w: 100, h: 30 },
    { id: "p3",    type: "drug",     lines: ["3 ⚡ Shock ASAP", "2 J/kg"],      cx: 64,  cy: 218, w: 100, h: 42 },
    { id: "p9",    type: "drug",     lines: ["Epinephrine", "ASAP"],           cx: 296, cy: 212, w: 95,  h: 42 },
    { id: "p4",    type: "action",   lines: ["4 CPR 2 min", "IV/IO access"],   cx: 64,  cy: 295, w: 118, h: 52 },
    { id: "p10",   type: "action",   lines: ["10 CPR 2 min", "• IV/IO", "• Epi q3-5min", "• Adv. airway"], cx: 296, cy: 303, w: 108, h: 80 },
    { id: "pdR2L", type: "decision", lines: ["Rhythm", "shockable?"],          cx: 80,  cy: 402, w: 138, h: 58 },
    { id: "pdR2R", type: "decision", lines: ["Rhythm", "shockable?"],          cx: 280, cy: 412, w: 138, h: 58 },
    { id: "p5",    type: "drug",     lines: ["5 ⚡ Shock ASAP", "4 J/kg"],      cx: 80,  cy: 480, w: 100, h: 42 },
    { id: "p11",   type: "action",   lines: ["11 CPR 2 min", "Treat reversible causes"], cx: 280, cy: 478, w: 114, h: 52 },
    { id: "p6",    type: "action",   lines: ["6 CPR 2 min", "• Epi q3-5min", "• Consider airway"], cx: 80, cy: 568, w: 120, h: 68 },
    { id: "pdR3L", type: "decision", lines: ["Rhythm", "shockable?"],          cx: 80,  cy: 670, w: 138, h: 58 },
    { id: "pdR3R", type: "decision", lines: ["Rhythm", "shockable?"],          cx: 280, cy: 568, w: 138, h: 58 },
    { id: "p7",    type: "drug",     lines: ["7 ⚡ Shock ASAP", "≥4 J/kg"],     cx: 80,  cy: 748, w: 100, h: 42 },
    { id: "p8",    type: "action",   lines: ["8 CPR 2 min", "• Amio or Lido", "• Treat reversible causes"], cx: 80, cy: 826, w: 122, h: 65 },
    { id: "p12",   type: "terminal", lines: ["12 · If no ROSC → step 10", "If ROSC → post-CA care"], cx: 220, cy: 856, w: 240, h: 52 },
  ],
  edges: [
    { from: "p1",    to: "pdR" },
    { from: "pdR",   fromSide: "left",   to: "plVF",  toSide: "right", label: "Yes", labelSide: "left" },
    { from: "pdR",   fromSide: "right",  to: "plAS",  toSide: "left",  label: "No",  labelSide: "right" },
    { from: "plVF",  to: "p3" },
    { from: "plAS",  to: "p9" },
    { from: "p3",    to: "p4" },
    { from: "p9",    to: "p10" },
    { from: "p4",    to: "pdR2L" },
    { from: "p10",   to: "pdR2R" },
    { from: "pdR2L", fromSide: "bottom", to: "p5",  label: "Yes", labelSide: "left" },
    { from: "pdR2L", fromSide: "right",  to: "pdR2R", toSide: "left", label: "No", via: [[190, 402]], dashed: true },
    { from: "pdR2R", fromSide: "left",   to: "p5",  toSide: "right", label: "Yes", via: [[175, 412], [175, 480]] },
    { from: "pdR2R", fromSide: "bottom", to: "p11", label: "No", labelSide: "right" },
    { from: "p5",    to: "p6" },
    { from: "p11",   to: "pdR3R" },
    { from: "p6",    to: "pdR3L" },
    { from: "pdR3L", fromSide: "bottom", to: "p7",  label: "Yes", labelSide: "left" },
    { from: "pdR3L", fromSide: "right",  to: "pdR3R", toSide: "left", label: "No", via: [[190, 670], [190, 568]], dashed: true },
    { from: "pdR3R", fromSide: "left",   to: "p5",  toSide: "right", label: "Yes", via: [[175, 568], [175, 480]], dashed: true },
    { from: "pdR3R", fromSide: "bottom", to: "p12", label: "No", via: [[280, 598], [280, 856]] },
    { from: "p7",    to: "p8" },
    { from: "p8",    fromSide: "right",  to: "p12", toSide: "left",  via: [[155, 826], [155, 856]] },
  ],
};

// ─── Adult Tachycardia with a Pulse ─────────────────────────────────────────

const ADULT_TACHY: AlgoDef = {
  id: "adult-tachy",
  title: "Tachycardia with Pulse",
  forType: "adult",
  svgWidth: 360,
  svgHeight: 580,
  isApplicable: (s) => s.pulse === "Yes" && s.rate === "Fast",
  getActiveNodes(s) {
    const current = new Set<string>();
    const done = new Set<string>();
    if (s.pulse !== "Yes" || s.rate !== "Fast") return { current, done };

    const symptomatic = s.symptomatic === "Yes";
    const rhythm = s.rhythm;
    const adenoGiven = givenCount(s, "adenosine") > 0;
    const amioGiven = givenCount(s, "amio") > 0;
    const procainGiven = givenCount(s, "procain") > 0;
    const cardioverted = givenCount(s, "shock") > 0;

    done.add("ta1"); // assess always done

    if (s.symptomatic === "?") { current.add("tdSx"); return { current, done }; }
    done.add("tdSx");

    if (symptomatic) {
      current.add("ta_cardio");
      if (cardioverted) { done.add("ta_cardio"); current.add("ta_reassess"); }
    } else {
      done.add("ta2");
      if (rhythm === "?") { current.add("tdWide"); return { current, done }; }

      if (rhythm === "WideTach") {
        done.add("tdWide");
        current.add("ta_wide");
        if (amioGiven || procainGiven) { done.add("ta_wide"); current.add("ta_reassess"); }
      } else if (rhythm === "SVT" || rhythm === "AF") {
        done.add("tdWide");
        current.add("ta_narrow");
        if (adenoGiven) { done.add("ta_narrow"); current.add("ta_reassess"); }
      } else {
        done.add("tdWide");
        current.add("ta_narrow");
      }
    }
    return { current, done };
  },
  nodes: [
    { id: "ta1",        type: "start",    lines: ["Assess Rate & Rhythm", "HR typically ≥150/min"],  cx: 180, cy: 42,  w: 210, h: 52 },
    { id: "ta2",        type: "action",   lines: ["Initial Assessment & Support", "• Patent airway, O2", "• IV access, 12-lead ECG", "• Monitor BP & SpO2"], cx: 180, cy: 138, w: 220, h: 70 },
    { id: "tdSx",       type: "decision", lines: ["Unstable?", "(hypotension, shock,", "AMS, ischemia,", "acute HF)"],     cx: 180, cy: 265, w: 200, h: 82 },
    { id: "ta_cardio",  type: "drug",     lines: ["Synchronized", "Cardioversion", "(sedate if feasible)"],               cx: 288, cy: 380, w: 125, h: 58 },
    { id: "tdWide",     type: "decision", lines: ["Wide QRS?", "≥0.12 sec"],                                               cx: 100, cy: 380, w: 135, h: 58 },
    { id: "ta_wide",    type: "action",   lines: ["• Adenosine if regular", "• Antiarrhythmic infusion", "• Expert consult"], cx: 80, cy: 482, w: 148, h: 62 },
    { id: "ta_narrow",  type: "action",   lines: ["• Vagal maneuvers", "• Adenosine (if regular)", "• β-blocker or CCB", "• Expert consult"],                cx: 280, cy: 490, w: 148, h: 70 },
    { id: "ta_reassess",type: "terminal", lines: ["Reassess / Expert Consult"],                                            cx: 180, cy: 558, w: 200, h: 40 },
  ],
  edges: [
    { from: "ta1",       to: "ta2" },
    { from: "ta2",       to: "tdSx" },
    { from: "tdSx",      fromSide: "right",  to: "ta_cardio",  toSide: "top",    label: "Yes" },
    { from: "tdSx",      fromSide: "bottom", to: "tdWide",     toSide: "top",    label: "No", via: [[100, 307]] },
    { from: "tdWide",    fromSide: "bottom", to: "ta_wide",    label: "Yes" },
    { from: "tdWide",    fromSide: "right",  to: "ta_narrow",  toSide: "left",   label: "No" },
    { from: "ta_cardio", fromSide: "bottom", to: "ta_reassess",toSide: "right",  via: [[288, 558]] },
    { from: "ta_wide",   fromSide: "bottom", to: "ta_reassess",toSide: "left",   via: [[80, 558]] },
    { from: "ta_narrow", fromSide: "bottom", to: "ta_reassess",via: [[280, 558]] },
  ],
};

// ─── Adult Bradycardia with a Pulse ─────────────────────────────────────────

const ADULT_BRADY: AlgoDef = {
  id: "adult-brady",
  title: "Bradycardia with Pulse",
  forType: "adult",
  svgWidth: 360,
  svgHeight: 600,
  isApplicable: (s) => s.pulse === "Yes" && s.rate === "Slow",
  getActiveNodes(s) {
    const current = new Set<string>();
    const done = new Set<string>();
    if (s.pulse !== "Yes" || s.rate !== "Slow") return { current, done };

    const symptomatic = s.symptomatic;
    const atropineGiven = givenCount(s, "atropine") > 0;
    const pacer = s.gave.find((g) => g.key === "pace");
    const pacerOn = pacer != null;
    const dopamine = givenCount(s, "dopamine") > 0;

    done.add("br1");

    if (symptomatic === "?") { current.add("bdSx"); return { current, done }; }
    done.add("bdSx");

    if (symptomatic === "No") {
      current.add("br_asymp");
    } else {
      done.add("br2");
      if (!atropineGiven) { current.add("br_atropine"); }
      else {
        done.add("br_atropine");
        if (!pacerOn && !dopamine) { current.add("br_pacing"); }
        else { done.add("br_pacing"); current.add("br_expert"); }
      }
    }
    return { current, done };
  },
  nodes: [
    { id: "br1",        type: "start",    lines: ["Assess Rate & Rhythm", "HR typically <50/min"],         cx: 180, cy: 42,  w: 210, h: 52 },
    { id: "bdSx",       type: "decision", lines: ["Cardiopulmonary", "compromise?", "(hypotension, AMS,", "shock, ischemia,", "acute HF)"], cx: 180, cy: 168, w: 185, h: 100 },
    { id: "br_asymp",   type: "action",   lines: ["• Identify & treat cause", "• Support ABCs", "• Consider O2", "• 12-lead ECG", "• Observe"],              cx: 295, cy: 250, w: 120, h: 88 },
    { id: "br2",        type: "action",   lines: ["Assessment & Support", "• Maintain airway, O2", "• Assist breathing PRN", "• Cardiac monitor", "• Monitor pulse"], cx: 90, cy: 268, w: 165, h: 88 },
    { id: "bdPersist",  type: "decision", lines: ["Bradycardia", "persists with", "compromise?"],          cx: 90,  cy: 410, w: 155, h: 68 },
    { id: "br_atropine",type: "drug",     lines: ["Atropine", "1 mg IV (q3-5min)", "max 3 mg"],            cx: 90,  cy: 498, w: 155, h: 52 },
    { id: "br_pacing",  type: "drug",     lines: ["Transcutaneous Pacing", "and/or Dopamine /", "Epinephrine infusion"], cx: 90, cy: 566, w: 168, h: 58 },
    { id: "br_expert",  type: "terminal", lines: ["Expert Consult", "Consider transvenous pacing"], cx: 248, cy: 558, w: 155, h: 52 },
  ],
  edges: [
    { from: "br1",         to: "bdSx" },
    { from: "bdSx",        fromSide: "right",  to: "br_asymp",   toSide: "top",    label: "No" },
    { from: "bdSx",        fromSide: "bottom", to: "br2",        toSide: "top",    label: "Yes", via: [[90, 218]] },
    { from: "br2",         to: "bdPersist" },
    { from: "bdPersist",   fromSide: "right",  to: "br_asymp",   toSide: "bottom", label: "No", via: [[295, 410]] },
    { from: "bdPersist",   fromSide: "bottom", to: "br_atropine",label: "Yes" },
    { from: "br_atropine", to: "br_pacing" },
    { from: "br_pacing",   fromSide: "right",  to: "br_expert",  toSide: "left" },
  ],
};

// ─── Adult BLS ───────────────────────────────────────────────────────────────

const ADULT_BLS: AlgoDef = {
  id: "adult-bls",
  title: "Adult BLS",
  forType: "adult",
  svgWidth: 360,
  svgHeight: 600,
  isApplicable: (s) => s.type === "adult",
  getActiveNodes(s) {
    const current = new Set<string>();
    const done = new Set<string>();

    const tasks = crNextTasks(s).map((t) => t.id);
    const hasPulse = s.pulse === "Yes";
    const noBreath = s.breathing === "No";
    const noPulse = s.pulse === "No";
    const cprActive = s.cpr.active;

    done.add("bls1");

    if (s.alert === "?" || s.breathing === "?") {
      current.add("bls2");
      return { current, done };
    }
    done.add("bls2");

    if (hasPulse && s.breathing !== "No") {
      current.add("bls_monitor");
      return { current, done };
    }
    if (hasPulse && noBreath) {
      current.add("bls_ventilate");
      return { current, done };
    }

    done.add("bls_check");
    if (!cprActive && noPulse) {
      current.add("bls3");
      return { current, done };
    }
    if (cprActive) {
      done.add("bls3");
      if (tasks.includes("shock")) current.add("bls_shock");
      else current.add("bls_aed");
    }
    return { current, done };
  },
  nodes: [
    { id: "bls1",        type: "start",    lines: ["Verify Scene Safety"],                                      cx: 180, cy: 38,  w: 190, h: 42 },
    { id: "bls2",        type: "action",   lines: ["Check Responsiveness", "• Shout for help", "• Activate emergency response", "• Send for AED/defib"],            cx: 180, cy: 130, w: 220, h: 72 },
    { id: "bls_check",   type: "decision", lines: ["Normal breathing", "& pulse felt?"],                        cx: 180, cy: 262, w: 185, h: 65 },
    { id: "bls_monitor", type: "terminal", lines: ["Monitor until", "advanced care arrives"],                   cx: 52,  cy: 262, w: 88,  h: 52 },
    { id: "bls_ventilate",type:"action",   lines: ["Support Ventilation", "1 breath/5-6 sec", "Check pulse q2min"],  cx: 318, cy: 262, w: 88, h: 62 },
    { id: "bls3",        type: "action",   lines: ["Start CPR", "• 30 compressions : 2 breaths", "• Use AED as soon as available"],  cx: 180, cy: 378, w: 220, h: 65 },
    { id: "bls_aed",     type: "action",   lines: ["AED Arrives", "Check rhythm — shockable?"],                cx: 180, cy: 470, w: 210, h: 50 },
    { id: "bls_shock",   type: "drug",     lines: ["Give 1 Shock", "Resume CPR 2 min"],                         cx: 90,  cy: 558, w: 155, h: 50 },
    { id: "bls_cpr",     type: "action",   lines: ["Resume CPR 2 min", "(non-shockable)"],                      cx: 270, cy: 558, w: 155, h: 50 },
  ],
  edges: [
    { from: "bls1",         to: "bls2" },
    { from: "bls2",         to: "bls_check" },
    { from: "bls_check",    fromSide: "left",   to: "bls_monitor",  label: "Normal br+pulse" },
    { from: "bls_check",    fromSide: "right",  to: "bls_ventilate",label: "Abnormal br" },
    { from: "bls_check",    fromSide: "bottom", to: "bls3",         label: "No pulse", via: [[180, 328]] },
    { from: "bls3",         to: "bls_aed" },
    { from: "bls_aed",      fromSide: "left",   to: "bls_shock",    label: "Shockable", via: [[90, 470]] },
    { from: "bls_aed",      fromSide: "right",  to: "bls_cpr",      label: "Non-shockable", via: [[270, 470]] },
  ],
};

// ─── Pediatric BLS ────────────────────────────────────────────────────────────

const PEDS_BLS: AlgoDef = {
  id: "peds-bls",
  title: "Pediatric BLS",
  forType: "pediatric",
  svgWidth: 360,
  svgHeight: 640,
  isApplicable: (s) => s.type === "pediatric",
  getActiveNodes(s) {
    const current = new Set<string>();
    const done = new Set<string>();

    const tasks = crNextTasks(s).map((t) => t.id);
    const hasPulse = s.pulse === "Yes";
    const noPulse = s.pulse === "No";
    const cprActive = s.cpr.active;

    done.add("pb1");

    if (s.alert === "?" || s.breathing === "?") { current.add("pb2"); return { current, done }; }
    done.add("pb2");

    if (hasPulse && s.breathing !== "No") { current.add("pb_monitor"); return { current, done }; }
    if (hasPulse && s.breathing === "No") { current.add("pb_ventilate"); return { current, done }; }

    done.add("pb_check");
    if (!cprActive && noPulse) {
      if (s.rescuers === "One") current.add("pb_witnessed");
      else current.add("pb3");
      return { current, done };
    }
    if (cprActive) {
      done.add("pb3");
      if (tasks.includes("shock")) current.add("pb_shock");
      else current.add("pb_aed");
    }
    return { current, done };
  },
  nodes: [
    { id: "pb1",         type: "start",    lines: ["Verify Scene Safety"],                                      cx: 180, cy: 38,  w: 190, h: 42 },
    { id: "pb2",         type: "action",   lines: ["Check Responsiveness", "• Shout for help", "• Activate emergency response"],  cx: 180, cy: 122, w: 215, h: 65 },
    { id: "pb_check",    type: "decision", lines: ["Breathing", "& pulse?"],                                    cx: 180, cy: 245, w: 175, h: 65 },
    { id: "pb_monitor",  type: "terminal", lines: ["Monitor"],                                                  cx: 52,  cy: 245, w: 80,  h: 42 },
    { id: "pb_ventilate",type: "action",   lines: ["Support Ventilation", "1 breath/2-3 sec", "HR <60 + poor perfusion → CPR"],  cx: 315, cy: 258, w: 80, h: 78 },
    { id: "pb_witnessed",type: "decision", lines: ["Witnessed", "sudden collapse?"],                            cx: 180, cy: 365, w: 170, h: 62 },
    { id: "pb3",         type: "action",   lines: ["Start CPR", "• 30:2 (1 rescuer)", "• 15:2 (2 rescuers)", "• Use AED ASAP"],  cx: 180, cy: 468, w: 220, h: 72 },
    { id: "pb_aed",      type: "action",   lines: ["AED Arrives", "Check rhythm"],                             cx: 180, cy: 560, w: 185, h: 48 },
    { id: "pb_shock",    type: "drug",     lines: ["Give 1 Shock", "Resume CPR 2 min"],                         cx: 90,  cy: 620, w: 148, h: 48 },
    { id: "pb_cpr",      type: "action",   lines: ["Resume CPR 2 min"],                                        cx: 270, cy: 620, w: 148, h: 48 },
  ],
  edges: [
    { from: "pb1",          to: "pb2" },
    { from: "pb2",          to: "pb_check" },
    { from: "pb_check",     fromSide: "left",   to: "pb_monitor",   label: "Normal" },
    { from: "pb_check",     fromSide: "right",  to: "pb_ventilate", label: "Abnormal" },
    { from: "pb_check",     fromSide: "bottom", to: "pb_witnessed", label: "No pulse", via: [[180, 295]] },
    { from: "pb_witnessed", fromSide: "right",  to: "pb3",          label: "No", via: [[295, 365], [295, 468]] },
    { from: "pb_witnessed", fromSide: "bottom", to: "pb3",          label: "Yes" },
    { from: "pb3",          to: "pb_aed" },
    { from: "pb_aed",       fromSide: "left",   to: "pb_shock",     label: "Shockable", via: [[90, 560]] },
    { from: "pb_aed",       fromSide: "right",  to: "pb_cpr",       label: "Non-shockable", via: [[270, 560]] },
  ],
};

// ─── Algorithm Registry ───────────────────────────────────────────────────────

const ALL_ALGOS: AlgoDef[] = [
  ADULT_CA,
  PEDS_CA,
  ADULT_TACHY,
  ADULT_BRADY,
  ADULT_BLS,
  PEDS_BLS,
];

// ─────────────────────────────────────────────────────────────────────────────
// CRAlgorithmModal
// ─────────────────────────────────────────────────────────────────────────────

export function CRAlgorithmModal({
  patient,
  onClose,
}: {
  patient: Patient;
  onClose: () => void;
}) {
  // Sort: applicable algorithms first, then by relevance
  const sortedAlgos = [...ALL_ALGOS].sort((a, b) => {
    const aApp = a.isApplicable(patient) ? 0 : 1;
    const bApp = b.isApplicable(patient) ? 0 : 1;
    if (aApp !== bApp) return aApp - bApp;
    // Within applicable: prefer matching patient type
    const aType = a.forType === patient.type || a.forType === "both" ? 0 : 1;
    const bType = b.forType === patient.type || b.forType === "both" ? 0 : 1;
    return aType - bType;
  });

  const [activeTab, setActiveTab] = useState(sortedAlgos[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);

  const algo = sortedAlgos.find((a) => a.id === activeTab) ?? sortedAlgos[0];
  const { current, done } = algo.getActiveNodes(patient);

  // Scroll chart to top when tab changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeTab]);

  const hasActive = current.size > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 160,
        background: "rgba(20,18,12,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 560,
          height: "90dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px 10px",
          borderBottom: "1px solid var(--line)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CRIcon name="flow-chart" size={18} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Algorithm Flowcharts</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 6, borderRadius: 8, color: "var(--ink-2)",
            }}
          >
            <CRIcon name="close" size={20} />
          </button>
        </div>

        {/* Tab Bar */}
        <div style={{
          display: "flex", overflowX: "auto", gap: 0,
          borderBottom: "1px solid var(--line)",
          flexShrink: 0,
          scrollbarWidth: "none",
        }}>
          {sortedAlgos.map((a) => {
            const isActive = a.id === activeTab;
            const applicable = a.isApplicable(patient);
            const { current: aCurrent } = a.getActiveNodes(patient);
            const hasPos = aCurrent.size > 0;
            return (
              <button
                key={a.id}
                onClick={() => setActiveTab(a.id)}
                style={{
                  flexShrink: 0,
                  padding: "10px 14px",
                  border: "none",
                  borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  background: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "var(--accent)" : applicable ? "var(--ink)" : "var(--ink-3)",
                  whiteSpace: "nowrap",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                {applicable && <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: hasPos ? "#f59e0b" : "var(--accent)",
                  flexShrink: 0,
                }} />}
                {a.title}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        {hasActive && (
          <div style={{
            display: "flex", gap: 14, padding: "8px 16px",
            fontSize: 10.5, color: "var(--ink-3)",
            borderBottom: "1px solid var(--line)",
            flexShrink: 0,
            alignItems: "center",
            flexWrap: "wrap",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-block", width: 12, height: 12, background: "#fffde7", border: "2px solid #f59e0b", borderRadius: 2 }} />
              Current step
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-block", width: 12, height: 12, background: "#f0f4ff", border: "1.5px solid #7986cb", borderRadius: 2 }} />
              Completed
            </span>
          </div>
        )}

        {/* Chart */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: "auto", padding: "16px 12px 24px", WebkitOverflowScrolling: "touch" }}
        >
          <FlowChart algo={algo} current={current} done={done} />
        </div>
      </div>
    </div>
  );
}
