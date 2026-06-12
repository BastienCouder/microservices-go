import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { appQueryKeys } from "@/lib/query-keys";
import { loadUserOrganizationSummaries } from "@/shared/organizations";
import {
  readOrganizationIdFromSearch,
  readSelectedOrganizationPublicID,
} from "@/shared/selection";

export type NormalizedOrganizationRole = "editor" | "viewer" | "super_admin";

export function normalizeOrganizationRole(role: string | null | undefined): NormalizedOrganizationRole {
  const normalized = role?.trim().toLowerCase() ?? "";
  if (normalized === "editor" || normalized === "admin" || normalized === "owner") return "editor";
  if (normalized === "super_admin") return "super_admin";
  return "viewer";
}

export function canEditWithOrganizationRole(role: string | null | undefined): boolean {
  return normalizeOrganizationRole(role) === "editor";
}

export function readEffectiveOrganizationId(routeSearch: string): string {
  const routeOrganizationId = readOrganizationIdFromSearch(routeSearch);
  return routeOrganizationId || readSelectedOrganizationPublicID();
}

export function useSelectedOrganizationPermissions({
  apiBaseURL,
  routeSearch,
}: {
  apiBaseURL: string;
  routeSearch: string;
}) {
  const organizationId = useMemo(
    () => readEffectiveOrganizationId(routeSearch),
    [routeSearch],
  );
  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, "selected-permissions"),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadUserOrganizationSummaries(apiBaseURL, signal),
  });
  const selectedOrganization = useMemo(() => {
    const organizations = organizationsQuery.data ?? [];
    return (
      organizations.find(
        (organization) =>
          organization.id === organizationId || organization.publicId === organizationId,
      ) ?? null
    );
  }, [organizationId, organizationsQuery.data]);
  const role = normalizeOrganizationRole(selectedOrganization?.role);

  return {
    organizationId,
    role,
    canEdit: canEditWithOrganizationRole(role),
    loading: organizationsQuery.isLoading || organizationsQuery.isFetching,
  };
}
