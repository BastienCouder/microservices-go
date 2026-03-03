export type SessionInfo = {
  identity_id: string;
  email: string;
  name: string;
};

export type UserProfile = {
  ID: number;
  AuthIdentityID: string;
  Email: string;
  FirstName: string;
  LastName: string;
  Banned: boolean;
  BannedAt?: string | null;
  CreatedAt: string;
  DeletedAt?: string | null;
};

export type Organization = {
  ID: number;
  Name: string;
  OwnerIdentityID: number;
  CreatedAt: string;
  DeletedAt?: string | null;
};

export type Team = {
  ID: number;
  OrganizationID: number;
  Name: string;
  CreatedAt: string;
  DeletedAt?: string | null;
};

export type OrganizationMember = {
  OrganizationID: number;
  UserID: number;
  TeamID: number;
  Roles: string[];
  AddedAt: string;
  DeletedAt?: string | null;
};

export type OrganizationInvitation = {
  ID: number;
  OrganizationID: number;
  Email: string;
  Role: string;
  Token: string;
  Message: string;
  Status: "pending" | "accepted" | "refused" | "revoked";
  InvitedByUserID: number;
  AcceptedByUserID: number;
  CreatedAt: string;
  ExpiresAt?: string | null;
  RespondedAt?: string | null;
  DeletedAt?: string | null;
};

export type AcceptInvitationResponse = {
  invitation: OrganizationInvitation;
  member: OrganizationMember;
};
