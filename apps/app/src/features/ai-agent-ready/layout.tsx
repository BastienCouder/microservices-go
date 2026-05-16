import { memo } from "react";

import { AgentReadyAuditPanel } from "./_components/audit-panel";

type AgentReadyLayoutProps = {
  apiBaseURL: string;
};

export const AgentReadyLayout = memo(function AgentReadyLayout({
  apiBaseURL,
}: AgentReadyLayoutProps) {
  return <AgentReadyAuditPanel apiBaseURL={apiBaseURL} />;
});
