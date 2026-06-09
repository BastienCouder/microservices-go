import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toSafeImageAssetPath } from "@/lib/safe-asset-path";

import type { PageModelBadge } from "../../_lib/pages-panel/types";

export function ModelBadgeItem({ badge }: { badge: PageModelBadge }) {
  return (
    <span
      title={badge.label}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted/55 p-0.5">
        <img
          src={toSafeImageAssetPath(badge.iconPath)}
          alt=""
          width={12}
          height={12}
          loading="lazy"
          decoding="async"
          className="h-3 w-3 object-contain"
        />
      </span>
      <span className="truncate">{badge.label}</span>
    </span>
  );
}

export function ModelIconStack({ models }: { models: PageModelBadge[] }) {
  if (models.length === 0) {
    return <span className="text-xs text-muted-foreground">Aucun modèle identifié.</span>;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2">
        {models.map((model) => (
          <Tooltip key={model.id}>
            <TooltipTrigger asChild>
              <span className="flex h-9 w-9 shrink-0 cursor-default items-center justify-center rounded-md border border-border/70 bg-background/90">
                <img
                  src={toSafeImageAssetPath(model.iconPath)}
                  alt=""
                  width={18}
                  height={18}
                  loading="lazy"
                  decoding="async"
                  className="h-[18px] w-[18px] object-contain"
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              {model.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
