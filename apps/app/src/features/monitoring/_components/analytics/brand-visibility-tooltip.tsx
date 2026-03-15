import type { BrandVisibilityRow } from "../../_lib/analytics/use-brand-visibility-view-model";

const LEGEND_FALLBACK_COLOR = "hsl(var(--chart-legend-fallback))";
const TOOLTIP_NAME_MAX_CHARS = 44;

function truncateBrandName(value: string, maxChars = TOOLTIP_NAME_MAX_CHARS): string {
  const normalizedValue = value.trim();
  if (normalizedValue.length <= maxChars) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, Math.max(0, maxChars - 1))}…`;
}

type BrandVisibilityTooltipProps = {
  active?: boolean;
  payload?: Array<{
    value?: number;
    payload?: Partial<BrandVisibilityRow>;
    color?: string;
  }>;
  totalScopedPrompts: number;
};

export function BrandVisibilityTooltip({
  active,
  payload,
  totalScopedPrompts,
}: BrandVisibilityTooltipProps) {
  const item = payload?.[0];
  const row = item?.payload;
  if (!active || !item || !row) return null;

  const mentions = row.mentions ?? 0;
  const mentionRate = row.mentionRate ?? 0;
  const sov = row.sovPercentage ?? 0;
  const color = item.color ?? row.color ?? LEGEND_FALLBACK_COLOR;

  return (
    <div className="min-w-[210px] max-w-[280px] rounded-md border border-border/60 bg-background/95 p-3 shadow-sm backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span
          className="min-w-0 break-words text-sm font-medium leading-snug"
          title={row.name}
        >
          {truncateBrandName(row.name ?? "")}
        </span>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Mentions</span>
          <span className="font-mono tabular-nums">
            {mentions} / {Math.max(totalScopedPrompts, 0)}
          </span>
        </div>
        <TooltipMetricBar label="Mention rate" value={mentionRate} color={color} />
        <TooltipMetricBar label="SOV" value={sov} color={color} />
      </div>
    </div>
  );
}

function TooltipMetricBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{safeValue.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
        <div
          className="h-full rounded-full"
          style={{ width: `${safeValue}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
