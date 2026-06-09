import { ScrollArea } from "@/components/ui/scroll-area";

import type {
  BrandVisibilityMetricMode,
  BrandVisibilityRow,
} from "../../_lib/analytics/use-brand-visibility-view-model";

const LEGEND_FALLBACK_COLOR = "hsl(var(--chart-legend-fallback))";
const BRAND_NAME_MAX_CHARS = 32;

function truncateBrandName(value: string, maxChars = BRAND_NAME_MAX_CHARS): string {
  const normalizedValue = value.trim();
  if (normalizedValue.length <= maxChars) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, Math.max(0, maxChars - 1))}…`;
}

type BrandVisibilityListProps = {
  rows: BrandVisibilityRow[];
  metricMode: BrandVisibilityMetricMode;
  mentionsLabel: string;
  topBrandsLabel: string;
  byVisibilityLabel: string;
};

export function BrandVisibilityList({
  rows,
  metricMode,
  mentionsLabel,
  topBrandsLabel,
  byVisibilityLabel,
}: BrandVisibilityListProps) {
  return (
    <div className="min-w-0 border-t bg-muted/5 px-4 xl:col-span-7 xl:flex xl:flex-col xl:border-t-0">
      <div className="flex items-center justify-between border-b border-border/50 p-4">
        <div>
          <h4 className="text-sm font-semibold">{topBrandsLabel}</h4>
          <p className="text-xs text-muted-foreground md:text-sm">{byVisibilityLabel}</p>
        </div>
      </div>

      <ScrollArea className="h-[170px] pr-4 xl:h-[210px] [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
        <div className="flex flex-col">
          {rows.map((brand) => (
            <div
              key={brand.name}
              className="flex items-center gap-2 border-b border-border/40 p-2.5 transition-colors hover:bg-muted/10 last:border-0"
            >
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: brand.color || LEGEND_FALLBACK_COLOR }} />
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-xs font-bold text-muted-foreground">
                {brand.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-baseline justify-between">
                  <span
                    className="block min-w-0 truncate text-xs font-semibold md:text-sm"
                    title={brand.name}
                  >
                    {truncateBrandName(brand.name)}
                  </span>
                  <span className="text-xs font-bold tabular-nums md:text-sm">{brand.percentage}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {brand.mentions} {mentionsLabel}
                    {metricMode === "mention_rate" ? ` • ${brand.sovPercentage}% SOV` : ""}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
