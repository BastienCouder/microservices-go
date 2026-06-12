import { memo } from "react";
import { resolveAIIconPath } from "@/lib/ai-provider-assets";
import { cn } from "@/lib/utils";

type ModelCardProps = {
  name: string;
  description?: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
  modelGroup: string;
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  disabledLabel?: string;
  metaLabel?: string;
  variant?: "default" | "monitoring" | "models";
};

export const ModelCard = memo(function ModelCard({
  name,
  description,
  icon,
  selected,
  onClick,
  modelGroup,
  size = "small",
  disabled = false,
  disabledLabel,
    metaLabel,
    variant = "default",
}: ModelCardProps) {
  const resolvedIcon = resolveAIIconPath(icon, modelGroup, name, description ?? "");
  const isModelsVariant = variant === "models";
  const isMonitoringVariant = variant === "monitoring";
  
  // Size mapping for different variants
  const sizeConfig = {
    small: {
      gap: "gap-2",
      padding: "px-3 py-3",
      rounded: "rounded-lg",
      iconSize: { container: "h-8 w-8", image: 24, padding: "p-1.5", rounded: "rounded-lg" },
      selector: { size: "h-3.5 w-3.5", rounded: "rounded-md", border: "border-[1.5px]" },
      text: { group: "text-sm", name: "text-[11px]" },
      position: { selector: "right-2.5 top-2.5", content: "pr-3", spacing: "space-y-0.5" }
    },
    medium: {
      gap: "gap-3",
      padding: "px-4 py-4", 
      rounded: "rounded-xl",
      iconSize: { container: "h-10 w-10", image: 26, padding: "p-2", rounded: "rounded-xl" },
      selector: { size: "h-4 w-4", rounded: "rounded-full", border: "border-2" },
      text: { group: "text-base", name: "text-sm" },
      position: { selector: "right-3 top-3", content: "pr-4", spacing: "space-y-1" }
    },
    large: {
      gap: "gap-4",
      padding: "px-4 py-4",
      rounded: isModelsVariant ? "rounded-xl" : "rounded-[24px]",
      iconSize: {
        container: "h-12 w-12",
        image: 28,
        padding: "p-2",
        rounded: isModelsVariant ? "rounded-lg" : "rounded-2xl",
      },
      selector: { size: "h-4 w-4", rounded: "rounded-full", border: "border-2" },
      text: { group: "text-[1.02rem]", name: "text-sm" },
      position: { selector: "right-3 top-3", content: "pr-5", spacing: "space-y-1.5" }
    }
  };

  const config = sizeConfig[size];
  const label = [modelGroup, name, description, metaLabel, disabledLabel]
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
        config.gap,
        config.padding,
        config.rounded,
        disabled
          ? "border-border/60 bg-muted/20 opacity-55"
          : selected
          ? "border-transparent bg-primary/[0.045]"
          : "border-border/80 bg-card hover:border-muted-foreground/25 hover:bg-muted/25",
      )}
    >
      <div className={cn("absolute", config.position.selector)}>
        <div
          className={cn(
            "flex items-center justify-center border transition-colors",
            config.selector.size,
            config.selector.rounded,
            config.selector.border,
            selected ? "border-primary bg-primary/80 text-primary" : "border-border bg-background/70 text-muted-foreground",
          )}
        />
      </div>

      <div
        className={cn(
          "flex items-center justify-center border border-border/60 bg-background/75",
          config.iconSize.container,
          config.iconSize.padding,
          config.iconSize.rounded,
          isMonitoringVariant && "mt-1"
        )}
      >
        {resolvedIcon ? (
          <img
            src={resolvedIcon}
            alt={name}
            width={config.iconSize.image}
            height={config.iconSize.image}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain opacity-85"
          />
        ) : null}
      </div>

      <div className={cn("w-full min-w-0", config.position.content, config.position.spacing)}>
        <div
          className={cn(
            "line-clamp-2 break-words font-semibold leading-tight text-foreground capitalize",
            config.text.group,
          )}
        >
          {modelGroup}
        </div>
        {name && name !== modelGroup ? (
          <div
            className={cn(
              "line-clamp-2 break-words text-muted-foreground",
              config.text.name,
              "leading-snug",
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
        {metaLabel ? (
          <div className="mt-2 w-fit rounded-full border border-border/70 bg-background px-2 py-0.5 text-xs font-medium text-foreground">
            {metaLabel}
          </div>
        ) : null}
      </div>
    </button>
  );
});
