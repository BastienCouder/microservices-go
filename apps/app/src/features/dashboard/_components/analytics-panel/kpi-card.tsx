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
    <div className={cn("relative flex flex-col rounded-md p-5 transition-all", isActive ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground")}>
      <div className="mb-2 flex items-start justify-between">
        <span className={cn("text-sm font-medium", isActive ? "text-primary-foreground/90" : "text-muted-foreground")}>{title}</span>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-full border", isActive ? "border-transparent bg-white/20 text-white backdrop-blur-sm" : "border-border bg-background text-foreground")}>
          {trendDir === "up" ? <ArrowUpRight className="h-4 w-4" /> : null}
          {trendDir === "down" ? <ArrowDownRight className="h-4 w-4" /> : null}
          {trendDir === "stable" || !trendDir ? <ArrowRight className="h-4 w-4" /> : null}
        </div>
      </div>

      <div className="mb-2">
        <span className="text-3xl font-bold tracking-tight">{value}</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {trend ? (
          <div className={cn("flex items-center rounded-full px-2 py-1 text-[10px] font-bold", trendTone)}>
            {trendDir === "up" ? <TrendingUp className="mr-1 h-3 w-3" /> : null}
            {trendDir === "down" ? <TrendingDown className="mr-1 h-3 w-3" /> : null}
            {trend}
          </div>
        ) : null}
      </div>

      {sub ? (
        <span className={cn("mt-2 text-[10px]", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {sub}
        </span>
      ) : null}
    </div>
  );
}
