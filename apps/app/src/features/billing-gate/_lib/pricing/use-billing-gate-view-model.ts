import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { appQueryKeys } from "@/lib/query-keys";
import { getBillingPlanLabel } from "@/shared/billing-plan";
import { loadBillingEntitlements } from "@/shared/billing";
import {
  loadUserOrganizationSummaries,
  type UserOrganizationSummary,
} from "@/shared/organizations";
import {
  createBillingOrganization,
  createStripeCheckoutSession,
  type BillingCycle,
  type CheckoutPlan,
} from "./billing-gate-api";

type CheckoutIntent = {
  plan: CheckoutPlan;
};

export type PricingPlan = {
  id: CheckoutPlan;
  name: string;
  price: string;
  yearlyPrice: string;
  quota: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: getBillingPlanLabel("starter"),
    price: "49 EUR",
    yearlyPrice: "39 EUR",
    quota: "50 prompts / mois",
    description: "Pour lancer un premier projet GEO sans complexite.",
    features: ["1 siege inclus", "3 modeles suivis", "Monitoring de marque"],
  },
  {
    id: "growth",
    name: getBillingPlanLabel("growth"),
    price: "149 EUR",
    yearlyPrice: "119 EUR",
    quota: "200 prompts / mois",
    description: "Pour une equipe qui pilote plusieurs contenus et concurrents.",
    features: ["Jusqu'a 3 sieges", "6 modeles suivis", "Prompts et pages prioritaires"],
    highlighted: true,
  },
  {
    id: "pro",
    name: getBillingPlanLabel("pro"),
    price: "399 EUR",
    yearlyPrice: "319 EUR",
    quota: "Usage etendu",
    description: "Pour une organisation qui industrialise le suivi IA.",
    features: ["Sieges avances", "Quota etendu", "Accompagnement de lancement"],
  },
];

function getInitialOrganizationName(userEmail?: string): string {
  const emailPrefix = userEmail?.split("@", 1)[0]?.trim();
  return emailPrefix ? `${emailPrefix} workspace` : "";
}

function getCheckoutNotice(search: string): string {
  const params = new URLSearchParams(search);
  if (params.get("checkout") === "success") {
    return "Paiement en cours de confirmation. La redirection vers l'app se fera des que Stripe confirme l'abonnement.";
  }
  if (params.get("checkout") === "cancel") {
    return "Paiement annule. Tu peux relancer un plan quand tu es pret.";
  }
  return "";
}

export function useBillingGateViewModel({
  apiBaseURL,
  routeSearch,
  userEmail,
}: {
  apiBaseURL: string;
  routeSearch: string;
  userEmail?: string;
}) {
  const queryClient = useQueryClient();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [organizationName, setOrganizationName] = useState(() => getInitialOrganizationName(userEmail));
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [localError, setLocalError] = useState("");

  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, null),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadUserOrganizationSummaries(apiBaseURL, signal),
  });

  const organizations = organizationsQuery.data ?? [];
  const activeOrganizationId =
    selectedOrganizationId ||
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
    mutationFn: async ({ plan }: CheckoutIntent) => {
      setLocalError("");
      let organizationId = activeOrganizationId;
      if (!organizationId) {
        organizationId = await createBillingOrganization(apiBaseURL, organizationName);
        setSelectedOrganizationId(organizationId);
        await queryClient.invalidateQueries({ queryKey: appQueryKeys.organizations(apiBaseURL, null) });
      }

      const checkoutURL = await createStripeCheckoutSession(apiBaseURL, {
        organizationId,
        plan,
        billingCycle,
      });
      window.location.assign(checkoutURL);
    },
    onError: (error) => {
      setLocalError(error instanceof Error ? error.message : "Impossible de demarrer le paiement.");
    },
  });

  const selectedOrganization = useMemo<UserOrganizationSummary | null>(
    () =>
      organizations.find((organization) => organization.id === activeOrganizationId) ??
      null,
    [activeOrganizationId, organizations],
  );

  return {
    billingCycle,
    billingStatus: billingQuery.data?.subscriptionStatus ?? "",
    checkoutNotice: getCheckoutNotice(routeSearch),
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
    plans: PRICING_PLANS,
    selectedOrganization,
    selectedOrganizationId: activeOrganizationId,
    setBillingCycle,
    setOrganizationName,
    setSelectedOrganizationId,
    startCheckout: (plan: CheckoutPlan) => checkoutMutation.mutate({ plan }),
  };
}
