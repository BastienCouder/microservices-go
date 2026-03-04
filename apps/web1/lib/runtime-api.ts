import { API_CONFIG } from "@/lib/api-config";
import { resolveRuntimeContext, type RuntimeMode } from "@/lib/runtime-mode";

type QueryValue = string | number | boolean | null | undefined;

interface RuntimePathOptions {
  projectPath: (projectId: string) => string;
  demoPath: string;
  mode?: RuntimeMode;
  demo?: boolean;
  projectId?: string;
}

interface RuntimeFetchOptions extends RuntimePathOptions {
  query?: Record<string, QueryValue>;
  init?: RequestInit;
}

interface RuntimeResolvedPath {
  mode: RuntimeMode;
  projectId: string | null;
  path: string;
}

const SELECTED_ORG_KEY = "selected-organization-id";

export function resolveRuntimePath(options: RuntimePathOptions): RuntimeResolvedPath {
  const runtime = resolveRuntimeContext();
  const requestedMode = options.mode || runtime.mode;
  const useDemo = typeof options.demo === "boolean" ? options.demo : requestedMode === "demo";
  const projectId = options.projectId || runtime.projectId || null;

  if (!useDemo && !projectId) {
    throw new Error("projectId is required for project mode requests");
  }

  return {
    mode: useDemo ? "demo" : "project",
    projectId: useDemo ? null : projectId,
    path: useDemo ? options.demoPath : options.projectPath(projectId || ""),
  };
}

export async function apiFetchRuntime(options: RuntimeFetchOptions): Promise<Response> {
  const resolved = resolveRuntimePath(options);
  const url = buildRuntimeUrl(resolved.path, options.query);
  const headers = withOrganizationHeader(new Headers(options.init?.headers || {}));

  try {
    return await fetch(url, {
      credentials: "include",
      ...options.init,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Network error while requesting ${url}: ${message}`);
  }
}

export async function apiFetchRuntimeJson<T>(options: RuntimeFetchOptions): Promise<T> {
  const response = await apiFetchRuntime(options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Runtime API failed (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

function withOrganizationHeader(headers: Headers): Headers {
  if (typeof window !== "undefined") {
    const selectedOrg = window.localStorage.getItem(SELECTED_ORG_KEY);
    if (selectedOrg && !headers.has("x-selected-organization")) {
      headers.set("x-selected-organization", selectedOrg);
    }
  }

  return headers;
}

function buildRuntimeUrl(path: string, query?: Record<string, QueryValue>): string {
  const search = new URLSearchParams();

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      search.set(key, String(value));
    }
  }

  const configuredBaseUrl = API_CONFIG.BASE_URL?.trim();
  const usesDefaultLocalhost = configuredBaseUrl === "http://localhost:3000";

  // In browser, prefer same-origin URL + Next rewrites to avoid CORS/network mismatch.
  const baseUrl = typeof window !== "undefined" && (!configuredBaseUrl || usesDefaultLocalhost)
    ? ""
    : configuredBaseUrl;

  return `${baseUrl}${path}${search.toString() ? `?${search.toString()}` : ""}`;
}
