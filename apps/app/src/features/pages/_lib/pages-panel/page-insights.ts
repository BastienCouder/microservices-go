import type {
  MonitoringData,
  MonitoringPrompt,
} from "@/features/monitoring/_lib/shared/monitoring-data";
import { resolveAIIconPath } from "@/lib/ai-provider-assets";
import i18n from "@/shared/i18n";
import { translateI18nText } from "@/shared/hooks/use-i18n";

import type {
  CitationSource,
  ModelLeader,
  PageInsight,
  PageModelBadge,
  PagePromptHit,
  PagesMetrics,
  PagesOpportunity,
  PagesPanelModel,
} from "./types";

function currentLocale() {
  return i18n.resolvedLanguage || i18n.language || "fr";
}

type MutablePageInsight = {
  url: string;
  hostname: string;
  path: string;
  citationCount: number;
  promptCount: number;
  models: Map<string, PageModelBadge>;
  personas: Set<string>;
  lastSeen?: string;
  samples: PagePromptHit[];
};

type MutableCitationSource = {
  hostname: string;
  citationCount: number;
  promptCount: number;
  sampleUrls: Set<string>;
  models: Map<string, PageModelBadge>;
};

type MutableModelLeader = PageModelBadge & {
  citedPages: Set<string>;
  sourcedPromptIds: Set<string>;
  citationCount: number;
};

export function buildPagesPanelViewModel(monitoring: MonitoringData): PagesPanelModel {
  const locale = currentLocale();
  const projectHosts = inferProjectHosts(monitoring);
  const pages = buildPageInsights(monitoring, projectHosts);
  const metrics = buildPageMetrics(pages, monitoring, projectHosts);

  return {
    pages,
    metrics,
    modelLeaders: buildModelLeaders(monitoring, projectHosts),
    citationSources: buildCitationSources(monitoring, projectHosts),
    opportunities: buildPagesOpportunities(pages, metrics, locale),
  };
}

function buildPageMetrics(
  pages: PageInsight[],
  monitoring: MonitoringData,
  projectHosts: Set<string>,
): PagesMetrics {
  const citationCount = pages.reduce((sum, page) => sum + page.citationCount, 0);
  const promptIdsWithOwnedSource = new Set<string>();
  const modelIdsWithOwnedSource = new Set<string>();
  const externalHosts = new Set<string>();

  for (const prompt of monitoring.recent_prompts) {
    const ownedUrlsInPrompt = new Set<string>();

    for (const rawUrl of prompt.citedUrls) {
      const url = rawUrl.trim();
      if (!url) continue;

      const { hostname } = parsePageUrl(url);
      const normalizedHostname = normalizeHost(hostname);

      if (isOwnedHost(normalizedHostname, projectHosts)) {
        ownedUrlsInPrompt.add(url);
        const model = toPageModelBadge(prompt);
        if (model) {
          modelIdsWithOwnedSource.add(model.id);
        }
      } else {
        externalHosts.add(normalizedHostname);
      }
    }

    if (ownedUrlsInPrompt.size > 0) {
      promptIdsWithOwnedSource.add(prompt.responseId || prompt.promptId || prompt.text);
    }
  }

  const topThreeShare = Math.min(
    100,
    Number(
      pages
        .slice(0, 3)
        .reduce((sum, page) => sum + page.citationShare, 0)
        .toFixed(1),
    ),
  );
  const citedPages = pages.slice(0, 3).map((page) => ({
    url: page.path || page.url,
    value: Number(((page.citationCount / Math.max(1, citationCount)) * 100).toFixed(1)),
  }));
  const citedPagesTotal = Math.min(
    100,
    Number(citedPages.reduce((sum, page) => sum + page.value, 0).toFixed(1)),
  );

  return {
    pageCount: pages.length,
    citationCount,
    promptCount: promptIdsWithOwnedSource.size,
    topThreeShare,
    citedPages,
    citedPagesTotal,
    longTailShare: Number(Math.max(0, 100 - citedPagesTotal).toFixed(1)),
    modelCoverageShare: Number(((modelIdsWithOwnedSource.size / Math.max(1, monitoring.models.length || modelIdsWithOwnedSource.size)) * 100).toFixed(1)),
    citationSourceCount: externalHosts.size,
  };
}

