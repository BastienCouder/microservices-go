import { AgentReadyLayout } from "./layout";

type AgentReadyPageProps = {
  apiBaseURL: string;
};

export function AgentReadyPage({ apiBaseURL }: AgentReadyPageProps) {
  return <AgentReadyLayout apiBaseURL={apiBaseURL} />;
}
