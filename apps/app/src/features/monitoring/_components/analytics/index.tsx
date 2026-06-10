import { useAnalyticsPanelViewModel } from "../../_lib/analytics/use-analytics-panel-view-model";
import { AutomaticInsights } from "./automatic-insights";
import { BrandVisibilityPanel } from "./brand-visibility-panel";
import { CitedPagesPanel } from "./cited-pages-panel";
import { KpiOverviewGrid } from "./kpi-overview-grid";
import { SentimentDistribution } from "./sentiment-distribution";
import { VisibilityAnalytics } from "./model-visibility-panel";
import { Template } from "./template";

export function AnalyticsPanel() {
  const viewModel = useAnalyticsPanelViewModel();

  if (viewModel.loading) {
    return <Template />;
  }

  return (
     <div className="h-auto px-0 md:px-1 lg:h-full lg:overflow-y-auto">
          <div className="flex flex-col gap-4 pb-4">
            <KpiOverviewGrid {...viewModel.kpis} />
            <VisibilityAnalytics {...viewModel.visibilityAnalytics} />
            <BrandVisibilityPanel />
            <div className="grid w-full min-w-0 grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:!grid-cols-2">
              <SentimentDistribution {...viewModel.sentiment} />
              <CitedPagesPanel {...viewModel.citedPages} />
            </div>
            <AutomaticInsights autoInsights={viewModel.autoInsights} />
          </div>
        </div>
  );
}
