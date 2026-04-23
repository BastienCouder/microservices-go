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
  size?: "monitoring" | "models";
  disabled?: boolean;
  disabledLabel?: string;
};

export const ModelCard = memo(function ModelCard({
  name,
  description,
  icon,
  selected,
  onClick,
  modelGroup,
  size = "monitoring",
  disabled = false,
  disabledLabel,
}: ModelCardProps) {
  const safeIcon = toSafeImageAssetPath(icon);
  const isModelsSize = size === "models";
  const label = [modelGroup, name, description, disabledLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "relative border flex h-full w-full min-w-0 flex-col items-start text-left transition-all disabled:cursor-not-allowed",
        isModelsSize
          ? "gap-4 rounded-[24px] px-4 py-4"
          : "gap-2 rounded-lg px-3 py-3",
        disabled
          ? "border-border/60 bg-muted/20 opacity-55"
          : selected
          ? "border-transparent bg-primary/[0.045]"
          : "border-border/80 bg-card hover:border-muted-foreground/25 hover:bg-muted/25",
      )}
    >
      <div className={cn("absolute", isModelsSize ? "right-3 top-3" : "right-2.5 top-2.5")}>
        <div
          className={cn(
            "flex items-center justify-center border transition-colors",
            isModelsSize ? "h-4 w-4 rounded-full" : "h-3.5 w-3.5 rounded-md border-[1.5px]",
            selected ? "border-primary bg-primary/80 text-primary" : "border-border bg-background/70 text-muted-foreground",
          )}
        />
      </div>

      <div
        className={cn(
          "flex items-center justify-center border border-border/60 bg-background/75",
          isModelsSize ? "h-12 w-12 rounded-2xl p-2" : "mt-1 h-8 w-8 rounded-lg p-1.5",
        )}
      >
        <img
          src={safeIcon}
          alt={name}
          width={isModelsSize ? 28 : 24}
          height={isModelsSize ? 28 : 24}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain opacity-85"
        />
      </div>

      <div className={cn("w-full min-w-0", isModelsSize ? "space-y-1.5 pr-5" : "space-y-0.5 pr-3")}>
        <div
          className={cn(
            "line-clamp-2 break-words font-semibold leading-tight text-foreground capitalize",
            isModelsSize ? "text-[1.02rem]" : "text-sm",
          )}
        >
          {modelGroup}
        </div>
        {name && name !== modelGroup ? (
          <div
            className={cn(
              "line-clamp-2 break-words text-muted-foreground",
              isModelsSize ? "text-sm leading-snug" : "text-[11px] leading-snug",
            )}
          >
            {name}
          </div>
        ) : null}
        {disabledLabel ? (
          <div className="mt-2 w-fit rounded-full border border-border/70 bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {disabledLabel}
          </div>
        ) : null}
      </div>
    </button>
  );
});
