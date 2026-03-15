import { MonitoringTemplate } from "./template";

type MonitoringPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function MonitoringPage({ apiBaseURL, routeSearch }: MonitoringPageProps) {
  return <MonitoringTemplate apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
