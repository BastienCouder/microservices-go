export type SidebarProjectOption = {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  brandName: string;
  status: string;
  initials: string;
};

export type SidebarItem = {
  href: string;
  labelKey: "prompts" | "pages" | "brands" | "models" | "organizations" | "team" | "billing" | "settings";
};

export const SIDEBAR_LABELS = {
  prompts: "prompts",
  pages: "pages",
  brands: "brands",
  models: "models",
  organizations: "organizations",
  team: "team",
  billing: "billing",
  settings: "project settings",
} as const;

export const MONITORING_ITEMS: SidebarItem[] = [
  { href: "/prompts", labelKey: "prompts" },
  { href: "/pages", labelKey: "pages" },
  { href: "/brands", labelKey: "brands" },
  { href: "/models", labelKey: "models" },
];

export const ORGANIZATION_ITEMS: SidebarItem[] = [
  { href: "/organizations", labelKey: "organizations" },
  { href: "/billing", labelKey: "billing" },
  { href: "/settings", labelKey: "settings" },
];
