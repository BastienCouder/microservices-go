import { apiRoutes } from "@/lib/api-config";
import { apiFetch } from "@/lib/server-api";
import OrganizationsClient from "./organizations-client";

type OrganizationRole = "owner" | "admin" | "member";

type OrganizationSummary = {
  id: string;
  name: string;
  role: OrganizationRole;
  membersCount: number;
};

type MembershipSummary = {
  id?: string;
  organizationId?: string;
  role?: OrganizationRole;
};

export default async function OrganizationsPage() {
  const organizations = await loadOrganizationsServer();
  return <OrganizationsClient initialOrganizations={organizations} />;
}

async function loadOrganizationsServer(): Promise<OrganizationSummary[]> {
  try {
    const membershipsRaw = await apiFetch<unknown>(apiRoutes.organizations.me());
    const memberships = normalizeMemberships(membershipsRaw);
    if (memberships.length === 0) return [];

    const summaries = await Promise.all(
      memberships.map(async (membership) => {
        const organizationId = membership.organizationId ?? membership.id;
        if (!organizationId) return null;

        try {
          const organizationRaw = await apiFetch<unknown>(apiRoutes.organizations.get(organizationId));
          return normalizeOrganizationDetails(organizationRaw, organizationId, membership.role || "member");
        } catch {
          return null;
        }
      }),
    );

    return summaries.filter((item): item is OrganizationSummary => item !== null);
  } catch {
    return [];
  }
}

function normalizeMemberships(value: unknown): MembershipSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const props = isRecord(item.props) ? item.props : item;
      return {
        id: getString(props.id) ?? getString(item.id) ?? undefined,
        organizationId: getString(props.organizationId) ?? getString(item.organizationId) ?? undefined,
        role: normalizeRole(props.role ?? item.role) ?? undefined,
      };
    });
}

function normalizeOrganizationDetails(
  value: unknown,
  fallbackOrganizationId: string,
  fallbackRole: OrganizationRole,
): OrganizationSummary {
  const objectValue = isRecord(value) ? value : {};
  const organizationObject = isRecord(objectValue.organization) ? objectValue.organization : objectValue;
  const payload = isRecord(organizationObject.props) ? organizationObject.props : organizationObject;
  const membersValue = Array.isArray(objectValue.members)
    ? objectValue.members
    : Array.isArray(payload.members)
      ? payload.members
      : [];
  const currentUserMemberObject = isRecord(objectValue.currentUserMember)
    ? objectValue.currentUserMember
    : isRecord(payload.currentUserMember)
      ? payload.currentUserMember
      : {};
  const currentUserMember = isRecord(currentUserMemberObject.props)
    ? currentUserMemberObject.props
    : currentUserMemberObject;

  return {
    id: getString(payload.id) || fallbackOrganizationId,
    name: getString(payload.name) || "Organization",
    role: normalizeRole(currentUserMember.role) || fallbackRole,
    membersCount: membersValue.length,
  };
}

function normalizeRole(value: unknown): OrganizationRole | null {
  const roleValue = typeof value === "string"
    ? value
    : isRecord(value) && typeof value.value === "string"
      ? value.value
      : "";

  if (roleValue === "owner" || roleValue === "admin" || roleValue === "member") {
    return roleValue;
  }
  return null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
