export type VisibilityBarDatum = {
  id: string;
  label: string;
  value: number;
  fill: string;
};

export type SentimentDatum = {
  name: "positive" | "neutral" | "negative";
  value: number;
  fill: string;
};

export type InsightItem = {
  model: string;
  text: string;
  delta: string;
  level: "high" | "medium";
};

export type TopCitedPage = {
  url: string;
  value: number;
};

export type AnalyticsKpiViewModel = {
  mentionRateValue: string;
  mentionRateSub: string;
  mentionTrend: string;
  mentionTrendDir: "up" | "down" | "stable";
  visibilityScoreValue: string;
  visibilitySub: string;
  visibilityTrend: string;
  visibilityTrendDir: "up" | "down" | "stable";
  avgPositionValue: string;
  avgPositionSub: string;
  avgPositionTrend: string;
  avgPositionTrendDir: "up" | "down" | "stable";
};

export type AnalyticsPanelViewModel = {
  loading: boolean;
  kpis: AnalyticsKpiViewModel;
  visibilityAnalytics: {
    effectiveVisibilityPeriod: string;
    barData: VisibilityBarDatum[];
    hasCompetitorFilter: boolean;
    title?: string;
  };
  sentiment: {
    sentimentData: SentimentDatum[];
    factualAccuracy: number;
    factualAccuracyCount: number;
    totalCount: number;
    hasData: boolean;
  };
  citedPages: {
    topCitedPages: TopCitedPage[];
    topCitedTotal: number;
    longTailShare: number;
  };
  autoInsights: InsightItem[];
};
