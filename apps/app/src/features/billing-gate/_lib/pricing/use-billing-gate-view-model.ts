import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { appQueryKeys } from "@/lib/query-keys";
import { invalidateQueryKeys } from "@/shared/api/query-refresh";
import { getBillingPlanLabel } from "@/shared/billing-plan";
import { loadBillingEntitlements } from "@/shared/billing";
import {
  loadUserOrganizationSummaries,
  type UserOrganizationSummary,
} from "@/shared/organizations";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  createBillingOrganization,
  createStripeCheckoutSession,
  type BillingCycle,
  type CheckoutPlan,
} from "./billing-gate-api";

type CheckoutIntent = {
  plan: CheckoutPlan;
  promptVolume?: number;
};

export type PricingPlan = {
  id: CheckoutPlan;
  name: string;
  price: string;
  yearlyPrice: string;
  annualBillingText?: string;
  quota: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  custom?: boolean;
};

function getInitialOrganizationName(userEmail?: string): string {
  const emailPrefix = userEmail?.split("@", 1)[0]?.trim();
  return emailPrefix ? `${emailPrefix} workspace` : "";
}

function buildPricingPlans(
  t: (key: string, options?: Record<string, unknown>) => string,
): PricingPlan[] {
  return [
    {
      id: "starter",
      name: getBillingPlanLabel("starter"),
      price: "59 EUR",
      yearlyPrice: "49 EUR",
      annualBillingText: t("starterAnnualBilling"),
      quota: t("starterQuota"),
      description: t("starterDescription"),
      features: [t("starterFeatureSeats"), t("starterFeatureModels"), t("starterFeatureMonitoring")],
    },
    {
      id: "growth",
      name: getBillingPlanLabel("growth"),
      price: "199 EUR",
      yearlyPrice: "159 EUR",
      annualBillingText: t("growthAnnualBilling"),
      quota: t("growthQuota"),
      description: t("growthDescription"),
      features: [t("growthFeatureSeats"), t("growthFeatureModels"), t("growthFeaturePrompts")],
      highlighted: true,
    },
    {
      id: "pro",
      name: getBillingPlanLabel("pro"),
      price: "499 EUR",
      yearlyPrice: "399 EUR",
      annualBillingText: t("proAnnualBilling"),
      quota: t("proQuota"),
      description: t("proDescription"),
      features: [t("proFeatureSeats"), t("proFeatureQuota"), t("proFeatureLaunch")],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: t("customPrice"),
      yearlyPrice: t("customPrice"),
      quota: t("enterpriseQuota"),
      description: t("enterpriseDescription"),
      features: [
        t("enterpriseFeatureCredits"),
        t("enterpriseFeatureProjects"),
        t("enterpriseFeatureSecurity"),
      ],
      custom: true,
    },
  ];
}

function getCheckoutNotice(
  search: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const params = new URLSearchParams(search);
  if (params.get("checkout") === "success") {
    return t("checkoutSuccessNotice");
  }
  if (params.get("checkout") === "cancel") {
    return t("checkoutCancelNotice");
  }
  return "";
}

export function useBillingGateViewModel({
  apiBaseURL,
  organizationId = "",
  routeSearch,
  userEmail,
}: {
  apiBaseURL: string;
  organizationId?: string;
  routeSearch: string;
  userEmail?: string;
}) {
  const { t } = useScopedI18n("billing-gate");
  const queryClient = useQueryClient();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [organizationName, setOrganizationName] = useState(() => getInitialOrganizationName(userEmail));
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(organizationId);
  const [localError, setLocalError] = useState("");
  const plans = useMemo(() => buildPricingPlans(t), [t]);

  useEffect(() => {
    if (organizationId.trim()) {
      setSelectedOrganizationId(organizationId);
    }
  }, [organizationId]);

  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, null),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadUserOrganizationSummaries(apiBaseURL, signal),
  });

  const organizations = organizationsQuery.data ?? [];
  const activeOrganizationId =
    selectedOrganizationId ||
    organizationId ||
    organizations[0]?.id ||
    "";
  const hasOrganizations = organizations.length > 0;

  const billingQuery = useQuery({
    queryKey: appQueryKeys.billingQuota(apiBaseURL, activeOrganizationId),
    enabled: apiBaseURL.trim() !== "" && activeOrganizationId !== "",
    queryFn: ({ signal }) =>
      loadBillingEntitlements(apiBaseURL, activeOrganizationId, { signal }),
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ plan, promptVolume }: CheckoutIntent) => {
      setLocalError("");
      let organizationId = activeOrganizationId;
      if (!organizationId) {
        organizationId = await createBillingOrganization(apiBaseURL, organizationName);
        setSelectedOrganizationId(organizationId);
        await invalidateQueryKeys(queryClient, [
          ["organizations", apiBaseURL],
          ["organizations", "project-context-hierarchies", apiBaseURL],
        ]);
      }

      const checkoutURL = await createStripeCheckoutSession(apiBaseURL, {
        organizationId,
        plan,
        billingCycle,
        promptVolume,
      });
      window.location.assign(checkoutURL);
    },
    onError: (error) => {
      setLocalError(
        error instanceof Error ? error.message : t("startPaymentError"),
      );
    },
  });

  const selectedOrganization = useMemo<UserOrganizationSummary | null>(
    () =>
      organizations.find((organization) => organization.id === activeOrganizationId) ??
      null,
    [activeOrganizationId, organizations],
  );

  return {
    actionError: localError || "",
    billingCycle,
    billingStatus: billingQuery.data?.subscriptionStatus ?? "",
    checkoutNotice: getCheckoutNotice(routeSearch, t),
    error:
      localError ||
      (organizationsQuery.error instanceof Error ? organizationsQuery.error.message : "") ||
      (billingQuery.error instanceof Error ? billingQuery.error.message : ""),
    hasOrganizations,
    isChecking: organizationsQuery.isLoading || billingQuery.isLoading,
    isPaid: billingQuery.data?.isPaid === true,
    isSubmitting: checkoutMutation.isPending,
    organizationName,
    organizations,
    plans,
    selectedOrganization,
    selectedOrganizationId: activeOrganizationId,
    setBillingCycle,
    setOrganizationName,
    setSelectedOrganizationId,
    startCheckout: (plan: CheckoutPlan, promptVolume?: number) =>
      checkoutMutation.mutate({ plan, promptVolume }),
  };
}
