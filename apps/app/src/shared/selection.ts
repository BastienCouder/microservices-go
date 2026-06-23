export const SELECTED_ORG_KEY = "selected-organization-id";
export const SELECTED_ORG_PUBLIC_KEY = "selected-organization-public-id";
export const SELECTED_PROJECT_KEY = "selected-project-id";
export const SELECTED_CONTEXT_CHANGE_EVENT = "app:selected-context-change";
export const ROUTE_ORGANIZATION_PARAM = "org";
export const ROUTE_PROJECT_PARAM = "project";
const LEGACY_SELECTED_ORG_INTERNAL_KEY = "selected-organization-internal-id";
const LEGACY_LAST_SELECTED_PROJECT_TOKEN_KEY = "last-selected-project-token";
const LEGACY_ROUTE_ORGANIZATION_PARAMS = ["organizationId", "organization_id"] as const;
const LEGACY_ROUTE_PROJECT_PARAMS = ["projectId", "project_id"] as const;

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
  return readStoredValue(SELECTED_ORG_PUBLIC_KEY) || readSelectedOrganizationID();
}

export function storeSelectedOrganizationID(value: string): void {
  let changed = false;
  changed = writeStoredValue(SELECTED_ORG_KEY, value) || changed;
  changed = writeStoredValue(SELECTED_ORG_PUBLIC_KEY, "") || changed;
  changed = writeStoredValue(LEGACY_SELECTED_ORG_INTERNAL_KEY, "") || changed;

  if (changed) {
    dispatchSelectedContextChange("selected-organization-context", value.trim());
  }
}

export function storeSelectedOrganizationContext({
  organizationId,
  publicId,
}: {
  organizationId: string;
  publicId?: string;
}): void {
  const publicOrganizationId = publicId?.trim() || organizationId;
  let changed = false;
  changed = writeStoredValue(SELECTED_ORG_KEY, organizationId) || changed;
  changed = writeStoredValue(SELECTED_ORG_PUBLIC_KEY, publicOrganizationId) || changed;
  changed = writeStoredValue(LEGACY_SELECTED_ORG_INTERNAL_KEY, "") || changed;

  if (changed) {
    dispatchSelectedContextChange("selected-organization-context", publicOrganizationId.trim());
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
  const projectToken = readRouteQueryParam(routeSearch, ROUTE_PROJECT_PARAM);
  return (
    readRouteQueryParam(routeSearch, LEGACY_ROUTE_PROJECT_PARAMS[0]) ||
    readRouteQueryParam(routeSearch, LEGACY_ROUTE_PROJECT_PARAMS[1]) ||
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
  organizationPublicId,
  projectId,
}: {
  organizationId?: string;
  organizationPublicId?: string;
  projectId: string;
}): void {
  let changed = false;
  if (organizationId !== undefined) {
    changed = writeStoredValue(SELECTED_ORG_KEY, organizationId) || changed;
    if (organizationPublicId !== undefined) {
      changed = writeStoredValue(SELECTED_ORG_PUBLIC_KEY, organizationPublicId) || changed;
    }
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
  changed = writeStoredValue(SELECTED_ORG_PUBLIC_KEY, "") || changed;
  changed = writeStoredValue(LEGACY_SELECTED_ORG_INTERNAL_KEY, "") || changed;
  changed = writeStoredValue(SELECTED_PROJECT_KEY, "") || changed;
  changed = writeStoredValue(LEGACY_LAST_SELECTED_PROJECT_TOKEN_KEY, "") || changed;

  if (changed) {
    dispatchSelectedContextChange("selected-project-context", "");
  }
}

export function readProjectIdFromSearch(routeSearch: string): string {
  const projectToken = readRouteQueryParam(routeSearch, ROUTE_PROJECT_PARAM);
  return (
    readRouteQueryParam(routeSearch, LEGACY_ROUTE_PROJECT_PARAMS[0]) ||
    readRouteQueryParam(routeSearch, LEGACY_ROUTE_PROJECT_PARAMS[1]) ||
    (projectToken.startsWith("prj_") || projectToken.startsWith("prj-")
      ? projectToken
      : "")
  ).trim();
}

export function readOrganizationIdFromSearch(routeSearch: string): string {
  return (
    readRouteQueryParam(routeSearch, ROUTE_ORGANIZATION_PARAM) ||
    readRouteQueryParam(routeSearch, LEGACY_ROUTE_ORGANIZATION_PARAMS[0]) ||
    readRouteQueryParam(routeSearch, LEGACY_ROUTE_ORGANIZATION_PARAMS[1])
  ).trim();
}

function clearRouteProjectParams(params: URLSearchParams): void {
  params.delete(ROUTE_PROJECT_PARAM);
  for (const key of LEGACY_ROUTE_PROJECT_PARAMS) {
    params.delete(key);
  }
}

function clearRouteOrganizationParams(params: URLSearchParams): void {
  params.delete(ROUTE_ORGANIZATION_PARAM);
  for (const key of LEGACY_ROUTE_ORGANIZATION_PARAMS) {
    params.delete(key);
  }
}

export function resolveSelectedContextSearch(routeSearch: string): string {
  const routeProjectId = readProjectIdFromSearch(routeSearch);
  const routeProjectAlias = readRouteQueryParam(routeSearch, ROUTE_PROJECT_PARAM);
  const selectedStoredProjectId = readSelectedProjectID();

  if (
    !routeProjectId &&
    !selectedStoredProjectId
  ) {
    return routeSearch;
  }

  const params = new URLSearchParams(
    routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch,
  );

  if (!routeProjectAlias && !routeProjectId && selectedStoredProjectId) {
    clearRouteProjectParams(params);
    params.set(ROUTE_PROJECT_PARAM, selectedStoredProjectId);
  }

  const search = params.toString();
  return search ? `?${search}` : "";
}

export function keepProjectOnlyContextSearch(routeSearch: string): string {
  const params = new URLSearchParams(
    routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch,
  );
  clearRouteProjectParams(params);
  clearRouteOrganizationParams(params);

  const search = params.toString();
  return search ? `?${search}` : "";
}

export function clearProjectContextSearch(routeSearch: string): string {
  const params = new URLSearchParams(
    routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch,
  );
  clearRouteProjectParams(params);
  clearRouteOrganizationParams(params);

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
    const writesProjectScope =
      key === ROUTE_PROJECT_PARAM || key === "projectId" || key === "project_id";
    const writesOrganizationScope =
      key === ROUTE_ORGANIZATION_PARAM ||
      key === "organizationId" ||
      key === "organization_id";

    if (writesProjectScope) {
      clearRouteProjectParams(params);
    }
    if (writesOrganizationScope) {
      clearRouteOrganizationParams(params);
      continue;
    }
    const normalized = value?.trim() ?? "";
    if (normalized === "") {
      params.delete(key);
      continue;
    }
    params.set(
      writesProjectScope
        ? ROUTE_PROJECT_PARAM
        : writesOrganizationScope
          ? ROUTE_ORGANIZATION_PARAM
          : key,
      normalized,
    );
  }

  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}
