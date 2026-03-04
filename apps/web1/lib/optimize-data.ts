import { apiRoutes } from "@/lib/api-config";
import type { BrandCanon, OptimizePriority, PerceptionViewData } from "@/lib/perception-data";
import { apiFetch } from "@/lib/server-api";

export type OptimizeActionType = "faq" | "comparison" | "pricing";
export type OptimizeActionStatus = "open" | "in_progress" | "resolved";

export type OptimizeGeneratedContent = {
  markdown?: string;
  html?: string;
  publishedUrl?: string;
};

export type OptimizeAction = {
  id: string;
  priority: OptimizePriority;
  type: OptimizeActionType;
  title: string;
  issue: string;
  impact: string;
  status: OptimizeActionStatus;
  aiModels: string[];
  promptsCount: number;
  generatedContent?: OptimizeGeneratedContent;
  createdAt: string;
};

type OptimizeActionApiRow = {
  id: string;
  projectId: string;
  priority: string;
  type: string;
  title: string;
  issue: string;
  impact: string | null;
  generatedContent: string;
  status: string;
  sourceErrorId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type SeedAction = Omit<OptimizeAction, "id" | "createdAt">;

function formatCanonPricingReference(canon: BrandCanon): string {
  const pricing = (canon as BrandCanon & {
    pricing?: { amount?: number; currency?: string; period?: string };
  }).pricing;

  if (
    pricing &&
    typeof pricing.amount === "number" &&
    pricing.currency &&
    pricing.period
  ) {
    return `${pricing.amount} ${pricing.currency}/${pricing.period}`;
  }

  return "non renseignée (utiliser des repères de gamme et exemples concrets)";
}

function seedMarkdown(type: OptimizeActionType, title: string, issue: string, canon: BrandCanon): string {
  if (type === "pricing") {
    return [
      "## FAQ",
      "",
      `### Q: Quel est le vrai pricing de ${canon.brandName} ?`,
      `**R:** ${canon.brandName} propose plusieurs niveaux de prix selon les produits et usages. Référence canon: ${formatCanonPricingReference(canon)}.`,
      "",
      "### Q: Pourquoi certaines IA surestiment-elles le prix ?",
      `**R:** Elles généralisent parfois la gamme premium à l'ensemble du catalogue. Nous publions ici des repères par tranche pour corriger cette perception.`,
      "",
      `### Q: ${title}`,
      `**R:** ${issue}`,
    ].join("\n");
  }

  if (type === "comparison") {
    return [
      `## Comparison: ${canon.brandName} vs alternatives`,
      "",
      "### Positioning",
      canon.positioning,
      "",
      "### Ce que les IA doivent retenir",
      `- Catégorie: ${canon.category}`,
      `- Use cases: ${canon.useCases.slice(0, 4).join(", ")}`,
      `- Features clés: ${canon.features.slice(0, 5).join(", ")}`,
      "",
      `### Problème corrigé`,
      issue,
    ].join("\n");
  }

  return [
    `## FAQ ${canon.brandName}`,
    "",
    `### Q: ${title}`,
    `**R:** ${issue}`,
    "",
    "### Points factuels à citer",
    `- Catégorie: ${canon.category}`,
    `- Positionnement: ${canon.positioning}`,
    `- Features: ${canon.features.slice(0, 5).join(", ")}`,
  ].join("\n");
}

export function buildDemoOptimizeActions(perception: PerceptionViewData): OptimizeAction[] {
  const canon = perception.brandCanon;
  const models = perception.metadata.models;
  const seeds: SeedAction[] = [
    {
      priority: "high",
      type: "pricing",
      title: "Corriger la perception de pricing sur la page Pricing",
      issue: "23% des réponses IA hallucinent un pricing premium systématique et >250€.",
      impact: "+12% Factual Accuracy",
      status: "open",
      aiModels: ["ChatGPT", "Gemini"],
      promptsCount: 31,
      generatedContent: {},
    },
    {
      priority: "high",
      type: "faq",
      title: "Publier une FAQ “prix réel / gammes de prix”",
      issue: "Les IA confondent le haut de gamme avec l'ensemble de l'offre.",
      impact: "+9% Factual Accuracy",
      status: "open",
      aiModels: ["Perplexity", "Claude"],
      promptsCount: 24,
      generatedContent: {},
    },
    {
      priority: "high",
      type: "comparison",
      title: "Créer une page comparison catégorie vs concurrents",
      issue: "La marque est parfois décrite comme “fashion-only” au lieu de performance + lifestyle.",
      impact: "+11% Positioning Accuracy",
      status: "in_progress",
      aiModels: ["Perplexity", "Claude"],
      promptsCount: 19,
      generatedContent: {},
    },
    {
      priority: "high",
      type: "faq",
      title: "FAQ “Quelle catégorie de marque ?”",
      issue: "Mauvaise classification sur les réponses de comparaison concurrentielle.",
      impact: "+7% Positioning Accuracy",
      status: "open",
      aiModels: ["Claude", "Mistral"],
      promptsCount: 14,
      generatedContent: {},
    },
    {
      priority: "medium",
      type: "faq",
      title: "FAQ sur les features sous-citées",
      issue: "Les assistants oublient régulièrement des features et services digitaux clés.",
      impact: "+6% Features Coverage",
      status: "open",
      aiModels: ["Mistral", "Claude"],
      promptsCount: 17,
      generatedContent: {},
    },
    {
      priority: "medium",
      type: "comparison",
      title: "Comparison “core use cases” vs alternatives",
      issue: "Les use cases réels sont mal priorisés dans les synthèses IA.",
      impact: "+5% Use Case Accuracy",
      status: "open",
      aiModels: ["ChatGPT", "Perplexity"],
      promptsCount: 12,
      generatedContent: {},
    },
    {
      priority: "medium",
      type: "faq",
      title: "FAQ “ce que fait réellement le produit”",
      issue: "Descriptions trop génériques, perte du positionnement métier.",
      impact: "+4% Positioning Accuracy",
      status: "resolved",
      aiModels: ["Gemini"],
      promptsCount: 8,
      generatedContent: {},
    },
    {
      priority: "medium",
      type: "pricing",
      title: "Tableau de références de prix par gamme",
      issue: "Absence de repères publics structurés qui ancrent les réponses IA.",
      impact: "+8% Factual Accuracy",
      status: "open",
      aiModels: ["ChatGPT", "Claude", "Gemini"],
      promptsCount: 22,
      generatedContent: {},
    },
    {
      priority: "low",
      type: "faq",
      title: "FAQ “features avancées / edge cases”",
      issue: "Quelques capacités avancées sont rarement citées par les IA.",
      impact: "+3% Features Coverage",
      status: "open",
      aiModels: ["Mistral"],
      promptsCount: 6,
      generatedContent: {},
    },
    {
      priority: "low",
      type: "comparison",
      title: "Page comparison orientée personas",
      issue: "Manque de signaux pour les segments d'audience spécifiques.",
      impact: "+3% Audience Fit Accuracy",
      status: "open",
      aiModels: ["Claude", "Perplexity"],
      promptsCount: 9,
      generatedContent: {},
    },
    {
      priority: "low",
      type: "faq",
      title: "FAQ “mythes vs réalités”",
      issue: "Certaines formulations marketing externes créent des raccourcis IA.",
      impact: "+2% Factual Accuracy",
      status: "in_progress",
      aiModels: ["ChatGPT", "Gemini"],
      promptsCount: 7,
      generatedContent: {},
    },
    {
      priority: "low",
      type: "pricing",
      title: "Bloc pricing “ce qui influence le prix”",
      issue: "Le contexte de variation de prix n'est pas explicitement documenté.",
      impact: "+2% Pricing Clarity",
      status: "open",
      aiModels: models.slice(0, 3),
      promptsCount: 5,
      generatedContent: {},
    },
  ];

  return seeds.map((seed, index) => {
    const id = `demo-opt-${String(index + 1).padStart(2, "0")}`;
    return {
      ...seed,
      id,
      createdAt: new Date(Date.now() - index * 36e5).toISOString(),
      generatedContent: {
        markdown: seedMarkdown(seed.type, seed.title, seed.issue, canon),
        ...seed.generatedContent,
      },
    };
  });
}

function isPriority(value: string): value is OptimizePriority {
  return value === "high" || value === "medium" || value === "low";
}

function mapActionType(rawType: string): OptimizeActionType {
  const value = rawType.toLowerCase();
  if (value.includes("pricing")) return "pricing";
  if (value.includes("comparison") || value.includes("competitor") || value.includes("website_copy")) return "comparison";
  return "faq";
}

function mapStatus(rawStatus: string): OptimizeActionStatus {
  if (rawStatus === "resolved") return "resolved";
  if (rawStatus === "in_progress") return "in_progress";
  if (rawStatus === "open" || rawStatus === "draft") return "open";
  return "open";
}

function parseGeneratedContent(raw: string, metadata: Record<string, unknown> | null | undefined): OptimizeGeneratedContent {
  let markdown: string | undefined = raw;
  let html: string | undefined;
  let publishedUrl: string | undefined;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.markdown === "string") markdown = parsed.markdown;
      if (typeof parsed.html === "string") html = parsed.html;
      if (typeof parsed.publishedUrl === "string") publishedUrl = parsed.publishedUrl;
      if (typeof parsed.published_url === "string") publishedUrl = parsed.published_url;
    }
  } catch {
    // Backward-compatible: generated_content is plain text in current schema.
  }

  if (!publishedUrl && metadata && typeof metadata.publishedUrl === "string") {
    publishedUrl = metadata.publishedUrl;
  }

  return { markdown, html, publishedUrl };
}

