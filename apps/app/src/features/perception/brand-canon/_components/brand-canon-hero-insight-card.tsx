"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

import type { BrandCanonHeroInsight } from "../_lib/brand-canon-hero-insight";

function getMomentumIcon(tone: BrandCanonHeroInsight["momentumTone"]) {
  if (tone === "up") return TrendingUp;
  if (tone === "down") return TrendingDown;
  return Minus;
}

function getTrendArrow(tone: BrandCanonHeroInsight["momentumTone"]) {
  if (tone === "up") return ArrowUpRight;
  if (tone === "down") return ArrowDownRight;
  return ArrowRight;
}

export function BrandCanonHeroInsightCard({
  insight,
  showTrend = true,
}: {
  insight: BrandCanonHeroInsight;
  showTrend?: boolean;
}) {
  const MomentumIcon = getMomentumIcon(insight.momentumTone);
  const TrendArrow = getTrendArrow(insight.momentumTone);
  const maxTrend = Math.max(...insight.trend, 1);
  const hasMetric = insight.metricValue.trim() !== "" || insight.metricLabel.trim() !== "";
  const hasSummary = insight.summary.trim() !== "";
  const hasMicroCopy = insight.microCopy.trim() !== "";

  return (
    <section className="relative flex flex-col rounded-md bg-linear-to-br from-primary via-primary to-primary/80 p-4 text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.14)] md:p-5">
      <div className="mb-2 flex items-start justify-between gap-2">
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

      {hasMetric ? (
        <div className="mb-2">
          <div className="text-[30px] font-bold tracking-tight text-white md:text-3xl">
            {insight.metricValue}
          </div>
          <p className="text-xs font-medium text-primary-foreground/78">
            {insight.metricLabel}
          </p>
        </div>
      ) : null}

      {hasSummary ? (
        <p className="text-xs leading-relaxed text-primary-foreground/84">
          {insight.summary}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <div
          className={cn(
            "flex min-h-7 items-center rounded-[10px] px-2 py-1 text-[11px] font-bold md:text-[10px]",
            insight.momentumTone === "up" && "bg-white/20 text-white",
            insight.momentumTone === "down" && "bg-amber-100 text-amber-800",
            insight.momentumTone === "stable" && "bg-white/16 text-primary-foreground/88",
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

      {showTrend ? (
        <div className="mt-3 flex h-10 items-end gap-1.5">
          {insight.trend.map((value, index) => {
            const ratio = maxTrend > 0 ? value / maxTrend : 0;
            const height = Math.max(8, Math.round(ratio * 38));

            return (
              <div
                key={`brand-canon-hero-trend-${index}`}
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
      ) : null}

      {hasMicroCopy ? (
        <p className={cn("text-[11px] leading-relaxed text-primary-foreground/72", showTrend ? "mt-2" : "mt-3")}>
          {insight.microCopy}
        </p>
      ) : null}
    </section>
  );
}
