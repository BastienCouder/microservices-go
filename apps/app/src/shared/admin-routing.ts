export const ADMIN_ROUTE_ROOT = "/gateway/kh7m2q";

export const adminRoutePaths = {
  organizations: `${ADMIN_ROUTE_ROOT}/tenants`,
  users: `${ADMIN_ROUTE_ROOT}/users`,
  pricing: `${ADMIN_ROUTE_ROOT}/catalog`,
  models: `${ADMIN_ROUTE_ROOT}/providers`,
} as const;

export const legacyAdminRoutePaths = {
  organizations: "/admin/organizations",
  users: "/admin/users",
  pricing: "/admin/pricing",
  models: "/admin/models",
} as const;

export type AdminRouteKey = keyof typeof adminRoutePaths;

const adminRouteEntries = Object.entries(adminRoutePaths) as [
  AdminRouteKey,
  (typeof adminRoutePaths)[AdminRouteKey],
][];
const legacyAdminRouteEntries = Object.entries(legacyAdminRoutePaths) as [
  AdminRouteKey,
  (typeof legacyAdminRoutePaths)[AdminRouteKey],
][];

export function canAccessAdminRole(role: string | null | undefined): boolean {
  return isSuperAdminRole(role);
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return (role?.trim().toLowerCase() ?? "") === "super_admin";
}

export function findPrimaryAdminOrganization<T extends { role: string }>(
  organizations: readonly T[],
): T | null {
  return organizations.find((organization) => canAccessAdminRole(organization.role)) ?? null;
}

export function resolvePreferredAdminOrganization<
  T extends { id: string; role: string; publicId?: string | null },
>(
  organizations: readonly T[],
  organizationId: string | null | undefined,
): T | null {
  const normalizedOrganizationId = organizationId?.trim() ?? "";
  if (normalizedOrganizationId) {
    const scopedOrganization =
      organizations.find(
        (organization) =>
          (organization.id === normalizedOrganizationId ||
            (organization.publicId?.trim() ?? "") === normalizedOrganizationId) &&
          canAccessAdminRole(organization.role),
      ) ?? null;
    if (scopedOrganization) return scopedOrganization;
  }
  return findPrimaryAdminOrganization(organizations);
}

export function getAdminRouteKey(pathname: string): AdminRouteKey | null {
  for (const [key, value] of adminRouteEntries) {
    if (pathname === value) return key;
  }
  for (const [key, value] of legacyAdminRouteEntries) {
    if (pathname === value) return key;
  }
  return null;
}

export function isAnyAdminRoutePath(pathname: string): boolean {
  return getAdminRouteKey(pathname) !== null;
}

export function getAdminPrivatePathPrefixes(): string[] {
  return ["/admin", ADMIN_ROUTE_ROOT];
}
