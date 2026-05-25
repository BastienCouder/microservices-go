export const SELECTED_ORG_KEY = "selected-organization-id";
export const SELECTED_PROJECT_KEY = "selected-project-id";
export const LAST_SELECTED_PROJECT_TOKEN_KEY = "last-selected-project-token";
export const SELECTED_CONTEXT_CHANGE_EVENT = "app:selected-context-change";

function readStoredValue(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key)?.trim() ?? "";
  } catch {
    return "";
  }
}

function writeStoredValue(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const normalized = value.trim();
    if (normalized === "") {
      if (window.localStorage.getItem(key) === null) {
        return false;
      }
      window.localStorage.removeItem(key);
      return true;
    }
    if (window.localStorage.getItem(key)?.trim() === normalized) {
      return false;
    }
    window.localStorage.setItem(key, normalized);
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
  return readStoredValue(SELECTED_ORG_KEY);
}

export function storeSelectedOrganizationID(value: string): void {
  storeValue(SELECTED_ORG_KEY, value);
}

export function readSelectedProjectID(): string {
  return readStoredValue(SELECTED_PROJECT_KEY);
}

export function storeSelectedProjectID(value: string): void {
  storeValue(SELECTED_PROJECT_KEY, value);
}

export function readLastSelectedProjectToken(): string {
  return readStoredValue(LAST_SELECTED_PROJECT_TOKEN_KEY);
}

export function storeLastSelectedProjectToken(value: string): void {
  storeValue(LAST_SELECTED_PROJECT_TOKEN_KEY, value);
}

export function readSelectedProjectToken(): string {
  return readLastSelectedProjectToken() || readSelectedProjectID();
}

export function storeSelectedProjectContext({
  organizationId,
  projectId,
  projectToken,
}: {
  organizationId?: string;
  projectId: string;
  projectToken?: string;
}): void {
  let changed = false;
  if (organizationId !== undefined) {
    changed = writeStoredValue(SELECTED_ORG_KEY, organizationId) || changed;
  }
  const token = projectToken || projectId;
  changed = writeStoredValue(LAST_SELECTED_PROJECT_TOKEN_KEY, token) || changed;
  changed = writeStoredValue(SELECTED_PROJECT_KEY, projectId) || changed;

  if (changed) {
    dispatchSelectedContextChange("selected-project-context", token.trim());
  }
}

export function readProjectIdFromSearch(routeSearch: string): string {
  return (
    readRouteQueryParam(routeSearch, "projectId") ||
    readRouteQueryParam(routeSearch, "project_id") ||
    readRouteQueryParam(routeSearch, "project")
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
  const selectedProjectId = readSelectedProjectToken();
  const selectedOrganizationId = readSelectedOrganizationID();

  if (!routeProjectId && !selectedProjectId && !selectedOrganizationId) {
    return routeSearch;
  }

  const params = new URLSearchParams(
    routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch,
  );

  if (!routeProjectId && selectedProjectId) {
    params.set("project", selectedProjectId);
  }

  if (
    selectedOrganizationId &&
    !routeProjectId &&
    !readOrganizationIdFromSearch(routeSearch)
  ) {
    params.set("organizationId", selectedOrganizationId);
  }

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
    if (key === "project") {
      params.delete("projectId");
      params.delete("project_id");
    }
    if (key === "org") {
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
