import { memo } from "react";

import { AgentReadyAuditPanel } from "./_components/audit-panel";

type AgentReadyLayoutProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export const AgentReadyLayout = memo(function AgentReadyLayout({
  apiBaseURL,
  routeSearch,
}: AgentReadyLayoutProps) {
  return <AgentReadyAuditPanel apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
});
