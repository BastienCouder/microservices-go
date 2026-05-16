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
    <div className="flex h-auto min-h-full flex-col gap-4 px-3 pb-6 pt-3 md:px-4 lg:m-4 lg:h-full lg:min-h-0 lg:px-0 lg:pb-0 lg:pt-0">
      <CrawlPanel apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
    </div>
  );
});
