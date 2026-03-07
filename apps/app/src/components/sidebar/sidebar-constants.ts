export type SidebarOrg = {
  id: string;
  name: string;
  domain: string;
  initials: string;
};

export type SidebarItem = {
  href: string;
  labelKey: "prompts" | "pages" | "brands" | "models" | "organizations" | "team" | "settings";
};

export const ORGS: SidebarOrg[] = [
  { id: "bco", name: "BCO", domain: "bastiencouder.com", initials: "BC" },
];

export const MONITORING_ITEMS: SidebarItem[] = [
  { href: "/prompts", labelKey: "prompts" },
  { href: "/pages", labelKey: "pages" },
  { href: "/brands", labelKey: "brands" },
  { href: "/models", labelKey: "models" },
];

export const ORGANIZATION_ITEMS: SidebarItem[] = [
  { href: "/organizations", labelKey: "organizations" },
  { href: "/settings", labelKey: "settings" },
];
