import { MonitoringDataProvider } from "@/hooks/use-monitoring-data";
import { MonitoringStoreProvider } from "@/lib/monitoring-store";
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
