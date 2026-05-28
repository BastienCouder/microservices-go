import { memo } from "react";

import { CrawlPanel } from "./_components/crawl-panel";

type CrawlerLayoutProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export const CrawlerLayout = memo(function CrawlerLayout({
  apiBaseURL,
  routeSearch,
}: CrawlerLayoutProps) {
  return (
    <div className="flex h-auto min-h-full flex-col gap-4">
      <CrawlPanel
        key={routeSearch}
        apiBaseURL={apiBaseURL}
        routeSearch={routeSearch}
      />
    </div>
  );
});
