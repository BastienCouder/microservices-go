"use client";

import type { ReactNode } from "react";
import { cn } from "@/shared/utils";

type FloatingPanelHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
};

export function FloatingPanelHeader({
  title,
  description,
  className,
}: FloatingPanelHeaderProps) {
  return (
    <div className={cn("border-b border-border/60 px-4 pt-4 pb-3", className)}>
      <div className="text-sm font-semibold tracking-[-0.01em] text-foreground">{title}</div>
      {description ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
