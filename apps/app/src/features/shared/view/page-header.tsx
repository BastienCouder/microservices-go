"use client";

import type { ReactNode } from "react";
import { DashboardSectionTitle } from "@/features/monitoring/_components/dashboard-section-title";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  baseline: string;
  meta?: ReactNode;
  actions?: ReactNode;
  actionsVariant?: "accent" | "classic";
  className?: string;
  titleClassName?: string;
  actionsClassName?: string;
};

export function PageHeader({
  title,
  baseline,
  meta,
  actions,
  actionsVariant = "accent",
  className,
  titleClassName,
  actionsClassName,
}: PageHeaderProps) {
  return (
    <>
    <div className={cn("flex flex-col md:gap-4 lg:flex-row lg:items-start lg:justify-between md:mb-4", className)}>
      <div className="min-w-0 space-y-0 px-2">
        <div className="flex items-end gap-2.5 ">
          <h1>
            <DashboardSectionTitle className={cn("text-base md:text-lg", titleClassName)}>
              {title}
            </DashboardSectionTitle>
          </h1>
          {meta ? <div className="flex flex-wrap items-center gap-2.5 mb-1">{meta}</div> : null}
        </div>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{baseline}</p>
      </div>

      {actions ? (
        <>
        <div
          className={cn(
            "relative",
            actionsVariant === "classic"
              ? "md:mt-3 flex w-full flex-wrap gap-2 rounded-md rounded-b-none bg-background p-4 lg:mt-0 lg:w-auto lg:min-w-fit lg:justify-end translate-y-5"
              : "flex w-full flex-col gap-3 rounded-3xl border border-border/60 bg-card/70 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:w-auto lg:min-w-fit",
            actionsClassName,
          )}
        >
          {actionsVariant === "accent" ? (
            <div className="hidden h-10 w-10 shrink-0 rounded-full bg-primary/8 ring-1 ring-primary/12 sm:block" />
          ) : null}
          {actions}
     
        </div>
        </>
      ) : null}
    </div>
    </>
  );
}