function buildPageInsights(monitoring: MonitoringData, projectHosts: Set<string>): PageInsight[] {
  const byUrl = new Map<string, MutablePageInsight>();
  const totalResponses = Math.max(1, monitoring.recent_prompts.length);

  for (const prompt of monitoring.recent_prompts) {
    const citationCounts = countCitationsByUrl(prompt);

    for (const [url, citationCount] of citationCounts.entries()) {
      const parsed = parsePageUrl(url);
      const normalizedHostname = normalizeHost(parsed.hostname);
      if (!isOwnedHost(normalizedHostname, projectHosts)) continue;

      const existing = byUrl.get(url) ?? {
        url,
        ...parsed,
        citationCount: 0,
        promptCount: 0,
        models: new Map<string, PageModelBadge>(),
        personas: new Set<string>(),
        samples: [],
      };

      existing.citationCount += citationCount;
      existing.promptCount += 1;
      const modelBadge = toPageModelBadge(prompt);
      if (modelBadge) {
        existing.models.set(modelBadge.id, modelBadge);
      }
      if (prompt.persona.trim()) {
        existing.personas.add(prompt.persona.trim());
      }
      if (prompt.createdAt && (!existing.lastSeen || prompt.createdAt > existing.lastSeen)) {
        existing.lastSeen = prompt.createdAt;
      }
      existing.samples.push({
        id: `${prompt.responseId || prompt.promptId}-${url}`,
        prompt: prompt.text.trim() || translateI18nText("pages", "responseWithoutLabel", currentLocale()),
        response: prompt.response.trim() || translateI18nText("pages", "responseWithoutContent", currentLocale()),
        promptId: prompt.promptId.trim(),
        responseId: prompt.responseId.trim(),
        model: modelBadge,
        persona: prompt.persona.trim(),
        time: prompt.time,
        createdAt: prompt.createdAt,
        citationCount,
      });

      byUrl.set(url, existing);
    }
  }

  return Array.from(byUrl.values())
    .map((page) => ({
      url: page.url,
      hostname: page.hostname,
      path: page.path,
      citationCount: page.citationCount,
      promptCount: page.promptCount,
      citationShare: Number(((page.citationCount / totalResponses) * 100).toFixed(1)),
      modelCount: page.models.size,
      models: Array.from(page.models.values()).sort(compareModelBadges),
      personas: Array.from(page.personas.values()).sort((a, b) => a.localeCompare(b)),
      lastSeen: page.lastSeen,
      samples: page.samples.sort(comparePromptHitDates).slice(0, 12),
    }))
    .sort(comparePageInsights);
}

function buildModelLeaders(
  monitoring: MonitoringData,
  projectHosts: Set<string>,
): ModelLeader[] {
  const byModel = new Map<string, MutableModelLeader>();
  const totalResponses = Math.max(1, monitoring.recent_prompts.length);

  for (const prompt of monitoring.recent_prompts) {
    const model = toPageModelBadge(prompt);
    if (!model) continue;

    const citationCounts = countCitationsByUrl(prompt);
    const ownedPageUrls = Array.from(citationCounts.keys()).filter((url) => {
      const { hostname } = parsePageUrl(url);
      return isOwnedHost(normalizeHost(hostname), projectHosts);
    });
    if (ownedPageUrls.length === 0) continue;

    const existing = byModel.get(model.id) ?? {
      ...model,
      citedPages: new Set<string>(),
      sourcedPromptIds: new Set<string>(),
      citationCount: 0,
    };

    existing.sourcedPromptIds.add(prompt.responseId || prompt.promptId || prompt.text);
    for (const url of ownedPageUrls) {
      existing.citedPages.add(url);
      existing.citationCount += citationCounts.get(url) ?? 0;
    }
    byModel.set(model.id, existing);
  }

  return Array.from(byModel.values())
    .map((model) => ({
      id: model.id,
      label: model.label,
      iconPath: model.iconPath,
      citedPageCount: model.citedPages.size,
      sourcedPromptCount: model.sourcedPromptIds.size,
      citationCount: model.citationCount,
      coverageShare: Number(((model.sourcedPromptIds.size / totalResponses) * 100).toFixed(1)),
    }))
    .sort((a, b) => {
      if (b.coverageShare !== a.coverageShare) return b.coverageShare - a.coverageShare;
      if (b.citationCount !== a.citationCount) return b.citationCount - a.citationCount;
      return a.label.localeCompare(b.label);
    })
    .slice(0, 6);
}

