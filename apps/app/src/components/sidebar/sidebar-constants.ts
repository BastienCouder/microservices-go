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
    | "perception"
    | "traffic"
    | "crawler"
    | "contentOptimizer"
    | "errorHub"
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
  perception: "perception",
  traffic: "Traffic",
  crawler: "crawler",
  contentOptimizer: "content optimizer",
  errorHub: "error hub",
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
  { href: "/prompts", labelKey: "responses" },
  { href: "/pages", labelKey: "pages" },
];

export const BRAND_CONTEXT_ITEMS: SidebarItem[] = [
  { href: "/brands", labelKey: "brands" },
  { href: "/models", labelKey: "models" },
];

export const OPTIMIZATION_ITEMS: SidebarItem[] = [
  { href: "/content-optimizer", labelKey: "contentOptimizer" },
  { href: "/crawler", labelKey: "crawler" },
  { href: "/error-hub", labelKey: "errorHub" },
];

export const SETTINGS_ITEMS: SidebarItem[] = [
  { href: "/organizations", labelKey: "organizations" },
  { href: "/account", labelKey: "account" },
];
