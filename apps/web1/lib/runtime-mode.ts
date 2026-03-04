export type RuntimeMode = "demo" | "project";
export interface RuntimeContext {
  mode: RuntimeMode;
  projectId: string | null;
}

const STORAGE_KEYS = ["app-mode", "demo-mode"] as const;
const DEFAULT_SEEDED_PROJECT_ID = "seed-nike-dashboard";

function getSeededProjectId(): string | null {
  const value =
    process.env.NEXT_PUBLIC_SEEDED_PROJECT_ID ||
    process.env.NEXT_PUBLIC_DEFAULT_PROJECT_ID ||
    DEFAULT_SEEDED_PROJECT_ID;
  const normalized = value.trim();
  return normalized || null;
}

export function detectRuntimeMode(): RuntimeMode {
  const envMode = (process.env.NEXT_PUBLIC_APP_MODE || "").trim().toLowerCase();
  if (envMode === "demo") return "demo";
  if (envMode === "project") return "project";

  const isDev = process.env.NODE_ENV !== "production";
  const devDemo = (process.env.NEXT_PUBLIC_DEV_DEMO || "true").trim().toLowerCase();
  const devDemoEnabled = ["1", "true", "yes", "on"].includes(devDemo);

  if (typeof window === "undefined") {
    return isDev && devDemoEnabled ? "demo" : "project";
  }

  const params = new URLSearchParams(window.location.search);
  const modeParam = (params.get("mode") || "").trim().toLowerCase();
  const demoParam = (params.get("demo") || "").trim().toLowerCase();

  if (modeParam === "demo") return "demo";
  if (["1", "true", "yes", "on"].includes(demoParam)) return "demo";

  if (window.location.pathname.startsWith("/demo")) return "demo";

  for (const key of STORAGE_KEYS) {
    const value = (window.localStorage.getItem(key) || "").trim().toLowerCase();
    if (value === "demo") return "demo";
    if (value === "project") return "project";
  }

  if (isDev && devDemoEnabled) return "demo";

  return "project";
}

export function detectProjectId(): string | null {
  const seededProjectId = getSeededProjectId();

  if (typeof window === "undefined") {
    return seededProjectId;
  }

  const params = new URLSearchParams(window.location.search);
  const queryId = params.get("projectId");
  const selectedProjectId = window.localStorage.getItem("selected-project-id");
  const activeProjectId = window.localStorage.getItem("active-project-id");
  const envDefault = seededProjectId;

  return queryId || selectedProjectId || activeProjectId || envDefault;
}

export function resolveRuntimeContext(): RuntimeContext {
  const mode = detectRuntimeMode();
  const projectId = detectProjectId();

  if (projectId) {
    return { mode: "project", projectId };
  }

  // Last-resort fallback if no seed/default project is configured.
  return { mode: mode === "demo" ? "demo" : "project", projectId: null };
}

// Backward-compatible alias for existing callers.
export const resolveExportContext = resolveRuntimeContext;
