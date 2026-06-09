import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { appQueryKeys } from "@/lib/query-keys";
import { API_CONFIG } from "@/lib/api-config";
import { loadBillingEntitlements } from "@/shared/billing";
import { normalizeBillingPlan } from "@/shared/billing-plan";
import {
  readOrganizationIdFromSearch,
  readSelectedOrganizationID,
} from "@/shared/selection";

const EXPORT_PLAN_CODES = new Set(["growth", "pro", "agency", "agency-enterprise"]);

export function canUseClientExports(plan: string | null | undefined): boolean {
  const normalizedPlan = normalizeBillingPlan(plan ?? null);
  return normalizedPlan !== null && EXPORT_PLAN_CODES.has(normalizedPlan);
}

function resolveExportOrganizationId(routeSearch?: string, organizationId?: string | null) {
  return (
    organizationId?.trim() ||
    (routeSearch ? readOrganizationIdFromSearch(routeSearch) : "") ||
    readSelectedOrganizationID()
  );
}

export function useClientExportAccess({
  apiBaseURL = API_CONFIG.BASE_URL,
  organizationId,
  routeSearch,
}: {
  apiBaseURL?: string;
  organizationId?: string | null;
  routeSearch?: string;
} = {}) {
  const resolvedOrganizationId = useMemo(
    () => resolveExportOrganizationId(routeSearch, organizationId),
    [organizationId, routeSearch],
  );

  const billingQuery = useQuery({
    queryKey: appQueryKeys.billingQuota(apiBaseURL, resolvedOrganizationId),
    enabled: apiBaseURL.trim() !== "" && resolvedOrganizationId !== "",
    queryFn: ({ signal }) =>
      loadBillingEntitlements(apiBaseURL, resolvedOrganizationId, { signal }),
  });

  return {
    canExport: canUseClientExports(billingQuery.data?.plan),
    loading: billingQuery.isLoading || (billingQuery.isFetching && !billingQuery.data),
    plan: billingQuery.data?.plan ?? null,
  };
}
