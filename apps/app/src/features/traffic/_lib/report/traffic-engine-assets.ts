import { getAIProviderIconPath } from "@/lib/ai-provider-assets";

const TRAFFIC_ENGINE_ICON_FALLBACK = "/models/openai.svg";

export function getTrafficEngineIconPath(engine: string): string {
  const normalized = engine.trim().toLowerCase();
  if (normalized === "all") {
    return "/google_analytics.svg";
  }

  return getAIProviderIconPath(engine, {
    fallback: TRAFFIC_ENGINE_ICON_FALLBACK,
    variant: "traffic",
  });
}