export function mapOptimizeActionApiRow(row: OptimizeActionApiRow): OptimizeAction {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};

  const aiModels = Array.isArray(metadata.detectedInModels)
    ? metadata.detectedInModels.filter((item): item is string => typeof item === "string")
    : Array.isArray(metadata.aiModels)
      ? metadata.aiModels.filter((item): item is string => typeof item === "string")
      : [];

  const promptsCount =
    typeof metadata.promptsCount === "number"
      ? metadata.promptsCount
      : typeof metadata.prompts_count === "number"
        ? metadata.prompts_count
        : 0;

  return {
    id: row.id,
    priority: isPriority(row.priority) ? row.priority : "medium",
    type: mapActionType(row.type),
    title: row.title,
    issue: row.issue,
    impact: row.impact ?? "",
    status: mapStatus(row.status),
    aiModels,
    promptsCount,
    generatedContent: parseGeneratedContent(row.generatedContent, metadata),
    createdAt: row.createdAt,
  };
}

export async function getOptimizeActionsServer(projectId: string): Promise<OptimizeAction[]> {
  const response = await apiFetch<OptimizeActionApiRow[]>(apiRoutes.analysis.optimizeActions(projectId), {
    cache: "no-store",
    next: { tags: [`optimize:${projectId}`] },
  });

  const rows = Array.isArray(response) ? response : [];
  return rows.map(mapOptimizeActionApiRow);
}
