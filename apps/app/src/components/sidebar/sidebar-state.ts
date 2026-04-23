import type { OrganizationHierarchy, OrganizationProjectSummary } from "@/shared/models";

type SelectPreferredIDOptions = {
  candidates: Array<string | null | undefined>;
  availableIds: Iterable<string>;
  fallback?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeID(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function getField<T = unknown>(value: Record<string, unknown>, keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in value) {
      return value[key] as T;
    }
  }
  return undefined;
}

function unwrapPayload(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.success === true && "data" in value) {
    return value.data;
  }
  return value;
}

function normalizeProject(value: unknown): OrganizationProjectSummary | null {
  if (!isRecord(value)) return null;

  const id = normalizeID(getField(value, ["id", "ID"]));
  if (id === "") return null;

  return {
    id,
    organizationId: normalizeID(getField(value, ["organizationId", "OrganizationID"])),
    name: normalizeString(getField(value, ["name", "Name"])) || "Project",
    status: normalizeString(getField(value, ["status", "Status"])) || "draft",
    brandName: normalizeString(getField(value, ["brandName", "BrandName"])),
    brandDescription: normalizeString(getField(value, ["brandDescription", "BrandDescription"])),
    attributionSource: normalizeString(getField(value, ["attributionSource", "AttributionSource"])),
    createdAt: normalizeString(getField(value, ["createdAt", "CreatedAt"])),
  };
}

export function normalizeOrganizationHierarchy(
  value: unknown,
  fallbackOrganizationId = "",
  fallbackOrganizationName = "",
): OrganizationHierarchy | null {
  const payload = unwrapPayload(value);
  if (!isRecord(payload)) return null;

  const organizationValue = getField(payload, ["organization", "Organization"]);
  const organizationRecord = isRecord(organizationValue) ? organizationValue : {};
  const projectsValue = getField(payload, ["projects", "Projects"]);

  const projects = Array.isArray(projectsValue)
    ? projectsValue
      .map((project) => normalizeProject(project))
      .filter((project): project is OrganizationProjectSummary => project !== null)
    : [];

  const organizationID = normalizeID(getField(organizationRecord, ["id", "ID"])) || fallbackOrganizationId;
  const organizationName =
    normalizeString(getField(organizationRecord, ["name", "Name"])) || fallbackOrganizationName || "Organization";

  if (organizationID === "" && projects.length === 0) {
    return null;
  }

  return {
    organization: {
      id: organizationID,
      name: organizationName,
      ownerIdentityId: normalizeID(getField(organizationRecord, ["ownerIdentityId", "OwnerIdentityID"])),
      createdAt: normalizeString(getField(organizationRecord, ["createdAt", "CreatedAt"])),
      deletedAt: normalizeString(getField(organizationRecord, ["deletedAt", "DeletedAt"])) || null,
    },
    projects,
  };
}

export function selectPreferredID({ candidates, availableIds, fallback = "" }: SelectPreferredIDOptions): string {
  const available = new Set(Array.from(availableIds, (id) => normalizeString(id)).filter((id) => id !== ""));
  for (const candidate of candidates) {
    const normalized = normalizeString(candidate);
    if (normalized !== "" && available.has(normalized)) {
      return normalized;
    }
  }

  const normalizedFallback = normalizeString(fallback);
  if (normalizedFallback !== "" && available.has(normalizedFallback)) {
    return normalizedFallback;
  }

  return "";
}
