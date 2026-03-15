import { MonitoringClient } from "./client";

type MonitoringTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function MonitoringTemplate({ apiBaseURL, routeSearch }: MonitoringTemplateProps) {
  return <MonitoringClient apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
