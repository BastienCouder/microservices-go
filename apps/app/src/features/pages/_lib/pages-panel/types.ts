export type PageModelBadge = {
  id: string;
  label: string;
  iconPath: string;
};

export type PagePromptHit = {
  id: string;
  prompt: string;
  model: PageModelBadge | null;
  persona: string;
  time: string;
  createdAt?: string;
  citationCount: number;
};

export type PageInsight = {
  url: string;
  hostname: string;
  path: string;
  citationShare: number;
  citationCount: number;
  promptCount: number;
  modelCount: number;
  models: PageModelBadge[];
  personas: string[];
  lastSeen?: string;
  samples: PagePromptHit[];
};

export type PagesMetrics = {
  pageCount: number;
  citationCount: number;
  promptCount: number;
  topThreeShare: number;
  citedPages: Array<{ url: string; value: number }>;
  citedPagesTotal: number;
  longTailShare: number;
  modelCoverageShare: number;
  citationSourceCount: number;
};

export type ModelLeader = PageModelBadge & {
  citedPageCount: number;
  sourcedPromptCount: number;
  citationCount: number;
  coverageShare: number;
};

export type CitationSource = {
  hostname: string;
  citationCount: number;
  promptCount: number;
  coverageShare: number;
  sampleUrls: string[];
  models: PageModelBadge[];
};

export type PagesOpportunity = {
  title: string;
  description: string;
  metric: string;
  tone: "primary" | "warning" | "neutral";
};

export type PagesPanelModel = {
  pages: PageInsight[];
  metrics: PagesMetrics;
  modelLeaders: ModelLeader[];
  citationSources: CitationSource[];
  opportunities: PagesOpportunity[];
};
