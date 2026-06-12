export const SELECTED_ORG_KEY = "selected-organization-id";
export const SELECTED_PROJECT_KEY = "selected-project-id";
export const SELECTED_CONTEXT_CHANGE_EVENT = "app:selected-context-change";
const LEGACY_SELECTED_ORG_INTERNAL_KEY = "selected-organization-internal-id";
const LEGACY_LAST_SELECTED_PROJECT_TOKEN_KEY = "last-selected-project-token";

function getStorage(): Storage | null {
  if (typeof window !== "undefined") {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return globalThis.localStorage ?? null;
  }
  return null;
}

function readStoredValue(key: string): string {
  const storage = getStorage();
  if (!storage) return "";
  try {
    return storage.getItem(key)?.trim() ?? "";
  } catch {
    return "";
  }
}

function writeStoredValue(key: string, value: string): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    const normalized = value.trim();
    if (normalized === "") {
      if (storage.getItem(key) === null) {
        return false;
      }
      storage.removeItem(key);
      return true;
    }
    if (storage.getItem(key)?.trim() === normalized) {
      return false;
    }
    storage.setItem(key, normalized);
    return true;
  } catch {
    return false;
  }
}

function storeValue(key: string, value: string): void {
  const changed = writeStoredValue(key, value);
  if (changed) {
    dispatchSelectedContextChange(key, value.trim());
  }
}

function dispatchSelectedContextChange(key: string, value: string): void {
  if (typeof window === "undefined") return;

  const event =
    typeof CustomEvent === "function"
      ? new CustomEvent(SELECTED_CONTEXT_CHANGE_EVENT, {
          detail: { key, value },
        })
      : new Event(SELECTED_CONTEXT_CHANGE_EVENT);

  window.dispatchEvent(event);
}

export function readRouteQueryParam(routeSearch: string, key: string): string {
  const normalized = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
  const params = new URLSearchParams(normalized);
  return params.get(key)?.trim() ?? "";
}

export function readSelectedOrganizationID(): string {
  return readStoredValue(SELECTED_ORG_KEY) || readStoredValue(LEGACY_SELECTED_ORG_INTERNAL_KEY);
}

export function readSelectedOrganizationPublicID(): string {
  return readSelectedOrganizationID();
}

export function storeSelectedOrganizationID(value: string): void {
  let changed = false;
  changed = writeStoredValue(SELECTED_ORG_KEY, value) || changed;
  changed = writeStoredValue(LEGACY_SELECTED_ORG_INTERNAL_KEY, "") || changed;

  if (changed) {
    dispatchSelectedContextChange("selected-organization-context", value.trim());
  }
}

export function storeSelectedOrganizationContext({
  organizationId,
  publicId: _publicId,
}: {
  organizationId: string;
  publicId?: string;
}): void {
  let changed = false;
  changed = writeStoredValue(SELECTED_ORG_KEY, organizationId) || changed;
  changed = writeStoredValue(LEGACY_SELECTED_ORG_INTERNAL_KEY, "") || changed;

  if (changed) {
    dispatchSelectedContextChange("selected-organization-context", organizationId.trim());
  }
}

export function readSelectedProjectID(): string {
  return readStoredValue(SELECTED_PROJECT_KEY);
}

export function storeSelectedProjectID(value: string): void {
  let changed = false;
  changed = writeStoredValue(SELECTED_PROJECT_KEY, value) || changed;
  changed = writeStoredValue(LEGACY_LAST_SELECTED_PROJECT_TOKEN_KEY, "") || changed;

  if (changed) {
    dispatchSelectedContextChange("selected-project-context", value.trim());
  }
}

export function readProjectTokenFromSearch(routeSearch: string): string {
  const projectToken = readRouteQueryParam(routeSearch, "project");
  return (
    readRouteQueryParam(routeSearch, "projectId") ||
    readRouteQueryParam(routeSearch, "project_id") ||
    projectToken
  ).trim();
}

export function readOptionalProjectTokenFromSearch(
  routeSearch: string,
): string | null {
  const projectToken = readProjectTokenFromSearch(routeSearch);
  return projectToken === "" ? null : projectToken;
}

export function storeSelectedProjectContext({
  organizationId,
  projectId,
}: {
  organizationId?: string;
  projectId: string;
}): void {
  let changed = false;
  if (organizationId !== undefined) {
    changed = writeStoredValue(SELECTED_ORG_KEY, organizationId) || changed;
    changed = writeStoredValue(LEGACY_SELECTED_ORG_INTERNAL_KEY, "") || changed;
  }
  changed = writeStoredValue(SELECTED_PROJECT_KEY, projectId) || changed;
  changed = writeStoredValue(LEGACY_LAST_SELECTED_PROJECT_TOKEN_KEY, "") || changed;

  if (changed) {
    dispatchSelectedContextChange("selected-project-context", projectId.trim());
  }
}

