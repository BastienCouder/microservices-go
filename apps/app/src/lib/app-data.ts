export const VISIBILITY_ANALYTICS_COLORS = {
  series: [
    "hsl(186 49% 62%)",
    "hsl(204 40% 47%)",
    "hsl(221 39% 34%)",
    "hsl(200 63% 68%)",
    "hsl(230 53% 58%)",
    "hsl(213 29% 45%)",
    "hsl(193 34% 56%)",
  ],
  axisTick: "hsl(var(--muted-foreground))",
  tooltipCursor: "hsl(var(--muted) / 0.2)",
  fallbackBar: "hsl(var(--primary))",
} as const;

export const AI_SENTIMENT_COLORS = {
  positive: "hsl(var(--primary))",
  neutral: "hsl(200 90% 45%)",
  negative: "hsl(230 85% 60%)",
  legendFallback: "hsl(var(--muted-foreground))",
} as const;

export const DASHBOARD_TEXT = {
  chartConfig: {
    models: {
      chatgpt: "ChatGPT",
      perplexity: "Perplexity",
      claude: "Claude",
      gemini: "Gemini",
      mistral: "Mistral",
      copilot: "Copilot",
    },
    brands: {
      brand: "Brand",
      comp1: "Competitor 1",
      comp2: "Competitor 2",
      other: "Other",
    },
    sentiment: {
      sentiment: "Sentiment",
      positive: "Positive",
      neutral: "Neutral",
      negative: "Negative",
    },
  },
} as const;
