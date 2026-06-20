"use client";

import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { PerceptionHeroInsight } from "../_lib/perception-hero-insight";

function getMomentumIcon(tone: PerceptionHeroInsight["momentumTone"]) {
  if (tone === "up") return TrendingUp;
  if (tone === "down") return TrendingDown;
  return Minus;
}

function getTrendArrow(tone: PerceptionHeroInsight["momentumTone"]) {
  if (tone === "up") return ArrowUpRight;
  if (tone === "down") return ArrowDownRight;
  return ArrowRight;
}

export function PerceptionHeroInsightCard({
  insight,
  actions,
}: {
  insight: PerceptionHeroInsight;
  actions?: ReactNode;
}) {
  const MomentumIcon = getMomentumIcon(insight.momentumTone);
  const TrendArrow = getTrendArrow(insight.momentumTone);
  const maxTrend = Math.max(...insight.trend, 1);
  // const hasMetric =
  //   insight.metricValue.trim() !== "" || insight.metricLabel.trim() !== "";
  // const hasSummary = insight.summary.trim() !== "";
  const hasMicroCopy = insight.microCopy.trim() !== "";

  return (
    <section className="relative flex flex-col overflow-hidden rounded-xl bg-linear-to-br from-primary via-primary to-primary/80 p-4 text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.14)] md:p-5">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_74%_72%,rgba(255,255,255,0.08),transparent_28%)] opacity-80" />
        <div className="absolute right-[22%] h-full w-px bg-white/14" />
        <div className="absolute left-[28%] top-[28%] h-full w-px bg-white/8" />
        <div className="absolute bottom-[30%] left-[38%] right-[8%] h-px w-full bg-white/12" />
        <div className="absolute bottom-[22%] left-[6%] right-[24%] h-px w-full bg-white/8" />
      </div>

      <div className="relative z-10 mb-2 flex items-start justify-between gap-2">
        <div className="max-w-[18rem]">
          <span className="block text-[2rem] font-semibold leading-[0.95] tracking-tight text-white md:text-[2.35rem]">
            {insight.brandName}
          </span>
          <span className="block text-[1rem] font-medium leading-tight text-primary-foreground/92 md:text-[1.05rem]">
            {insight.title}
          </span>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent bg-white/20 text-white backdrop-blur-sm">
          <TrendArrow className="h-4 w-4" />
        </div>
      </div>

      {/*
      {hasMetric ? (
        <div className="relative z-10 mb-2">
          <div className="text-[30px] font-bold tracking-tight text-white md:text-3xl">
            {insight.metricValue}
          </div>
          <p className="text-xs font-medium text-primary-foreground/78">
            {insight.metricLabel}
          </p>
        </div>
      ) : null}
      */}

      {/*
      {hasSummary ? (
        <p className="relative z-10 text-xs leading-relaxed text-primary-foreground/84">
          {insight.summary}
        </p>
      ) : null}
      */}

      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2">
        <div
          className={cn(
            "flex min-h-7 items-center rounded-lg px-2 py-1 text-[11px] font-bold md:text-[10px]",
            insight.momentumTone === "up" && "bg-white/20 text-white",
            insight.momentumTone === "down" && "bg-amber-100 text-amber-800",
            insight.momentumTone === "stable" &&
              "bg-white/16 text-primary-foreground/88",
          )}
        >
          <MomentumIcon className="mr-1 h-3 w-3" />
          {insight.momentumLabel}
        </div>
        <span className="text-xs font-medium text-primary-foreground/72">
          {insight.scopeLabel}
        </span>
        {insight.extraLabel ? (
          <span className="text-xs font-medium text-primary-foreground/72">
            {insight.extraLabel}
          </span>
        ) : null}
      </div>

      <div className="relative z-10 mt-3 flex h-10 items-end gap-1.5">
        {insight.trend.map((value, index) => {
          const ratio = maxTrend > 0 ? value / maxTrend : 0;
          const height = Math.max(8, Math.round(ratio * 38));

          return (
            <div
              key={`perception-hero-trend-${index}`}
              className={cn(
                "flex-1 rounded-full bg-white/20 transition-[transform,background-color,opacity] duration-300 ease-out hover:scale-y-110 hover:bg-white/30 motion-safe:[animation:hero-insight-rise_720ms_cubic-bezier(0.22,1,0.36,1)_both]",
                index === insight.trend.length - 1 && "bg-white/80",
              )}
              style={{
                height,
                animationDelay: `${index * 80}ms`,
                transitionDelay: `${index * 40}ms`,
              }}
            />
          );
        })}
      </div>

      {hasMicroCopy ? (
        <p className="relative z-10 mt-2 text-sm leading-relaxed text-primary-foreground/72">
          {insight.microCopy}
        </p>
      ) : null}

      {actions ? (
        <div className="relative z-10 mt-4 border-t border-white/12 pt-4">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