function buildCitationSources(
  monitoring: MonitoringData,
  projectHosts: Set<string>,
): CitationSource[] {
  const byHost = new Map<string, MutableCitationSource>();
  const totalResponses = Math.max(1, monitoring.recent_prompts.length);

  for (const prompt of monitoring.recent_prompts) {
    const citationCounts = countCitationsByUrl(prompt);
    const promptHosts = new Set<string>();

    for (const [url, citationCount] of citationCounts.entries()) {
      const { hostname } = parsePageUrl(url);
      const normalizedHostname = normalizeHost(hostname);
      if (isOwnedHost(normalizedHostname, projectHosts)) continue;

      const existing = byHost.get(normalizedHostname) ?? {
        hostname: normalizedHostname,
        citationCount: 0,
        promptCount: 0,
        sampleUrls: new Set<string>(),
        models: new Map<string, PageModelBadge>(),
      };
      const model = toPageModelBadge(prompt);

      existing.citationCount += citationCount;
      existing.sampleUrls.add(url);
      if (!promptHosts.has(normalizedHostname)) {
        existing.promptCount += 1;
        promptHosts.add(normalizedHostname);
      }
      if (model) {
        existing.models.set(model.id, model);
      }
      byHost.set(normalizedHostname, existing);
    }
  }

  return Array.from(byHost.values())
    .map((source) => ({
      hostname: source.hostname,
      citationCount: source.citationCount,
      promptCount: source.promptCount,
      coverageShare: Number(((source.promptCount / totalResponses) * 100).toFixed(1)),
      sampleUrls: Array.from(source.sampleUrls).slice(0, 3),
      models: Array.from(source.models.values()).sort(compareModelBadges),
    }))
    .sort((a, b) => {
      if (b.coverageShare !== a.coverageShare) return b.coverageShare - a.coverageShare;
      if (b.citationCount !== a.citationCount) return b.citationCount - a.citationCount;
      return a.hostname.localeCompare(b.hostname);
    })
    .slice(0, 8);
}

function buildPagesOpportunities(
  pages: PageInsight[],
  metrics: PagesMetrics,
  locale: string,
): PagesOpportunity[] {
  const opportunities: PagesOpportunity[] = [];
  const topPage = pages[0];

  if (metrics.pageCount > 0 && metrics.topThreeShare >= 70) {
    opportunities.push({
      title: translateI18nText("pages", "extendLongTailTitle", locale),
      description: translateI18nText("pages", "extendLongTailDescription", locale),
      metric: `${metrics.topThreeShare}% top 3`,
      tone: "primary",
    });
  }

  if (topPage && topPage.modelCount <= 1) {
    opportunities.push({
      title: translateI18nText("pages", "diversifyLlmsTitle", locale),
      description: translateI18nText("pages", "diversifyLlmsDescription", locale),
      metric: `${topPage.modelCount} LLM`,
      tone: "warning",
    });
  }

  if (metrics.citationSourceCount === 0) {
    opportunities.push({
      title: translateI18nText("pages", "createExternalRelayTitle", locale),
      description: translateI18nText("pages", "createExternalRelayDescription", locale),
      metric: translateI18nText("pages", "sourceMetric", locale, { count: 0 }),
      tone: "neutral",
    });
  }

  return opportunities.slice(0, 3);
}

