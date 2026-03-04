export type MainNavLink = {
  label: string;
  href: string;
};

export type ActionNavItem = {
  id: string;
  label?: string;
  icon: "settings" | "user";
  href: string;
};

export const MAIN_NAV_LINKS: MainNavLink[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Projects", href: "/projects" },
  { label: "Analysis", href: "/analysis" },
];

export const ACTION_NAV_ITEMS: ActionNavItem[] = [
  { id: "settings", label: "Settings", icon: "settings", href: "/account" },
  { id: "account", icon: "user", href: "/account" },
];
