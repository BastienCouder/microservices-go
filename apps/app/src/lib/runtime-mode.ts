export type RuntimeMode = "live" | "demo";

export function resolveRuntimeMode(routeSearch: string): RuntimeMode {
  const normalized = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
  const params = new URLSearchParams(normalized);
  const mode = (params.get("mode") || "").trim().toLowerCase();
  return mode === "demo" ? "demo" : "live";
}
