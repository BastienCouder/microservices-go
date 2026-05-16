import { CrawlerLayout } from "./layout";

type CrawlerPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function CrawlerPage({
  apiBaseURL,
  routeSearch,
}: CrawlerPageProps) {
  return (
    <CrawlerLayout apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
  );
}
