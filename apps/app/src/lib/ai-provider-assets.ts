import { toSafeImageAssetPath } from "@/lib/safe-asset-path";

export type AIProviderAsset = {
  id: string;
  label: string;
  provider: string;
  iconPath: string;
  aliases: readonly string[];
  trafficIconPath?: string;
};

type AIProviderIconVariant = "default" | "traffic";

const DEFAULT_AI_PROVIDER_ICON_PATH = "/models/openai.svg";

export const AI_PROVIDER_ASSETS: readonly AIProviderAsset[] = [
  {
    id: "openai",
    label: "ChatGPT",
    provider: "OpenAI",
    iconPath: "/models/openai.svg",
    aliases: ["openai", "chatgpt", "gpt", "o1", "o3", "o4"],
  },
  {
    id: "google",
    label: "Gemini",
    provider: "Google",
    iconPath: "/models/google.svg",
    aliases: ["google", "gemini", "gemma", "bard"],
  },
  {
    id: "anthropic",
    label: "Claude",
    provider: "Anthropic",
    iconPath: "/models/anthropic.svg",
    aliases: ["anthropic", "claude"],
  },
  {
    id: "perplexity",
    label: "Perplexity",
    provider: "Perplexity",
    iconPath: "/models/perplexity.svg",
    aliases: ["perplexity"],
  },
  {
    id: "mistral",
    label: "Mistral",
    provider: "Mistral",
    iconPath: "/models/mistral.svg",
    aliases: ["mistral", "mistralai", "mistral ai"],
  },
  {
    id: "copilot",
    label: "Copilot",
    provider: "Microsoft",
    iconPath: "/models/copilot.svg",
    aliases: ["copilot", "microsoft"],
  },
  {
    id: "xai",
    label: "Grok",
    provider: "xAI",
    iconPath: "/models/xai.svg",
    trafficIconPath: "/models/grok.svg",
    aliases: ["xai", "x.ai", "grok"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    provider: "DeepSeek",
    iconPath: "/models/deepseek.svg",
    aliases: ["deepseek"],
  },
  {
    id: "qwen",
    label: "Qwen",
    provider: "Qwen",
    iconPath: "/models/qwen.svg",
    trafficIconPath: "/models/qwen-color.svg",
    aliases: ["qwen", "qwen-color", "alibaba"],
  },
  {
    id: "meta",
    label: "Meta AI",
    provider: "Meta",
    iconPath: "/models/meta.svg",
    aliases: ["meta", "llama"],
  },
  {
    id: "groq",
    label: "Groq",
    provider: "Groq",
    iconPath: "/models/groq.svg",
    aliases: ["groq"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    provider: "OpenRouter",
    iconPath: "/models/openrouter.svg",
    aliases: ["openrouter"],
  },
  {
    id: "zai",
    label: "Z.ai",
    provider: "Z.ai",
    iconPath: "/models/zai.svg",
    aliases: ["z.ai", "zai"],
  },
] as const;

export const AI_PROVIDER_ICON_PATHS = Object.freeze(
  Object.fromEntries(
    AI_PROVIDER_ASSETS.map((asset) => [asset.id, asset.iconPath] as const),
  ) as Record<string, string>,
);

export const MODEL_SVG_ICON_PATHS = Array.from(
  new Set(
    AI_PROVIDER_ASSETS.flatMap((asset) =>
      asset.trafficIconPath
        ? [asset.iconPath, asset.trafficIconPath]
        : [asset.iconPath],
    ),
  ),
);

function normalizeLookupValue(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeLookupValues(values: string[]): string {
  return values
    .map((value) => normalizeLookupValue(value))
    .filter(Boolean)
    .join(" ");
}

export function findAIProviderAsset(
  ...values: Array<string | null | undefined>
): AIProviderAsset | null {
  const haystack = normalizeLookupValues(
    values.filter((value): value is string => typeof value === "string"),
  );
  if (!haystack) return null;

  return (
    AI_PROVIDER_ASSETS.find((asset) =>
      asset.aliases.some((alias) => haystack.includes(alias)),
    ) ?? null
  );
}

export function getAIProviderIconPath(
  value: string,
  options?: {
    fallback?: string;
    variant?: AIProviderIconVariant;
  },
): string {
  const asset = findAIProviderAsset(value);
  if (!asset) {
    return options?.fallback ?? DEFAULT_AI_PROVIDER_ICON_PATH;
  }

  if (options?.variant === "traffic") {
    return asset.trafficIconPath ?? asset.iconPath;
  }

  return asset.iconPath;
}

export function getAIProviderLabel(value: string, fallback = ""): string {
  return findAIProviderAsset(value)?.provider ?? fallback;
}

export function getAIModelFamilyLabel(value: string, fallback = ""): string {
  return findAIProviderAsset(value)?.label ?? fallback;
}

export function resolveAIIconPath(
  iconPath: string | null | undefined,
  ...values: Array<string | null | undefined>
): string {
  const safeIconPath = toSafeImageAssetPath(iconPath ?? "");
  if (safeIconPath) return safeIconPath;

  return findAIProviderAsset(...values)?.iconPath ?? "";
}
