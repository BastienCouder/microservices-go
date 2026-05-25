const TRAFFIC_ENGINE_ICON_FALLBACK = "/models/openai.svg";

const TRAFFIC_ENGINE_ICON_PATTERNS: Array<{ keys: string[]; icon: string }> = [
  { keys: ["chatgpt", "openai"], icon: "/models/openai.svg" },
  { keys: ["perplexity"], icon: "/models/perplexity.svg" },
  { keys: ["claude", "anthropic"], icon: "/models/anthropic.svg" },
  { keys: ["gemini", "bard", "google"], icon: "/models/google.svg" },
  { keys: ["copilot", "microsoft"], icon: "/models/copilot.svg" },
  { keys: ["deepseek"], icon: "/models/deepseek.svg" },
  { keys: ["grok", "x.ai"], icon: "/models/grok.svg" },
  { keys: ["mistral"], icon: "/models/mistral.svg" },
  { keys: ["qwen", "alibaba"], icon: "/models/qwen-color.svg" },
  { keys: ["z.ai", "zai"], icon: "/models/zai.svg" },
  { keys: ["meta", "llama"], icon: "/models/meta.svg" },
];

export function getTrafficEngineIconPath(engine: string): string {
  const normalized = engine.trim().toLowerCase();
  if (normalized === "all") {
    return "/google_analytics.svg";
  }
  const match = TRAFFIC_ENGINE_ICON_PATTERNS.find((entry) =>
    entry.keys.some((key) => normalized.includes(key)),
  );
  return match?.icon ?? TRAFFIC_ENGINE_ICON_FALLBACK;
}
