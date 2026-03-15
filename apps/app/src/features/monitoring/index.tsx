import { MonitoringDataProvider } from "@/hooks/use-monitoring-data";
import { MonitoringStoreProvider } from "@/lib/monitoring-store";
import { MonitoringLayout } from "@/features/monitoring/_components/layout/monitoring-layout";

type MonitoringProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function monitoring({ apiBaseURL, routeSearch }: MonitoringProps) {
  return (
    <MonitoringStoreProvider>
      <MonitoringDataProvider apiBaseURL={apiBaseURL} routeSearch={routeSearch}>
        <MonitoringLayout />
      </MonitoringDataProvider>
    </MonitoringStoreProvider>
  );
}
