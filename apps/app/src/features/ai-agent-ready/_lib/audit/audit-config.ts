import type { AuditCheckID, CheckGroup, ScanMode } from "../shared/types";

export const DEFAULT_AUDIT_CHECKS: AuditCheckID[] = [
  "robots_txt",
  "sitemap",
  "link_headers",
  "markdown_negotiation",
  "ai_bot_rules",
  "content_signals",
];

export const SCAN_MODES: Array<{
  id: ScanMode;
  label: string;
  description: string;
  disabled?: boolean;
}> = [
  {
    id: "all-checks",
    label: "All Checks",
    description: "Runs every available Content Site check now, with room for API and commerce checks later.",
  },
  {
    id: "content-site",
    label: "Content Site",
    description: "Focuses on discoverability, readable content, and AI bot access signals.",
  },
  {
    id: "api-application",
    label: "API / Application",
    description: "Reserved for API, auth, MCP, and commerce readiness checks.",
    disabled: true,
  },
];

export const CHECK_GROUPS: CheckGroup[] = [
  {
    id: "discoverability",
    label: "Discoverability",
    description: "Helps agents find the public entry points and crawl map.",
    checks: [
      {
        id: "robots_txt",
        label: "robots.txt",
        description: "Presence, crawl groups, allow/disallow directives.",
      },
      {
        id: "sitemap",
        label: "sitemap",
        description: "robots.txt declaration or fallback /sitemap.xml.",
      },
      {
        id: "link_headers",
        label: "link headers",
        description: "Machine-discoverable docs, APIs, feeds, or well-known resources.",
      },
    ],
  },
  {
    id: "content",
    label: "Content Accessibility",
    description: "Checks if core content can be retrieved in a clean agent-friendly format.",
    checks: [
      {
        id: "markdown_negotiation",
        label: "markdown negotiation",
        description: "Accept: text/markdown support on the home page.",
      },
    ],
  },
  {
    id: "bot_access",
    label: "Bot Access Control",
    description: "Makes access policy and content usage signals explicit.",
    checks: [
      {
        id: "ai_bot_rules",
        label: "AI bot rules",
        description: "Known AI crawler groups in robots.txt.",
      },
      {
        id: "content_signals",
        label: "Content Signals",
        description: "Content-Signal header or equivalent policy link.",
      },
      {
        id: "web_bot_auth",
        label: "Web Bot Auth",
        description: "Optional signed bot access verification.",
        disabled: true,
      },
    ],
  },
];
