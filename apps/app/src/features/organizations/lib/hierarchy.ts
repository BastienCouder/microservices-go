import type { OrganizationHierarchy, OrganizationProjectSummary } from "@/shared/models";

export type OrganizationBrandGroup = {
  key: string;
  name: string;
  description: string;
  isUnassigned: boolean;
  projects: OrganizationProjectSummary[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getIDString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function normalizeProject(value: unknown): OrganizationProjectSummary | null {
  if (!isRecord(value)) return null;

  const id = getIDString(getField(value, ["id", "ID"]));
  if (id === "") return null;

  return {
    id,
    organizationId: getIDString(getField(value, ["organizationId", "OrganizationID"])),
    name: getString(getField(value, ["name", "Name"])) || "Project",
    status: getString(getField(value, ["status", "Status"])) || "draft",
    brandName: getString(getField(value, ["brandName", "BrandName"])),
    brandDescription: getString(getField(value, ["brandDescription", "BrandDescription"])),
    attributionSource: getString(getField(value, ["attributionSource", "AttributionSource"])),
    createdAt: getString(getField(value, ["createdAt", "CreatedAt"])),
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

  const id = getIDString(getField(organizationRecord, ["id", "ID"])) || fallbackOrganizationId;
  const name = getString(getField(organizationRecord, ["name", "Name"])) || fallbackOrganizationName || "Organization";
  if (id === "" && projects.length === 0) {
    return null;
  }

  return {
    organization: {
      id,
      name,
      ownerIdentityId: getIDString(getField(organizationRecord, ["ownerIdentityId", "OwnerIdentityID"])),
      createdAt: getString(getField(organizationRecord, ["createdAt", "CreatedAt"])),
      deletedAt: getString(getField(organizationRecord, ["deletedAt", "DeletedAt"])) || null,
    },
    projects,
  };
}

function getBrandKey(project: OrganizationProjectSummary): string {
  return project.brandName.trim().toLowerCase();
}

export function countHierarchyBrands(projects: OrganizationProjectSummary[]): number {
  const keys = new Set(
    projects
      .map((project) => getBrandKey(project))
      .filter((value) => value !== ""),
  );
  return keys.size;
}

export function groupProjectsByBrand(projects: OrganizationProjectSummary[]): OrganizationBrandGroup[] {
  const groups = new Map<string, OrganizationBrandGroup>();

  for (const project of projects) {
    const brandKey = getBrandKey(project);
    const key = brandKey || "__unassigned__";
    const existing = groups.get(key);

    if (existing) {
      if (existing.description === "" && project.brandDescription.trim() !== "") {
        existing.description = project.brandDescription.trim();
      }
      existing.projects.push(project);
      continue;
    }

    groups.set(key, {
      key,
      name: project.brandName.trim() || "No brand",
      description: project.brandDescription.trim(),
      isUnassigned: brandKey === "",
      projects: [project],
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      projects: [...group.projects].sort((left, right) => left.name.localeCompare(right.name, "en")),
    }))
    .sort((left, right) => {
      if (left.isUnassigned !== right.isUnassigned) {
        return left.isUnassigned ? 1 : -1;
      }
      return left.name.localeCompare(right.name, "en");
    });
}
