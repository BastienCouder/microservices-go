import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "AI Reco Monitor Docs",
    },
    links: [
      {
        text: "Overview",
        url: "/docs",
      },
      {
        text: "Authentication",
        url: "/docs/authentication",
        active: "nested-url",
      },
      {
        text: "Organization",
        url: "/docs/organization",
      },
      {
        text: "Workspace",
        url: "/docs/workspace",
      },
      {
        text: "MCP",
        url: "/docs/mcp",
      },
    ],
  };
}
