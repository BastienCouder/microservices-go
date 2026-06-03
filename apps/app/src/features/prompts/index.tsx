import { MonitoringDataProvider } from "@/features/monitoring/_lib/shared/use-monitoring-data";

import { PromptsLayout } from "./layout";

type PromptsPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function PromptsPage({ apiBaseURL, routeSearch }: PromptsPageProps) {
  return (
    <MonitoringDataProvider
      apiBaseURL={apiBaseURL}
      routeSearch={routeSearch}
      includeHistoricalModels
    >
      <PromptsLayout apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
    </MonitoringDataProvider>
  );
}
