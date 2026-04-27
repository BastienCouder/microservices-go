export function readProjectIdFromSearch(routeSearch: string): string {
  const params = new URLSearchParams(
    routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch,
  );

  return (
    params.get("projectId") ||
    params.get("project_id") ||
    params.get("project") ||
    ""
  ).trim();
}
