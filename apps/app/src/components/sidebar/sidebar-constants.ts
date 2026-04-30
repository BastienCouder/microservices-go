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
    | "prompts"
    | "pages"
    | "traffic"
    | "brands"
    | "models"
    | "adminModels"
    | "organizations"
    | "team"
    | "billing"
    | "settings"
    | "account";
};

export const SIDEBAR_LABELS = {
  prompts: "prompts",
  pages: "pages",
  traffic: "Traffic",
  brands: "brands",
  models: "models",
  adminModels: "admin models",
  organizations: "organizations",
  team: "team",
  billing: "billing",
  settings: "project settings",
  account: "account",
} as const;

export const MONITORING_ITEMS: SidebarItem[] = [
  { href: "/prompts", labelKey: "prompts" },
  { href: "/pages", labelKey: "pages" },
  { href: "/brands", labelKey: "brands" },
  { href: "/models", labelKey: "models" },
];

export const ORGANIZATION_ITEMS: SidebarItem[] = [
  { href: "/admin/models", labelKey: "adminModels" },
  { href: "/organizations", labelKey: "organizations" },
  { href: "/billing", labelKey: "billing" },
  { href: "/settings", labelKey: "settings" },
];
