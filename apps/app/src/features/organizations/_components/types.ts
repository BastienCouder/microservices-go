export type OrganizationRole = "owner" | "admin" | "member";
export type SimulatedPlan = "free" | "pro-monthly" | "pro-yearly";
export type OrganizationTab = "members" | "invitations" | "settings";

export type OrganizationSummary = {
  id: string;
  name: string;
  role: OrganizationRole;
  membersCount: number;
};
