"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { toSafeImageAssetPath } from "@/lib/safe-asset-path";

type ModelCardProps = {
  name: string;
  description?: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
  modelGroup: string;
};

export const ModelCard = memo(function ModelCard({
  name,
  description,
  icon,
  selected,
  onClick,
  modelGroup,
}: ModelCardProps) {
  const safeIcon = toSafeImageAssetPath(icon);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 cursor-pointer flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all",
        selected
          ? "border-border bg-primary/4"
          : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30",
      )}
    >
      <div className="absolute right-2.5 top-2.5">
        <div
          className={cn(
            "flex h-3.5 w-3.5 items-center justify-center rounded-md border-[1.5px] transition-colors",
            selected ? "border-primary bg-primary/80 text-primary" : "text-muted-foreground",
          )}
        />
      </div>

      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 p-1.5">
        <img src={safeIcon} alt={name} width={24} height={24} loading="lazy" decoding="async" className="h-full w-full object-contain opacity-80" />
      </div>

      <div className="w-full min-w-0 space-y-0.5 pr-3">
        <div className="line-clamp-2 break-words text-sm font-semibold leading-tight text-foreground capitalize">{modelGroup}</div>
        {name && name !== modelGroup ? (
          <div className="line-clamp-2 break-words text-[11px] leading-snug text-muted-foreground">
            {name}
          </div>
        ) : null}
        {description ? (
          <div className="line-clamp-2 break-words text-[11px] leading-snug text-muted-foreground/80">
            {description}
          </div>
        ) : null}
      </div>
    </button>
  );
});
