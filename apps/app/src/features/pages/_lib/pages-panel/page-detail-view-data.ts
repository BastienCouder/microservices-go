import type { PageInsight, PageModelBadge, PagePromptHit } from "./types";

export type PageModelBreakdownItem = PageModelBadge & {
  responseCount: number;
  citationCount: number;
  coverageShare: number;
};

export type PageGeoNeed = {
  title: string;
  description: string;
  metric: string;
  tone: "primary" | "warning" | "neutral";
};

export type PageCitationSample = PagePromptHit & {
  detailKey: string;
};

export function buildPageCitationSamples(page: PageInsight): PageCitationSample[] {
  const seen = new Set<string>();
  const samples: PageCitationSample[] = [];

  for (const sample of page.samples) {
    const detailKey = buildSampleDetailKey(sample);
    if (seen.has(detailKey)) continue;

    seen.add(detailKey);
    samples.push({ ...sample, detailKey });
  }

  return samples;
}

export function buildPageModelBreakdown(page: PageInsight): PageModelBreakdownItem[] {
  const byModel = new Map<string, PageModelBreakdownItem>();

  for (const sample of buildPageCitationSamples(page)) {
    if (!sample.model) continue;

    const existing = byModel.get(sample.model.id) ?? {
      ...sample.model,
      responseCount: 0,
      citationCount: 0,
      coverageShare: 0,
    };

    existing.responseCount += 1;
    existing.citationCount += sample.citationCount;
    byModel.set(sample.model.id, existing);
  }

  return Array.from(byModel.values())
    .map((model) => ({
      ...model,
      coverageShare: Number(
        ((model.responseCount / Math.max(1, page.promptCount)) * 100).toFixed(1),
      ),
    }))
    .sort((a, b) => {
      if (b.responseCount !== a.responseCount) return b.responseCount - a.responseCount;
      if (b.citationCount !== a.citationCount) return b.citationCount - a.citationCount;
      return a.label.localeCompare(b.label);
    });
}

function buildSampleDetailKey(sample: PagePromptHit): string {
  const responseId = sample.responseId.trim();
  if (responseId) return responseId;

  const promptId = sample.promptId.trim();
  if (promptId) return `${promptId}:${sample.model?.id ?? "unknown-model"}`;

  return [
    sample.model?.id ?? "unknown-model",
    normalizeText(sample.prompt),
    normalizeText(sample.response),
  ].join("|");
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildPageGeoNeed(page: PageInsight): PageGeoNeed | null {
  if (page.modelCount <= 1 && page.promptCount > 0) {
    return {
      title: "Diversifier la reprise LLM",
      description:
        "Cette page est encore reprise par un seul modèle. Renforcez les preuves, les comparatifs et les formulations explicites pour augmenter sa couverture multi-LLM.",
      metric: `${page.modelCount} LLM`,
      tone: "warning",
    };
  }

  if (page.citationShare >= 15 && page.modelCount >= 2 && page.promptCount >= 2) {
    return {
      title: "Décliner le besoin couvert",
      description:
        "Cette page est déjà reprise par plusieurs modèles. Transformez les angles de prompts qui la citent en pages plus spécifiques pour capter la longue traîne GEO.",
      metric: `${page.citationShare}% visibilité`,
      tone: "primary",
    };
  }

  return null;
}
