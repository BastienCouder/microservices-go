"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiCardProps = {
  title: string;
  value: string;
  sub?: string;
  trend?: string;
  trendDir?: "up" | "down" | "stable";
  variant?: "default" | "active";
};

export function KpiCard({ title, value, sub, trend, trendDir, variant = "default" }: KpiCardProps) {
  const isActive = variant === "active";
  const trendTone = isActive
    ? "border-transparent bg-white/20 text-white"
    : trendDir === "up"
      ? "bg-green-100 text-green-700"
      : trendDir === "down"
        ? "bg-red-100 text-red-700"
        : "bg-muted text-muted-foreground";

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-md p-4 transition-all md:p-5",
        isActive
          ? "bg-linear-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.14)]"
          : "bg-card text-card-foreground",
      )}
    >
      <div className="mb-2 flex items-start justify-between">
        <span className={cn("text-[15px] font-medium leading-tight md:text-sm", isActive ? "text-primary-foreground/90" : "text-muted-foreground")}>{title}</span>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-full border", isActive ? "border-transparent bg-white/20 text-white backdrop-blur-sm" : "border-border bg-background text-foreground")}>
          {trendDir === "up" ? <ArrowUpRight className="h-4 w-4" /> : null}
          {trendDir === "down" ? <ArrowDownRight className="h-4 w-4" /> : null}
          {trendDir === "stable" || !trendDir ? <ArrowRight className="h-4 w-4" /> : null}
        </div>
      </div>

      <div className="mb-2">
        <span className="text-[30px] font-bold tracking-tight md:text-3xl">{value}</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {trend ? (
          <div className={cn("flex min-h-7 items-center rounded-[10px] px-2 py-1 text-[11px] font-bold md:text-[10px]", trendTone)}>
            {trendDir === "up" ? <TrendingUp className="mr-1 h-3 w-3" /> : null}
            {trendDir === "down" ? <TrendingDown className="mr-1 h-3 w-3" /> : null}
            {trend}
          </div>
        ) : null}
      </div>

      {sub ? (
        <span className={cn("mt-2 text-xs leading-relaxed md:text-xs", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {sub}
        </span>
      ) : null}
    </div>
  );
}
