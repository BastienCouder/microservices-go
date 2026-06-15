import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { appQueryKeys } from "@/lib/query-keys";
import {
  isNumericOrganizationId,
  loadUserOrganizationSummaries,
  resolveNumericOrganizationIdFromSummaries,
} from "@/shared/organizations";

export function useResolvedBillingOrganizationId({
  apiBaseURL,
  organizationId,
}: {
  apiBaseURL: string;
  organizationId?: string | null;
}) {
  const organizationToken = organizationId?.trim() ?? "";
  const requiresResolution =
    apiBaseURL.trim() !== "" &&
    organizationToken !== "" &&
    !isNumericOrganizationId(organizationToken);

  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, null),
    enabled: requiresResolution,
    queryFn: ({ signal }) => loadUserOrganizationSummaries(apiBaseURL, signal),
  });

  const resolvedOrganizationId = useMemo(() => {
    if (isNumericOrganizationId(organizationToken)) {
      return organizationToken;
    }

    return resolveNumericOrganizationIdFromSummaries(
      organizationsQuery.data ?? [],
      organizationToken,
    );
  }, [organizationToken, organizationsQuery.data]);

  return {
    organizationId: resolvedOrganizationId,
    isLoading:
      requiresResolution &&
      (organizationsQuery.isLoading ||
        (organizationsQuery.isFetching && !organizationsQuery.data)),
  };
}
