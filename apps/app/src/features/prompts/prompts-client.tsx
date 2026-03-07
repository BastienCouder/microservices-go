import { PromptsResponsesWorkspace } from "./_components/prompts-workspace";
import { DashboardDataProvider } from "@/hooks/use-dashboard-data";

type PromptsClientProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function PromptsClient({ apiBaseURL, routeSearch }: PromptsClientProps) {
  return (
    <DashboardDataProvider apiBaseURL={apiBaseURL} routeSearch={routeSearch}>
      <PromptsResponsesWorkspace />
    </DashboardDataProvider>
  );
}
