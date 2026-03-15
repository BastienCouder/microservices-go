import { PromptsResponsesWorkspace } from "../components/prompts-workspace";
import { MonitoringDataProvider } from "@/hooks/use-monitoring-data";

type PromptsClientProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function PromptsClient({ apiBaseURL, routeSearch }: PromptsClientProps) {
  return (
    <MonitoringDataProvider
      apiBaseURL={apiBaseURL}
      routeSearch={routeSearch}
      includeHistoricalModels
    >
      <PromptsResponsesWorkspace apiBaseURL={apiBaseURL} />
    </MonitoringDataProvider>
  );
}
