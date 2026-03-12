import { PagesTemplate } from "./template";

type PagesPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function PagesPage({ apiBaseURL, routeSearch }: PagesPageProps) {
  return <PagesTemplate apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
