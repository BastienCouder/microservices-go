import { PagesLayout } from "./layout";

type PagesPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function PagesPage({ apiBaseURL, routeSearch }: PagesPageProps) {
  return <PagesLayout apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
