import type { ReactNode } from "react";
import { SectionTitle } from "@/components/shared/section-title";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  baseline: string;
  meta?: ReactNode;
  actions?: ReactNode;
  actionsVariant?: "accent" | "classic";
  className?: string;
  titleClassName?: string;
  baselineClassName?: string;
  actionsClassName?: string;
};

export function PageHeader({
  title,
  meta,
  actions,
  actionsVariant = "accent",
  className,
  titleClassName,
  actionsClassName,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 bg-background py-3 px-3 md:gap-4 md:bg-transparent md:px-0 md:py-0 lg:flex-row lg:items-start lg:justify-between",
        className,
        !actions && "md:mb-4",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-end gap-2.5">
          <h1 className="min-w-0">
            <SectionTitle className={cn("text-base md:mt-4 md:text-lg", titleClassName)}>
              {title}
            </SectionTitle>
          </h1>
          {meta ? <div className="mb-1 flex flex-wrap items-center gap-2.5">{meta}</div> : null}
        </div>
      </div>

      {actions ? (
        <div
          className={cn(
            "relative",
            actionsVariant === "classic"
              ? "flex w-full flex-col gap-2 rounded-xl bg-background p-3 sm:flex-row sm:flex-wrap sm:items-center md:rounded-md md:rounded-b-none md:p-4 lg:mt-0 lg:w-auto lg:min-w-fit lg:justify-end"
              : "flex w-full flex-col gap-3 rounded-3xl border border-border/60 bg-card/70 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:w-auto lg:min-w-fit",
            actionsClassName,
          )}
        >
          {actionsVariant === "accent" ? (
            <div className="hidden h-10 w-10 shrink-0 rounded-full bg-primary/8 ring-1 ring-primary/12 sm:block" />
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
