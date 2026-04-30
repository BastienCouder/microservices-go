import { attachStableSlugs } from "@/shared/public-slugs";
import type {
  OrganizationAPIKey,
  OrganizationInvitation,
  OrganizationMember,
  OrganizationProject,
  OrganizationProjectMember,
  OrganizationResources,
  OrganizationRole,
  OrganizationSummary,
} from "./types";

type Membership = {
  organizationId: string;
  role: OrganizationRole;
};

type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

export function unwrapData(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.success === true && "data" in value) return value.data;
  return value;
}

export function getField(value: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (key in value) return value[key];
  }
  return undefined;
}

export function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getIDString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getRole(value: unknown): OrganizationRole {
  const normalized = getString(value).toLowerCase();
  if (
    normalized === "owner" ||
    normalized === "admin" ||
    normalized === "super_admin"
  ) {
    return normalized;
  }
  return "member";
}

export function normalizeMembership(value: unknown): Membership | null {
  if (!isRecord(value)) return null;
  const organizationId = getIDString(getField(value, ["organizationId", "OrganizationID", "id", "ID"]));
  if (!organizationId) return null;

  return {
    organizationId,
    role: getRole(getField(value, ["role", "Role"])),
  };
}

export function normalizeOrganization(value: unknown, fallback: Membership): OrganizationSummary {
  const payload = unwrapData(value);
  const record = isRecord(payload) ? payload : {};

  return {
    id: getIDString(getField(record, ["id", "ID"])) || fallback.organizationId,
    slug: "",
    name: getString(getField(record, ["name", "Name"])) || `Organisation ${fallback.organizationId}`,
    role: fallback.role,
  };
}

export function normalizeProject(value: unknown): OrganizationProject | null {
  if (!isRecord(value)) return null;
  const id = getIDString(getField(value, ["id", "ID"]));
  if (!id) return null;

  return {
    id,
    slug: "",
    organizationId: getIDString(getField(value, ["organizationId", "OrganizationID"])),
    name: getString(getField(value, ["name", "Name"])) || "Project",
    brandName: getString(getField(value, ["brandName", "BrandName"])),
    brandDescription: getString(getField(value, ["brandDescription", "BrandDescription"])),
    attributionSource: getString(getField(value, ["attributionSource", "AttributionSource"])),
    createdAt: getString(getField(value, ["createdAt", "CreatedAt"])),
  };
}

export function normalizeMember(value: unknown): OrganizationMember | null {
  if (!isRecord(value)) return null;
  const userId = getIDString(getField(value, ["userId", "UserID"]));
  const organizationId = getIDString(getField(value, ["organizationId", "OrganizationID"]));
  if (!userId || !organizationId) return null;

  return {
    organizationId,
    userId,
    email: getString(getField(value, ["email", "Email"])),
    firstName: getString(getField(value, ["firstName", "FirstName", "first_name"])),
    lastName: getString(getField(value, ["lastName", "LastName", "last_name"])),
    roles: getArray(getField(value, ["roles", "Roles"])).map(getString).filter(Boolean),
    addedAt: getString(getField(value, ["addedAt", "AddedAt"])),
  };
}

export function normalizeProjectMember(value: unknown): OrganizationProjectMember | null {
  if (!isRecord(value)) return null;
  const projectId = getIDString(getField(value, ["projectId", "ProjectID"]));
  const userId = getIDString(getField(value, ["userId", "UserID"]));
  if (!projectId || !userId) return null;

  return {
    projectId,
    organizationId: getIDString(getField(value, ["organizationId", "OrganizationID"])),
    userId,
    role: getString(getField(value, ["role", "Role"])) || "viewer",
    addedAt: getString(getField(value, ["addedAt", "AddedAt"])),
  };
}

function normalizeInvitationStatus(value: unknown): OrganizationInvitation["status"] {
  const normalized = getString(value).toLowerCase();
  if (normalized === "accepted" || normalized === "refused" || normalized === "revoked") {
    return normalized;
  }
  return "pending";
}

export function normalizeInvitation(value: unknown): OrganizationInvitation | null {
  if (!isRecord(value)) return null;
  const id = getIDString(getField(value, ["id", "ID"]));
  if (!id) return null;

  return {
    id,
    organizationId: getIDString(getField(value, ["organizationId", "OrganizationID"])),
    projectId: getIDString(getField(value, ["projectId", "ProjectID"])),
    email: getString(getField(value, ["email", "Email"])),
    role: getString(getField(value, ["role", "Role"])) || "member",
    token: getString(getField(value, ["token", "Token"])),
    message: getString(getField(value, ["message", "Message"])),
    status: normalizeInvitationStatus(getField(value, ["status", "Status"])),
    invitedByUserId: getIDString(getField(value, ["invitedByUserId", "InvitedByUserID"])),
    acceptedByUserId: getIDString(getField(value, ["acceptedByUserId", "AcceptedByUserID"])),
    createdAt: getString(getField(value, ["createdAt", "CreatedAt"])),
    expiresAt: getString(getField(value, ["expiresAt", "ExpiresAt"])),
    respondedAt: getString(getField(value, ["respondedAt", "RespondedAt"])),
  };
}

export function normalizeAPIKey(value: unknown): OrganizationAPIKey | null {
  if (!isRecord(value)) return null;
  const id = getIDString(getField(value, ["id", "ID"]));
  if (!id) return null;

  return {
    id,
    organizationId: getIDString(getField(value, ["organizationId", "OrganizationID"])),
    name: getString(getField(value, ["name", "Name"])) || "API key",
    prefix: getString(getField(value, ["prefix", "Prefix"])),
    key: getString(getField(value, ["key", "Key"])),
    createdAt: getString(getField(value, ["createdAt", "CreatedAt"])),
    lastUsedAt: getString(getField(value, ["lastUsedAt", "LastUsedAt"])),
  };
}

export function normalizeHierarchyProjects(value: unknown): OrganizationProject[] {
  const payload = unwrapData(value);
  if (!isRecord(payload)) return [];
  return attachStableSlugs(
    getArray(getField(payload, ["projects", "Projects"]))
      .map(normalizeProject)
      .filter((project): project is OrganizationProject => project !== null)
      .sort((left, right) => left.name.localeCompare(right.name, "fr")),
    "project",
  );
}

export function normalizeResourcesMembers(value: unknown): OrganizationResources["members"] {
  return getArray(value)
    .map(normalizeMember)
    .filter((member): member is OrganizationMember => member !== null)
    .sort((left, right) => left.userId.localeCompare(right.userId, "fr"));
}
