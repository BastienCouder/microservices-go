"use client";

import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PERCEPTION_SCORE_CARD_COLORS } from "@/lib/app-data";

export function PerceptionScoreMiniCard({
  id,
  title,
  value,
  hint,
  icon: Icon,
}: {
  id: string;
  title: string;
  value: number;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  const radius = 28;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - safeValue / 100);
  const palette =
    id === "positioning"
      ? PERCEPTION_SCORE_CARD_COLORS.positioning
      : id === "factual"
        ? PERCEPTION_SCORE_CARD_COLORS.factual
        : PERCEPTION_SCORE_CARD_COLORS.sentiment;

  return (
    <Card className="group overflow-hidden border-border/60">
      <CardContent className="p-4">
        <div className="flex min-h-[170px] flex-col items-start gap-3">
          <div
            className="relative grid h-20 w-20 shrink-0 place-items-center self-center rounded-full transition-transform duration-200 ease-out group-hover:scale-105"
            style={{ backgroundColor: palette.accentSoft }}
          >
            <svg
              viewBox="0 0 80 80"
              className="h-20 w-20 -rotate-90 transition-transform duration-200 ease-out group-hover:scale-[1.03]"
            >
              <circle cx="40" cy="40" r={radius} fill="none" stroke={PERCEPTION_SCORE_CARD_COLORS.ringTrack} strokeWidth={stroke} />
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke={palette.ring}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={progress}
                className="transition-[stroke-dashoffset,opacity] duration-300 ease-out group-hover:opacity-100"
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div
                className="grid h-10 w-10 place-items-center rounded-full bg-background shadow-sm transition-transform duration-200 ease-out group-hover:scale-110"
                style={{ color: palette.accent }}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="min-w-0 w-full flex-1">
            <div className="text-center text-sm font-semibold leading-tight">{title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
            <div className="mt-2 flex items-end justify-center gap-1">
              <span className="text-2xl font-semibold tabular-nums leading-none">{safeValue}</span>
              <span className="pb-0.5 text-xs text-muted-foreground">/100</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
