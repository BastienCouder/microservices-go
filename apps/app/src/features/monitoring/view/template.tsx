import { DashboardClient } from "../dashboard-client";

type DashboardTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function DashboardTemplate({ apiBaseURL, routeSearch }: DashboardTemplateProps) {
  return <DashboardClient apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
