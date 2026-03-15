import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function MetricLine({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div className="space-y-1 rounded-md bg-muted/18 px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className={cn("text-base font-semibold tracking-tight text-foreground sm:text-lg", valueClassName)}>
          {value}
        </p>
      </div>
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function DetailSection({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <div className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        {children}
      </div>
    </section>
  );
}
