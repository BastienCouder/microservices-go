import type {
  InvitationDraft,
  OrganizationResources,
  OrganizationSummary,
  ViewTab,
} from "./types";

export const EMPTY_ORGANIZATIONS: OrganizationSummary[] = [];

export const EMPTY_RESOURCES: OrganizationResources = {
  organization: null,
  projects: [],
  projectMembers: [],
  members: [],
  invitations: [],
  apiKeys: [],
};

export const EMPTY_INVITATION_DRAFT: InvitationDraft = {
  email: "",
  role: "member",
  message: "",
  projectId: "",
};

export const DEFAULT_ORGANIZATION_VIEW_TAB: ViewTab = "projects";

export const ORGANIZATION_VIEW_TABS: { value: ViewTab; label: string }[] = [
  { value: "projects", label: "Projects" },
  { value: "members", label: "Users" },
  { value: "invitations", label: "Invitations" },
  { value: "settings", label: "Settings" },
  { value: "apiKeys", label: "API keys" },
];

const MANAGER_ROLES = new Set(["owner", "admin", "super_admin"]);
const MEMBER_VIEW_TABS = new Set<ViewTab>(["projects", "members"]);

export function canManageOrganizationPages(roles: string[]): boolean {
  return roles.some((role) => MANAGER_ROLES.has(role.trim().toLowerCase()));
}

export function getOrganizationViewTabsForRoles(roles: string[]) {
  if (canManageOrganizationPages(roles)) return ORGANIZATION_VIEW_TABS;
  return ORGANIZATION_VIEW_TABS.filter((tab) => MEMBER_VIEW_TABS.has(tab.value));
}

export function isOrganizationViewTabAvailable(tab: ViewTab, roles: string[]): boolean {
  return getOrganizationViewTabsForRoles(roles).some((item) => item.value === tab);
}
