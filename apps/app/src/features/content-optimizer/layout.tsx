import { memo } from "react";

import { CrawlPanel } from "@/features/crawler/_components/crawl-panel";

type ContentOptimizerLayoutProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export const ContentOptimizerLayout = memo(function ContentOptimizerLayout({
  apiBaseURL,
  routeSearch,
}: ContentOptimizerLayoutProps) {
  return (
    <div className="flex h-auto min-h-full flex-col gap-4">
      <CrawlPanel
        key={routeSearch}
        apiBaseURL={apiBaseURL}
        routeSearch={routeSearch}
        variant="contentOptimizer"
      />
    </div>
  );
});
