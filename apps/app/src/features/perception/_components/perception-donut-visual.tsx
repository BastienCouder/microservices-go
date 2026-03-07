"use client";

import { useState } from "react";
import type { PerceptionViewData } from "@/lib/perception-data";
import { PERCEPTION_DONUT_COLORS, PERCEPTION_TEXT } from "@/lib/app-data";
import { DashboardSectionTitle } from "@/features/dashboard/_components/dashboard-section-title";

export function PerceptionDonutVisual({ points }: { points: PerceptionViewData["radar"] }) {
  const [hoveredAxis, setHoveredAxis] = useState<PerceptionViewData["radar"][number]["axis"] | null>(null);
  const ordered = [
    { axis: "positioning", color: PERCEPTION_DONUT_COLORS.axis.positioning },
    { axis: "use_cases", color: PERCEPTION_DONUT_COLORS.axis.use_cases },
    { axis: "sentiment", color: PERCEPTION_DONUT_COLORS.axis.sentiment },
    { axis: "features", color: PERCEPTION_DONUT_COLORS.axis.features },
    { axis: "competitors", color: PERCEPTION_DONUT_COLORS.axis.competitors },
  ] as const;
  const byAxis = new Map(points.map((p) => [p.axis, p] as const));

  const cx = 260;
  const cy = 210;
  const baseOuterR = 98;
  const outerRAmplitude = 34;
  const innerR = 44;
  const gap = 0;

  const polar = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
  };

  const arcPath = (startDeg: number, endDeg: number, rOuter: number, rInner: number) => {
    const p1 = polar(startDeg, rOuter);
    const p2 = polar(endDeg, rOuter);
    const p3 = polar(endDeg, rInner);
    const p4 = polar(startDeg, rInner);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return [
      `M ${p1.x} ${p1.y}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y}`,
      `L ${p3.x} ${p3.y}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y}`,
      "Z",
    ].join(" ");
  };

  return (
    <div className="bg-background px-4">
      <div>
        <DashboardSectionTitle>{PERCEPTION_TEXT.donut.title}</DashboardSectionTitle>
      </div>
      <div className="text-sm text-muted-foreground">{PERCEPTION_TEXT.donut.subtitle}</div>
      <div className="h-[390px] w-full">
        <svg viewBox="0 0 520 390" className="h-full w-full">
          <defs>
            <filter id="perception-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor={PERCEPTION_DONUT_COLORS.shadow} floodOpacity="0.15" />
            </filter>
          </defs>

          {ordered.map((slice, index) => {
            const point = byAxis.get(slice.axis);
            const span = 360 / ordered.length;
            const start = -180 + index * span + gap / 2;
            const end = start + span - gap;
            const mid = (start + end) / 2;
            const shift = polar(mid, 0);
            const tx = shift.x - cx;
            const ty = shift.y - cy;
            const score = Math.max(0, Math.min(100, point?.score ?? 0));
            const outerR = baseOuterR + (score / 100) * outerRAmplitude;

            const scorePos = polar(mid, (outerR + innerR) / 2);
            const dotPos = polar(mid, outerR - 10);
            const c1 = polar(mid, outerR + 4);
            const c2 = polar(mid, outerR + 28);
            const rightSide = Math.cos((mid * Math.PI) / 180) >= 0;
            const c3 = { x: c2.x + (rightSide ? 38 : -38), y: c2.y };
            const isHovered = hoveredAxis === slice.axis;
            const scale = isHovered ? 1.06 : 1;

            return (
              <g
                key={slice.axis}
                onMouseEnter={() => setHoveredAxis(slice.axis)}
                onMouseLeave={() => setHoveredAxis(null)}
                style={{ cursor: "pointer" }}
              >
                <g
                  transform={`translate(${tx},${ty}) translate(${cx},${cy}) scale(${scale}) translate(${-cx},${-cy})`}
                  style={{ transition: "transform 180ms ease-out" }}
                >
                  <path d={arcPath(start, end, outerR, innerR)} fill={slice.color} filter="url(#perception-shadow)" opacity={isHovered ? 1 : 0.94} />
                  <circle cx={dotPos.x} cy={dotPos.y} r="4.4" fill={PERCEPTION_DONUT_COLORS.background} />
                  <text x={scorePos.x} y={scorePos.y} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="14" fontWeight="700">
                    {score}%
                  </text>
                </g>
                <polyline
                  points={`${c1.x},${c1.y} ${c2.x},${c2.y} ${c3.x},${c3.y}`}
                  fill="none"
                  stroke={PERCEPTION_DONUT_COLORS.primary}
                  strokeWidth="2"
                  opacity={isHovered ? 1 : 0.75}
                />
                <text
                  x={rightSide ? c3.x + 6 : c3.x - 6}
                  y={c3.y - 4}
                  textAnchor={rightSide ? "start" : "end"}
                  fill={PERCEPTION_DONUT_COLORS.primary}
                  fontSize="14"
                  fontWeight="700"
                  opacity={isHovered ? 1 : 0.9}
                >
                  {point?.label ?? slice.axis}
                </text>
                <text
                  x={rightSide ? c3.x + 6 : c3.x - 6}
                  y={c3.y + 9}
                  textAnchor={rightSide ? "start" : "end"}
                  fill={PERCEPTION_DONUT_COLORS.primaryMuted}
                  fontSize="9.5"
                >
                  {PERCEPTION_TEXT.donut.scoreCaption}
                </text>
              </g>
            );
          })}

          <circle cx={cx} cy={cy} r={innerR + 6} fill={PERCEPTION_DONUT_COLORS.primary} filter="url(#perception-shadow)" />
          <circle cx={cx} cy={cy} r={innerR - 2} fill={PERCEPTION_DONUT_COLORS.background} />
        </svg>
      </div>
    </div>
  );
}
