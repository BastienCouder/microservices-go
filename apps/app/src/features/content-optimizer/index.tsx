import { ContentOptimizerLayout } from "./layout";

type ContentOptimizerPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function ContentOptimizerPage({
  apiBaseURL,
  routeSearch,
}: ContentOptimizerPageProps) {
  return (
    <ContentOptimizerLayout apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
  );
}
