import { DashboardTemplate } from "./template";

type DashboardPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function DashboardPage({ apiBaseURL, routeSearch }: DashboardPageProps) {
  return <DashboardTemplate apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
