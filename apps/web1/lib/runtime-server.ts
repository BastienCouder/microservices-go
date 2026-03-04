import type { RuntimeMode } from "@/lib/runtime-mode";

export type RuntimeServerContext = {
  mode: RuntimeMode;
  projectId: string | null;
};

const DEFAULT_SEEDED_PROJECT_ID = "seed-nike-dashboard";

function resolveSeededProjectId(): string | null {
  const value =
    process.env.NEXT_PUBLIC_SEEDED_PROJECT_ID ||
    process.env.NEXT_PUBLIC_DEFAULT_PROJECT_ID ||
    DEFAULT_SEEDED_PROJECT_ID;
  const normalized = value.trim();
  return normalized || null;
}

export function resolveServerRuntimeContext(
  params: { [key: string]: string | string[] | undefined },
): RuntimeServerContext {
  const modeParam = typeof params.mode === "string" ? params.mode.toLowerCase() : "";
  const demoParam = typeof params.demo === "string" ? params.demo.toLowerCase() : "";
  const projectIdParam = typeof params.projectId === "string" ? params.projectId : undefined;
  const defaultProjectId = resolveSeededProjectId();
  const envMode = (process.env.NEXT_PUBLIC_APP_MODE || "").trim().toLowerCase();
  const isDev = process.env.NODE_ENV !== "production";
  const devDemo = (process.env.NEXT_PUBLIC_DEV_DEMO || "true").trim().toLowerCase();
  const devDemoEnabled = ["1", "true", "yes", "on"].includes(devDemo);

  let mode: RuntimeMode = "project";

  if (envMode === "demo") mode = "demo";
  else if (envMode === "project") mode = "project";
  else if (modeParam === "demo") mode = "demo";
  else if (modeParam === "project") mode = "project";
  else if (["1", "true", "yes", "on"].includes(demoParam)) mode = "demo";
  else if (isDev && devDemoEnabled) mode = "demo";

  const projectId = projectIdParam || defaultProjectId;

  if (projectId) {
    return { mode: "project", projectId };
  }

  return { mode: mode === "demo" ? "demo" : "project", projectId: null };
}
