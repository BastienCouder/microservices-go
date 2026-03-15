import { MonitoringDataProvider } from "@/hooks/use-monitoring-data";
import { MonitoringStoreProvider } from "@/lib/monitoring-store";

import { MonitoringLayout } from "../_components/layout/monitoring-layout";

type MonitoringClientProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function MonitoringClient({ apiBaseURL, routeSearch }: MonitoringClientProps) {
  return (
    <MonitoringStoreProvider>
      <MonitoringDataProvider apiBaseURL={apiBaseURL} routeSearch={routeSearch}>
        <MonitoringLayout />
      </MonitoringDataProvider>
    </MonitoringStoreProvider>
  );
}
