import { useBrandVisibilityViewModel } from "../../_lib/analytics/use-brand-visibility-view-model";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyStateCard } from "../../../../components/shared/empty-state-card";
import { BrandVisibilityChart } from "./brand-visibility-chart";
import { BrandVisibilityList } from "./brand-visibility-list";

export function BrandVisibilityPanel() {
  const viewModel = useBrandVisibilityViewModel();
  const content = useI18nScope("monitoring-analytics-panel");
  
  if (!viewModel.hasRows) {
    return (
      <Card className="col-span-1 min-w-0 overflow-hidden rounded-md xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            <SectionTitle>{content.brandVisibilityTitle}</SectionTitle>
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed md:text-sm">
            {content.brandVisibilityDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyStateCard label={content.noDataAvailable} className="h-[220px] text-sm" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 min-w-0 overflow-hidden rounded-md xl:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <SectionTitle>{content.brandVisibilityTitle}</SectionTitle>
            </CardTitle>
            <CardDescription className="pr-1 text-xs leading-relaxed md:text-sm">
              {content.brandVisibilityDescription}
            </CardDescription>
          </div>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 md:w-auto md:justify-end">
            <Tabs
              value={viewModel.metricMode}
              onValueChange={(value) =>
                viewModel.setMetricMode(value as "sov" | "mention_rate")
              }
            >
              <TabsList className="h-8 w-full max-w-full md:h-9 md:w-auto">
                <TabsTrigger value="sov" className="px-2 text-[11px] md:px-3 md:text-xs">
                  SOV %
                </TabsTrigger>
                <TabsTrigger
                  value="mention_rate"
                  className="px-2 text-[11px] md:px-3 md:text-xs"
                >
                  Mention rate %
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Badge
              variant="secondary"
              className="h-8 shrink-0 bg-muted/50 text-xs font-normal uppercase text-muted-foreground md:h-9 md:text-sm"
            >
              {viewModel.periodLabel}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid min-w-0 grid-cols-1 xl:grid-cols-14">
          <BrandVisibilityChart
            rows={viewModel.rows}
            totalScopedPrompts={viewModel.totalScopedPrompts}
          />
          <BrandVisibilityList
            rows={viewModel.rows}
            metricMode={viewModel.metricMode}
            mentionsLabel={content.mentions}
            topBrandsLabel={content.topBrands}
            byVisibilityLabel={content.byVisibility}
          />
        </div>
      </CardContent>
    </Card>
  )
}
