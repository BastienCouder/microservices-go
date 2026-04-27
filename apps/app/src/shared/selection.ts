export const SELECTED_ORG_KEY = "selected-organization-id";
export const SELECTED_PROJECT_KEY = "selected-project-id";

function readStoredValue(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key)?.trim() ?? "";
  } catch {
    return "";
  }
}

function storeValue(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = value.trim();
    if (normalized === "") {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, normalized);
  } catch {
    // Ignore storage errors in the browser shell.
  }
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
