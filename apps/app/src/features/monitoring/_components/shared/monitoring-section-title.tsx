"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MonitoringSectionTitleProps = {
  children: ReactNode;
  className?: string;
};

export function MonitoringSectionTitle({ children, className }: MonitoringSectionTitleProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-primary font-bold uppercase text-sm", className)}>
      <span aria-hidden="true" className="relative flex h-2.5 w-2.5 items-center justify-center text-primary">
        <span className="absolute inset-0 rounded-full bg-current opacity-35 animate-ping" />
        <svg
          viewBox="0 0 10 10"
          className="relative h-2.5 w-2.5 fill-current"
          focusable="false"
        >
          <circle cx="5" cy="5" r="4" />
        </svg>
      </span>
      <span>{children}</span>
    </span>
  );
}
