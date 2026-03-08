export type OrganizationRole = "owner" | "admin" | "member";
export type SimulatedPlan = "starter" | "growth" | "pro" | "agency-enterprise";
export type OrganizationTab = "members" | "invitations" | "settings";

export type OrganizationSummary = {
  id: string;
  name: string;
  role: OrganizationRole;
  membersCount: number;
};
