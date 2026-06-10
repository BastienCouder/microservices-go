import { MonitoringDataProvider } from "./_lib/shared/use-monitoring-data";
import { MonitoringStoreProvider } from "./_lib/shared/monitoring-store";
import { MonitoringLayout } from "./layout";


type MonitoringProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function MonitoringPage({ apiBaseURL, routeSearch }: MonitoringProps) {
  return (
    <MonitoringStoreProvider>
      <MonitoringDataProvider apiBaseURL={apiBaseURL} routeSearch={routeSearch}>
        <MonitoringLayout />
      </MonitoringDataProvider>
    </MonitoringStoreProvider>
  );
}
