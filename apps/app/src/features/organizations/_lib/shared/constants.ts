import type { InvitationDraft, OrganizationResources, OrganizationSummary } from "./types";

export const EMPTY_ORGANIZATIONS: OrganizationSummary[] = [];

export const EMPTY_RESOURCES: OrganizationResources = {
  organization: null,
  projects: [],
  projectMembers: [],
  members: [],
  invitations: [],
};

export const EMPTY_INVITATION_DRAFT: InvitationDraft = {
  email: "",
  role: "member",
  message: "",
  projectId: "",
};
