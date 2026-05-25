import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON } from "@/shared/api/gateway";
import { attachStableSlugs, findBySlugOrId, slugifyPublicName } from "@/shared/public-slugs";
import type { UserOrganizationSummary } from "@/shared/organizations";

type JsonRecord = Record<string, unknown>;

type ProjectContextProject = {
  id: string;
  slug: string;
  organizationId: string;
  name: string;
};

type ProjectContextHierarchy = {
  organization: {
    id: string;
    slug: string;
    name: string;
  };
  projects: ProjectContextProject[];
};

export type ResolvedProjectContext = {
  organizationId: string;
  organizationSlug: string;
  projectId: string;
  projectSlug: string;
  projectName: string;
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

function getField(value: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (key in value) return value[key];
  }
  return undefined;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getIDString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function normalizeProject(value: unknown): Omit<ProjectContextProject, "slug"> | null {
  if (!isRecord(value)) return null;

  const id = getIDString(getField(value, ["id", "ID"]));
  if (!id) return null;

  return {
    id,
    organizationId: getIDString(getField(value, ["organizationId", "OrganizationID"])),
    name: getString(getField(value, ["name", "Name"])) || "Project",
  };
}

export function normalizeProjectContextHierarchy(
  value: unknown,
  fallbackOrganization: Pick<UserOrganizationSummary, "id" | "name" | "slug">,
): ProjectContextHierarchy | null {
  const payload = unwrapData(value);
  if (!isRecord(payload)) return null;

  const organizationValue = getField(payload, ["organization", "Organization"]);
  const organizationRecord = isRecord(organizationValue) ? organizationValue : {};
  const organizationId =
    getIDString(getField(organizationRecord, ["id", "ID"])) || fallbackOrganization.id;
  const organizationName =
    getString(getField(organizationRecord, ["name", "Name"])) ||
    fallbackOrganization.name ||
    `Organisation ${organizationId}`;
  const organizationSlug = fallbackOrganization.slug || slugifyPublicName(organizationName, "organization");

  const projectsValue = getField(payload, ["projects", "Projects"]);
  const projects = Array.isArray(projectsValue)
    ? attachStableSlugs(
        projectsValue
          .map(normalizeProject)
          .filter((project): project is Omit<ProjectContextProject, "slug"> => project !== null)
          .sort((left, right) => left.name.localeCompare(right.name, "fr")),
        "project",
      ).map((project) => ({
        ...project,
        organizationId: project.organizationId || organizationId,
      }))
    : [];

  if (!organizationId && projects.length === 0) return null;

  return {
    organization: {
      id: organizationId,
      slug: organizationSlug,
      name: organizationName,
    },
    projects,
  };
}

export async function loadProjectContextHierarchies(
  apiBaseURL: string,
  organizations: UserOrganizationSummary[],
  signal?: AbortSignal,
): Promise<ProjectContextHierarchy[]> {
  const hierarchies = await Promise.all(
    organizations.map(async (organization) => {
      const response = await gatewayJSON<unknown>(
        apiBaseURL,
        apiRoutes.organizations.hierarchy(organization.id),
        {
          method: "GET",
          organizationId: organization.id,
          signal,
        },
      );

      if (!response.ok) return null;
      return normalizeProjectContextHierarchy(response.data, organization);
    }),
  );

  return hierarchies.filter(
    (hierarchy): hierarchy is ProjectContextHierarchy => hierarchy !== null,
  );
}

export function findResolvedProjectContext(
  hierarchies: ProjectContextHierarchy[],
  projectToken: string,
): ResolvedProjectContext | null {
  const token = projectToken.trim();
  if (!token) return null;

  for (const hierarchy of hierarchies) {
    const project = findBySlugOrId(hierarchy.projects, token);
    if (!project) continue;

    return {
      organizationId: hierarchy.organization.id || project.organizationId,
      organizationSlug: hierarchy.organization.slug,
      projectId: project.id,
      projectSlug: project.slug,
      projectName: project.name,
    };
  }

  return null;
}

export function applyResolvedProjectContextSearch(
  routeSearch: string,
  context: ResolvedProjectContext | null,
): string {
  if (!context) return routeSearch;

  const params = new URLSearchParams(
    routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch,
  );
  params.set("project", context.projectSlug || context.projectId);
  params.delete("projectId");
  params.delete("project_id");
  params.set("organizationId", context.organizationId);
  params.delete("organization_id");

  const search = params.toString();
  return search ? `?${search}` : "";
}
