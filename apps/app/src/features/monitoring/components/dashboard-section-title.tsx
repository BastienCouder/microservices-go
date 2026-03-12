"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DashboardSectionTitleProps = {
  children: ReactNode;
  className?: string;
};

export function DashboardSectionTitle({ children, className }: DashboardSectionTitleProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-primary font-bold uppercase text-sm", className)}>
      <span aria-hidden="true" className="flex h-2.5 w-2.5 items-center justify-center text-primary">
        <svg
          viewBox="0 0 10 10"
          className="h-2.5 w-2.5 fill-current"
          focusable="false"
        >
          <circle cx="5" cy="5" r="4" />
        </svg>
      </span>
      <span>{children}</span>
    </span>
  );
}