function inferProjectHosts(monitoring: MonitoringData): Set<string> {
  const hosts = new Set<string>();
  const projectWebsite = monitoring.project.website?.trim() ?? "";
  const projectWebsiteHost = parsePossibleHost(projectWebsite);
  if (projectWebsiteHost) {
    hosts.add(projectWebsiteHost);
  }

  const projectTagline = monitoring.project.tagline.trim();
  const projectTaglineHost = parsePossibleHost(projectTagline);
  if (projectTaglineHost) {
    hosts.add(projectTaglineHost);
  }

  if (hosts.size === 0 && monitoring.pagesStats.pages.length > 0) {
    const firstPageHost = parsePossibleHost(monitoring.pagesStats.pages[0]?.pageUrl ?? "");
    if (firstPageHost) {
      hosts.add(firstPageHost);
    }
  }

  return hosts;
}

function isOwnedHost(hostname: string, projectHosts: Set<string>): boolean {
  if (projectHosts.size === 0) return true;
  return projectHosts.has(hostname);
}

function parsePossibleHost(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return normalizeHost(new URL(trimmed).hostname);
  } catch {
    const withoutProtocol = trimmed.replace(/^https?:\/\//i, "").split(/[/?#]/)[0] ?? "";
    if (!withoutProtocol.includes(".")) return null;
    return normalizeHost(withoutProtocol);
  }
}

function countCitationsByUrl(prompt: MonitoringPrompt): Map<string, number> {
  const counts = new Map<string, number>();
  const citedUrls = prompt.allCitedUrls.length > 0 ? prompt.allCitedUrls : prompt.citedUrls;

  for (const rawUrl of citedUrls) {
    const url = rawUrl.trim();
    if (!url) continue;
    counts.set(url, (counts.get(url) ?? 0) + 1);
  }

  return counts;
}

function parsePageUrl(url: string): { hostname: string; path: string } {
  try {
    const parsed = new URL(url);
    const hostname = normalizeHost(parsed.hostname) || url;
    const path = `${parsed.pathname || "/"}${parsed.search || ""}${parsed.hash || ""}` || "/";
    return { hostname, path };
  } catch {
    return { hostname: url, path: url };
  }
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, "");
}

function comparePromptHitDates(a: PagePromptHit, b: PagePromptHit) {
  if (a.createdAt && b.createdAt) {
    return b.createdAt.localeCompare(a.createdAt);
  }
  if (a.createdAt) return -1;
  if (b.createdAt) return 1;
  return 0;
}

function comparePageInsights(a: PageInsight, b: PageInsight) {
  if (b.citationShare !== a.citationShare) return b.citationShare - a.citationShare;
  if (b.citationCount !== a.citationCount) return b.citationCount - a.citationCount;
  return a.url.localeCompare(b.url);
}

function compareModelBadges(a: PageModelBadge, b: PageModelBadge) {
  return a.label.localeCompare(b.label);
}

function toPageModelBadge(prompt: MonitoringPrompt): PageModelBadge | null {
  const label =
    prompt.modelDisplayName.trim() ||
    prompt.modelGroupName.trim() ||
    prompt.modelProviderModelId.trim() ||
    prompt.modelId.trim();

  if (!label) {
    return null;
  }

  return {
    id:
      prompt.modelId.trim() ||
      prompt.modelProviderModelId.trim() ||
      prompt.modelDisplayName.trim() ||
      prompt.modelGroupName.trim(),
    label,
    iconPath: resolveAIIconPath(
      prompt.modelIconPath,
      prompt.modelProviderModelId,
      prompt.modelDisplayName,
      prompt.modelGroupName,
      prompt.modelId,
    ),
  };
}
