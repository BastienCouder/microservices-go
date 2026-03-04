"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/server-api";
import { apiRoutes } from "@/lib/api-config";
import { type ProfileMe } from "@/types/profile";

export const PLAN_SLUGS = ["free", "pro-monthly", "pro-yearly"] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

function getPlanLabel(profile: ProfileMe | null): string {
  if (!profile) return "Unknown";
  if (!profile.subscriptionId || !profile.subscriptionProductId || profile.subscriptionProductId === "free") {
    return "Free";
  }
  // Logic fix: Check status
  if (!["active", "trialing"].includes(profile.subscriptionStatus || "")) {
    return "Free (Canceled)";
  }
  if (profile.subscriptionProductId === "pro-monthly") return "Pro (Monthly)";
  if (profile.subscriptionProductId === "pro-yearly") return "Pro (Annual)";
  return "Pro";
}

export function useBilling(profile: ProfileMe | null) {
  const planSlug: PlanSlug = profile?.planSlug ?? "free";
  const currentPlanLabel = getPlanLabel(profile);
  const hasSubscription = !!profile?.subscriptionId;

  const hasPaidSubscription =
    !!profile?.subscriptionId &&
    (profile.subscriptionProductId === "pro-monthly" ||
      profile.subscriptionProductId === "pro-yearly") &&
    ["active", "trialing"].includes(profile.subscriptionStatus || "");

  const nextBillingDate = profile?.currentPeriodEnd
    ? new Date(profile.currentPeriodEnd).toLocaleDateString()
    : null;

  const willEndAtPeriodEnd = !!profile?.cancelAtPeriodEnd;

  const cancelMutation = useMutation({
    mutationFn: (immediate: boolean) =>
      apiFetch(apiRoutes.billing.cancelSubscription(), {
        method: "POST",
        body: JSON.stringify({ immediate }),
      }),
    onSuccess: () => {
      window.location.reload();
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () =>
      apiFetch(apiRoutes.billing.resumeSubscription(), {
        method: "POST",
      }),
    onSuccess: () => {
      window.location.reload();
    },
  });

  const cancelSubscription = (immediate: boolean) => {
    cancelMutation.mutate(immediate);
  };

  const resumeSubscription = () => {
    resumeMutation.mutate();
  };

  return {
    profile,
    planSlug,
    currentPlanLabel,
    hasSubscription,
    hasPaidSubscription,
    nextBillingDate,
    willEndAtPeriodEnd,
    cancelSubscription,
    isCancelling: cancelMutation.isPending,
    resumeSubscription,
    isResuming: resumeMutation.isPending,
  };
}