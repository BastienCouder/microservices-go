export type SidebarProjectOption = {
  id: string;
  slug: string;
  name: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  brandName: string;
  status: string;
  initials: string;
};

export type SidebarItem = {
  href: string;
  labelKey:
    | "dashboard"
    | "prompts"
    | "responses"
    | "pages"
    | "traffic"
    | "crawler"
    | "contentOptimizer"
    | "errorHub"
    | "aiAgentReady"
    | "brands"
    | "optimizeActions"
    | "models"
    | "adminModels"
    | "organizations"
    | "team"
    | "billing"
    | "settings"
    | "account";
};

export const SIDEBAR_LABELS = {
  dashboard: "dashboard",
  prompts: "prompts",
  responses: "responses",
  pages: "pages",
  traffic: "Traffic",
  crawler: "crawler",
  contentOptimizer: "content optimizer",
  errorHub: "error hub",
  aiAgentReady: "AI agent ready",
  brands: "brands",
  optimizeActions: "optimization",
  models: "models",
  adminModels: "admin models",
  organizations: "organizations",
  team: "team",
  billing: "billing",
  settings: "project settings",
  account: "account",
} as const;

export const MONITORING_ITEMS: SidebarItem[] = [
  { href: "/monitoring", labelKey: "dashboard" },
  { href: "/prompts", labelKey: "prompts" },
  { href: "/pages", labelKey: "pages" },
  { href: "/brands", labelKey: "brands" },
  { href: "/models", labelKey: "models" },
  { href: "/traffic", labelKey: "traffic" },
];

export const OPTIMIZATION_ITEMS: SidebarItem[] = [
  { href: "/crawler", labelKey: "crawler" },
  { href: "/content-optimizer", labelKey: "contentOptimizer" },
  { href: "/error-hub", labelKey: "errorHub" },
  { href: "/ai-agent-ready", labelKey: "aiAgentReady" },
];

export const ORGANIZATION_ITEMS: SidebarItem[] = [
  { href: "/admin/models", labelKey: "adminModels" },
  { href: "/organizations", labelKey: "organizations" },
  { href: "/billing", labelKey: "billing" },
  { href: "/settings", labelKey: "settings" },
];
