import { PromptsWorkspacePanel } from "./_components/workspace";

type PromptsLayoutProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function PromptsLayout({ apiBaseURL, routeSearch }: PromptsLayoutProps) {
  return <PromptsWorkspacePanel apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
