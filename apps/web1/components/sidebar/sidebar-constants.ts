import { BrainCircuit, Building2, FileText, MessageSquareText, Settings, ShieldCheck, type LucideIcon } from "lucide-react";

export type SidebarOrg = {
  id: string;
  name: string;
  domain: string;
  initials: string;
};

export type SidebarItem = {
  href: string;
  labelKey: "prompts" | "pages" | "brands" | "models" | "organizations" | "team" | "settings";
  icon: LucideIcon;
};

export const ORGS: SidebarOrg[] = [
  { id: "bco", name: "BCO", domain: "bastiencouder.com", initials: "BC" },
];

export const MONITORING_ITEMS: SidebarItem[] = [
  { href: "/prompts", labelKey: "prompts", icon: MessageSquareText },
  { href: "/pages", labelKey: "pages", icon: FileText },
  { href: "/brands", labelKey: "brands", icon: ShieldCheck },
  { href: "/models", labelKey: "models", icon: BrainCircuit },
];

export const ORGANIZATION_ITEMS: SidebarItem[] = [
  { href: "/organizations", labelKey: "organizations", icon: Building2 },
  { href: "/settings", labelKey: "settings", icon: Settings },
];
