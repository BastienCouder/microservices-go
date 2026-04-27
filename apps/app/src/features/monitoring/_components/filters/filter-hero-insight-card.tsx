import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { FilterHeroInsight } from "../../_lib/filters/filter-hero-insight";

type FilterHeroInsightCardProps = {
  insight: FilterHeroInsight;
};

function getMomentumIcon(tone: FilterHeroInsight["momentumTone"]) {
  if (tone === "up") return TrendingUp;
  if (tone === "down") return TrendingDown;
  return Minus;
}

function getTrendArrow(tone: FilterHeroInsight["momentumTone"]) {
  if (tone === "up") return ArrowUpRight;
  if (tone === "down") return ArrowDownRight;
  return ArrowRight;
}

export function FilterHeroInsightCard({
  insight,
}: FilterHeroInsightCardProps) {
  const MomentumIcon = getMomentumIcon(insight.momentumTone);
  const TrendArrow = getTrendArrow(insight.momentumTone);
  const maxTrend = Math.max(...insight.trend, 1);
  const titleSuffix = insight.brandName
    ? insight.title.replace(new RegExp(`^${insight.brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`), "")
    : insight.title;

  return (
    <section className="relative flex flex-col overflow-hidden rounded-md bg-linear-to-br from-primary via-primary to-primary/80 p-4 text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.14)] md:p-5">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_74%_72%,rgba(255,255,255,0.08),transparent_28%)] opacity-80" />
        <div className="h-full absolute right-[22%] w-px bg-white/14" />
        <div className="h-full absolute left-[28%] top-[28%] w-px bg-white/8" />
        <div className="absolute w-full bottom-[30%] left-[38%] right-[8%] h-px bg-white/12" />
        <div className="absolute bottom-[22%] left-[6%] right-[24%] h-px w-full bg-white/8" /> 
{/*         <div className="absolute bottom-[18%] right-[24%] h-[12%] w-px bg-white/10" />
        <div className="absolute bottom-[30%] right-[8%] h-[22%] w-px bg-white/10" /> */}
      </div>

      <div className="relative z-10 mb-6 flex items-start justify-between gap-2">
        <div className="max-w-[15rem]">
          {insight.brandName ? (
            <span className="block text-[2rem] font-semibold leading-[0.95] tracking-tight text-white md:text-[2.35rem]">
              {insight.brandName}
            </span>
          ) : null}
          <span className="block text-[1rem] font-medium leading-tight text-primary-foreground/92 md:text-[1.05rem]">
            {titleSuffix}
          </span>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent bg-white/20 text-white backdrop-blur-sm">
          <TrendArrow className="h-4 w-4" />
        </div>
      </div>

      <div className="relative z-10 mb-2">
        <div className="text-[30px] font-bold tracking-tight text-white md:text-xl">
          {insight.metricValue}
        </div>
        <p className="text-xs font-medium text-primary-foreground/78">
          {insight.metricLabel}
        </p>
      </div>

      <div className="relative z-10 mt-3 flex items-center gap-2">
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
          {insight.periodLabel}
        </span>
      </div>

      <div className="relative z-10 mt-3 flex h-10 items-end gap-1.5">
        {insight.trend.map((value, index) => {
          const ratio = maxTrend > 0 ? value / maxTrend : 0;
          const height = Math.max(8, Math.round(ratio * 38));

          return (
            <div
              key={`hero-trend-${index}`}
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

      <p className="relative z-10 mt-2 text-xs leading-relaxed text-primary-foreground/72">
        {insight.microCopy}
      </p>
    </section>
  );
}