export function clearSelectedProjectContext(): void {
  let changed = false;
  changed = writeStoredValue(SELECTED_PROJECT_KEY, "") || changed;
  changed = writeStoredValue(LEGACY_LAST_SELECTED_PROJECT_TOKEN_KEY, "") || changed;

  if (changed) {
    dispatchSelectedContextChange("selected-project-context", "");
  }
}

export function clearSelectedContext(): void {
  let changed = false;
  changed = writeStoredValue(SELECTED_ORG_KEY, "") || changed;
  changed = writeStoredValue(LEGACY_SELECTED_ORG_INTERNAL_KEY, "") || changed;
  changed = writeStoredValue(SELECTED_PROJECT_KEY, "") || changed;
  changed = writeStoredValue(LEGACY_LAST_SELECTED_PROJECT_TOKEN_KEY, "") || changed;

  if (changed) {
    dispatchSelectedContextChange("selected-project-context", "");
  }
}

export function readProjectIdFromSearch(routeSearch: string): string {
  const projectToken = readRouteQueryParam(routeSearch, "project");
  return (
    readRouteQueryParam(routeSearch, "projectId") ||
    readRouteQueryParam(routeSearch, "project_id") ||
    (projectToken.startsWith("prj_") || projectToken.startsWith("prj-")
      ? projectToken
      : "")
  ).trim();
}

export function readOrganizationIdFromSearch(routeSearch: string): string {
  return (
    readRouteQueryParam(routeSearch, "organizationId") ||
    readRouteQueryParam(routeSearch, "organization_id") ||
    readRouteQueryParam(routeSearch, "org")
  ).trim();
}

export function resolveSelectedContextSearch(routeSearch: string): string {
  const routeProjectId = readProjectIdFromSearch(routeSearch);
  const routeProjectAlias = readRouteQueryParam(routeSearch, "project");
  const routeOrganizationId = readOrganizationIdFromSearch(routeSearch);
  const selectedStoredProjectId = readSelectedProjectID();
  const selectedOrganizationId = readSelectedOrganizationPublicID();

  if (
    !routeProjectId &&
    !selectedStoredProjectId &&
    !selectedOrganizationId
  ) {
    return routeSearch;
  }

  const params = new URLSearchParams(
    routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch,
  );

  if (!routeProjectAlias && !routeProjectId && selectedStoredProjectId) {
    params.set("projectId", selectedStoredProjectId);
  }

  if (
    selectedOrganizationId &&
    !routeOrganizationId &&
    !routeProjectAlias &&
    (
      !routeProjectId ||
      routeProjectId === selectedStoredProjectId
    )
  ) {
    params.set("organizationId", selectedOrganizationId);
  }

  const search = params.toString();
  return search ? `?${search}` : "";
}

export function keepProjectOnlyContextSearch(routeSearch: string): string {
  const params = new URLSearchParams(
    routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch,
  );
  params.delete("projectId");
  params.delete("project_id");
  params.delete("org");
  params.delete("organizationId");
  params.delete("organization_id");

  const search = params.toString();
  return search ? `?${search}` : "";
}

export function clearProjectContextSearch(routeSearch: string): string {
  const params = new URLSearchParams(
    routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch,
  );
  params.delete("project");
  params.delete("projectId");
  params.delete("project_id");
  params.delete("org");
  params.delete("organizationId");
  params.delete("organization_id");

  const search = params.toString();
  return search ? `?${search}` : "";
}

export function buildScopedHref(
  path: string,
  updates: Record<string, string | null | undefined>,
): string {
  const [pathname, rawSearch = ""] = path.split("?", 2);
  const params = new URLSearchParams(rawSearch);

  for (const [key, value] of Object.entries(updates)) {
    if (key === "project" || key === "projectId" || key === "project_id") {
      params.delete("projectId");
      params.delete("project_id");
      params.delete("project");
    }
    if (
      key === "org" ||
      key === "organizationId" ||
      key === "organization_id"
    ) {
      params.delete("org");
      params.delete("organizationId");
      params.delete("organization_id");
    }
    const normalized = value?.trim() ?? "";
    if (normalized === "") {
      params.delete(key);
      continue;
    }
    params.set(key, normalized);
  }

  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}
