"use client";

import { cn } from "@/lib/utils";

type FiltersEmptyStateCardProps = {
  label: string;
  className?: string;
};

export function FiltersEmptyStateCard({ label, className }: FiltersEmptyStateCardProps) {
  return (
    <div
      className={cn(
        "flex h-16 items-center justify-center rounded-md border border-dashed border-foreground/20 bg-muted/5 px-3 text-center text-xs leading-relaxed text-muted-foreground md:text-sm",
        className,
      )}
    >
      {label}
    </div>
  );
}
