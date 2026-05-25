import { AgentReadyLayout } from "./layout";

type AgentReadyPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function AgentReadyPage({ apiBaseURL, routeSearch }: AgentReadyPageProps) {
  return <AgentReadyLayout apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
