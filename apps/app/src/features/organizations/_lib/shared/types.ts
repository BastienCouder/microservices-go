export type OrganizationRole =
  | "owner"
  | "admin"
  | "member"
  | "project_member"
  | "super_admin";

export type OrganizationSummary = {
  id: string;
  slug: string;
  name: string;
  role: OrganizationRole;
};

export type OrganizationProject = {
  id: string;
  slug: string;
  organizationId: string;
  name: string;
  status: string;
  brandName: string;
  brandDescription: string;
  attributionSource: string;
  createdAt: string;
};

export type OrganizationProjectMember = {
  projectId: string;
  organizationId: string;
  userId: string;
  role: string;
  addedAt: string;
};

export type OrganizationMember = {
  organizationId: string;
  userId: string;
  email: string;
  roles: string[];
  addedAt: string;
};

export type OrganizationInvitation = {
  id: string;
  organizationId: string;
  projectId: string;
  email: string;
  role: string;
  token: string;
  message: string;
  status: "pending" | "accepted" | "refused" | "revoked";
  invitedByUserId: string;
  acceptedByUserId: string;
  createdAt: string;
  expiresAt: string;
  respondedAt: string;
};

export type OrganizationResources = {
  organization: OrganizationSummary | null;
  projects: OrganizationProject[];
  projectMembers: OrganizationProjectMember[];
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
};

export type ViewTab = "projects" | "members" | "invitations";

export type InvitationDraft = {
  email: string;
  role: string;
  message: string;
  projectId: string;
};

export type ProjectMemberDraft = {
  userId: string;
  role: string;
};
