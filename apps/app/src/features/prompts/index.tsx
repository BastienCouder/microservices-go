import { useLocation } from "react-router-dom";

import { MonitoringDataProvider } from "@/features/monitoring/_lib/shared/use-monitoring-data";

import { PromptsLayout } from "./layout";

type PromptsPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function PromptsPage({ apiBaseURL, routeSearch }: PromptsPageProps) {
  const location = useLocation();
  const effectiveRouteSearch = location.search || routeSearch;

  return (
    <MonitoringDataProvider
      apiBaseURL={apiBaseURL}
      routeSearch={effectiveRouteSearch}
      includeHistoricalModels
    >
      <PromptsLayout apiBaseURL={apiBaseURL} routeSearch={effectiveRouteSearch} />
    </MonitoringDataProvider>
  );
}
