import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON, type GatewayResult } from "@/shared/api/gateway";
import { attachStableSlugs } from "@/shared/public-slugs";

type JsonRecord = Record<string, unknown>;

export type UserOrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function unwrapData(value: unknown): unknown {
  if (isRecord(value) && value.success === true && "data" in value) {
    return value.data;
  }
  return value;
}

function getArray(value: unknown): unknown[] {
  const payload = unwrapData(value);
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

async function requireGatewayData<T>(
  promise: Promise<GatewayResult<T>>,
  message: string,
): Promise<T> {
  const response = await promise;
  if (!response.ok) {
    throw new Error(response.error || message);
  }
  return response.data;
}

function normalizeMembership(value: unknown): { organizationId: string; role: string } | null {
  if (!isRecord(value)) return null;
  const organizationId = getIDString(
    value.organizationId ?? value.OrganizationID ?? value.organization_id ?? value.id ?? value.ID,
  );
  if (!organizationId) return null;
  return {
    organizationId,
    role: getString(value.role ?? value.Role) || "member",
  };
}

function normalizeOrganization(
  value: unknown,
  fallback: { organizationId: string; role: string },
): Omit<UserOrganizationSummary, "slug"> {
  const record = isRecord(unwrapData(value)) ? (unwrapData(value) as JsonRecord) : {};
  return {
    id: getIDString(record.id ?? record.ID) || fallback.organizationId,
    name: getString(record.name ?? record.Name) || `Organisation ${fallback.organizationId}`,
    role: fallback.role,
  };
}

export async function loadUserOrganizationSummaries(
  apiBaseURL: string,
  signal?: AbortSignal,
): Promise<UserOrganizationSummary[]> {
  const membershipsPayload = await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.me(), {
      method: "GET",
      signal,
    }),
    "Impossible de charger les organisations.",
  );

  const memberships = getArray(membershipsPayload)
    .map(normalizeMembership)
    .filter((membership): membership is NonNullable<typeof membership> => membership !== null);

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
