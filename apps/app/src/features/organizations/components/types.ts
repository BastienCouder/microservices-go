export type OrganizationRole = "owner" | "admin" | "member";
export type { SimulatedPlan } from "@/shared/billing-plan";
export type OrganizationTab = "overview" | "members" | "invitations" | "settings";

export type OrganizationSummary = {
  id: string;
  name: string;
  role: OrganizationRole;
  membersCount: number;
};
