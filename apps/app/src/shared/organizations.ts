import { apiRoutes } from "@/lib/api-config";
import {
  gatewayJSON,
  requireGatewayData,
  unwrapGatewayPayload,
} from "@/shared/api/gateway";
import { attachStableSlugs, findBySlugIdOrPublicId } from "@/shared/public-slugs";

type JsonRecord = Record<string, unknown>;

export type UserOrganizationSummary = {
  id: string;
  publicId: string;
  internalId?: string;
  name: string;
  slug: string;
  role: string;
};

export type UserOrganizationMembership = {
  organizationId: string;
  internalId: string;
  publicId: string;
  role: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function getArray(value: unknown): unknown[] {
  const payload = unwrapGatewayPayload(value);
  return Array.isArray(payload) ? payload : [];
}

function getIDString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOrganizationRole(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (normalized === "editor" || normalized === "admin" || normalized === "owner") return "editor";
  if (normalized === "super_admin") return "super_admin";
  return "viewer";
}

function normalizeMembership(
  value: unknown,
): UserOrganizationMembership | null {
  if (!isRecord(value)) return null;
  const organizationId = getIDString(
    value.organizationId ?? value.OrganizationID ?? value.organization_id ?? value.id ?? value.ID,
  );
  if (!organizationId) return null;
  const internalId = getIDString(value.internalId ?? value.InternalID);
  const publicId = getString(value.publicId ?? value.PublicID) || organizationId;
  return {
    organizationId,
    internalId,
    publicId,
    role: normalizeOrganizationRole(getString(value.role ?? value.Role)),
  };
}

function normalizeOrganization(
  value: unknown,
  fallback: UserOrganizationMembership,
): Omit<UserOrganizationSummary, "slug"> {
  const payload = unwrapGatewayPayload(value);
  const record = isRecord(payload) ? (payload as JsonRecord) : {};
  return {
    id: getIDString(record.id ?? record.ID) || fallback.internalId || fallback.organizationId,
    publicId:
      getString(record.publicId ?? record.PublicID) || fallback.publicId || fallback.organizationId,
    internalId:
      getIDString(record.id ?? record.ID) || fallback.internalId || fallback.organizationId,
    name: getString(record.name ?? record.Name) || `Organisation ${fallback.organizationId}`,
    role: fallback.role,
  };
}

export function isNumericOrganizationId(value: string | null | undefined): boolean {
  const normalized = value?.trim() ?? "";
  return /^[1-9]\d*$/.test(normalized);
}

export function resolveNumericOrganizationIdFromMemberships(
  memberships: UserOrganizationMembership[],
  organizationToken: string | null | undefined,
): string {
  const normalized = organizationToken?.trim() ?? "";
  if (!normalized) return "";
  if (isNumericOrganizationId(normalized)) return normalized;

  return (
    memberships.find(
      (membership) =>
        membership.organizationId === normalized ||
        membership.internalId === normalized ||
        membership.publicId === normalized,
    )?.organizationId ?? ""
  );
}

export function resolveNumericOrganizationIdFromSummaries(
  organizations: UserOrganizationSummary[],
  organizationToken: string | null | undefined,
): string {
  const normalized = organizationToken?.trim() ?? "";
  if (!normalized) return "";
  if (isNumericOrganizationId(normalized)) return normalized;
  return findBySlugIdOrPublicId(organizations, normalized)?.id ?? "";
}

export async function loadUserOrganizationMemberships(
  apiBaseURL: string,
  signal?: AbortSignal,
  options: { adminScope?: boolean } = {},
): Promise<UserOrganizationMembership[]> {
  const path = options.adminScope
    ? `${apiRoutes.organizations.me()}?scope=admin`
    : apiRoutes.organizations.me();
  const membershipsPayload = await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, path, {
      method: "GET",
      signal,
    }),
    "Impossible de charger les organisations.",
  );

  const memberships = getArray(membershipsPayload)
    .map(normalizeMembership)
    .filter((membership): membership is NonNullable<typeof membership> => membership !== null);

  return memberships;
}

export async function loadUserOrganizationSummaries(
  apiBaseURL: string,
  signal?: AbortSignal,
  options: { adminScope?: boolean } = {},
): Promise<UserOrganizationSummary[]> {
  const memberships = await loadUserOrganizationMemberships(apiBaseURL, signal, options);

  const organizations = await Promise.all(
    memberships.map(async (membership) => {
      const response = await gatewayJSON<unknown>(
        apiBaseURL,
        apiRoutes.organizations.get(membership.organizationId),
        {
          method: "GET",
          organizationId: membership.organizationId,
          signal,
        },
      );

      return normalizeOrganization(response.ok ? response.data : null, membership);
    }),
  );

  return attachStableSlugs(
    [...organizations].sort((left, right) => left.name.localeCompare(right.name, "fr")),
    "organization",
  );
}
