import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

import type {
  BrandVisibilityRow,
} from "../../_lib/analytics/use-brand-visibility-view-model";
import { BrandVisibilityTooltip } from "./brand-visibility-tooltip";

const AXIS_COLOR = "hsl(var(--chart-axis))";
const TOOLTIP_CURSOR = "hsl(var(--chart-cursor) / 0.2)";

type BrandVisibilityChartProps = {
  rows: BrandVisibilityRow[];
  totalScopedPrompts: number;
};

export function BrandVisibilityChart({
  rows,
  totalScopedPrompts,
}: BrandVisibilityChartProps) {
  const { t } = useScopedI18n("monitoring-analytics-panel");
  const brandVisibilityChartConfig = {
    brand: { label: t("chartBrandLabel"), color: "hsl(var(--chart-brand-primary))" },
    competitor1: { label: t("chartCompetitor1Label"), color: "hsl(var(--chart-series-2))" },
    competitor2: { label: t("chartCompetitor2Label"), color: "hsl(var(--chart-series-3))" },
    competitor3: { label: t("chartCompetitor3Label"), color: "hsl(var(--chart-series-4))" },
  } satisfies ChartConfig;

  return (
    <div className="min-w-0 border-b border-border/50 md:p-3 xl:col-span-7 xl:border-b-0 xl:border-r">
      <ChartContainer
        config={brandVisibilityChartConfig}
        className="h-[170px] w-full xl:h-[280px]"
      >
        <BarChart data={rows} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
          <XAxis
            dataKey="barLabel"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            fontSize={12}
            stroke={AXIS_COLOR}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
            fontSize={12}
            stroke={AXIS_COLOR}
          />
          <ChartTooltip
            cursor={{ fill: TOOLTIP_CURSOR }}
            content={<BrandVisibilityTooltip totalScopedPrompts={totalScopedPrompts} />}
          />
          <Bar dataKey="percentage" radius={[4, 4, 0, 0]} maxBarSize={60}>
            {rows.map((row, index) => (
              <Cell key={`${row.name}-${index}`} fill={row.color} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
