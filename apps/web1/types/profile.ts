export const PLAN_SLUGS = ["free", "pro-monthly", "pro-yearly"] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

export type ProfileMe = {
  id: string;
  authUserId: string;
  displayName: string | null;
  avatarUrl: string | null;
  email?: string | null;

  subscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionProductId: string | null;

  planSlug: PlanSlug;

  cancelAtPeriodEnd: boolean | null;
  currentPeriodEnd: string | null;
};