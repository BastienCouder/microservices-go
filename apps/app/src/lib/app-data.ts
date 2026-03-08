export const VISIBILITY_ANALYTICS_COLORS = {
  series: [
    "hsl(var(--chart-series-1))",
    "hsl(var(--chart-series-2))",
    "hsl(var(--chart-series-3))",
    "hsl(var(--chart-series-4))",
    "hsl(var(--chart-series-5))",
    "hsl(var(--chart-series-6))",
    "hsl(var(--chart-series-7))",
  ],
  axisTick: "hsl(var(--chart-axis))",
  tooltipCursor: "hsl(var(--chart-cursor) / 0.2)",
  fallbackBar: "hsl(var(--chart-brand-primary))",
} as const;

export const AI_SENTIMENT_COLORS = {
  positive: "hsl(var(--chart-sentiment-positive))",
  neutral: "hsl(var(--chart-sentiment-neutral))",
  negative: "hsl(var(--chart-sentiment-negative))",
  legendFallback: "hsl(var(--chart-axis))",
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

export const APP_CHART_UI_COLORS = {
  axisTick: "hsl(var(--chart-axis))",
  tooltipCursor: "hsl(var(--chart-cursor) / 0.18)",
  legendFallback: "hsl(var(--chart-legend-fallback))",
  background: "hsl(var(--background))",
  primary: "hsl(var(--chart-brand-primary))",
  primaryMuted: "hsl(var(--chart-brand-primary) / 0.6)",
} as const;

export const PERCEPTION_VISIBLE_AXES = [
  "positioning",
  "use_cases",
  "features",
  "sentiment",
  "competitors",
] as const;

export const PERCEPTION_AXIS_LABELS = {
  positioning: "Positionnement",
  use_cases: "Use Cases",
  features: "Features",
  sentiment: "Sentiment",
  competitors: "Concurrents",
} as const;

export const PERCEPTION_PERIOD_LABELS = {
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  "last-run": "Dernière exécution",
} as const;

export const PERCEPTION_TEXT = {
  donut: {
    title: "Perception de votre marque",
    subtitle: "Ecart entre votre Brand Canon et ce que les IA expriment le plus souvent",
    scoreCaption: "score perception",
  },
  heatmap: {
    title: "Heatmap Modèle × Axe",
    description: "Compare quels modèles comprennent le mieux chaque axe de perception.",
    modelColumn: "Modèle",
    grades: {
      excellent: "Excellent",
      good: "Bon",
      medium: "Moyen",
      low: "Faible",
    },
  },
  trend: {
    title: "Trend Perception",
    descriptionPrefix: "Évolution de Positioning / Factual / Sentiment sur",
    descriptionSuffix: "pour mesurer l'impact des actions Optimize.",
    series: {
      positioning: "Positioning",
      factual: "Factual",
      sentiment: "Sentiment",
    },
  },
  scoreCards: {
    positioning: {
      title: "Positioning Accuracy",
      hint: "% IA qui catégorisent correctement",
    },
    factual: {
      title: "Factual Accuracy",
      hint: "% réponses sans erreur features",
    },
    sentiment: {
      title: "Sentiment Score",
      hint: "Score 0-100",
    },
  },
  leftPanel: {
    title: "Brand Canon",
    source: {
      project: "Projet",
      fallback: "Fallback",
      demo: "Demo",
    },
    helper: "Référence utilisée pour comparer ce que les IA disent vs la réalité de la marque.",
  },
  brandCanon: {
    labels: {
      brand: "Marque",
      category: "Catégorie réelle",
      positioning: "Positionnement de référence",
      audience: "Audience cible",
      useCases: "Use Cases prioritaires",
      features: "Fonctionnalités que l’IA doit citer",
    },
    empty: "Non renseigné",
    demoHint: "Mode demo : vous pouvez éditer le Brand Canon sur la page dédiée (non persisté).",
    projectHint: "Astuce : mettez ici des formulations simples et factuelles pour réduire les erreurs IA.",
  },
  filters: {
    title: "Filtres",
    models: "Modèles",
    all: "Tous",
    clear: "Clear",
    showMore: "Voir plus",
    showLess: "Voir moins",
    period: "Période",
    businessOption: "Option métier Perception",
  },
  optimizeActions: {
    title: "Actions Optimize générées",
    description: "Les boutons [Fix] à droite créent des brouillons d'actions exploitables.",
    empty: "Aucune action générée pour le moment. Cliquez sur [Fix] dans la colonne de droite.",
    statusPrefix: "status",
    createActionError: "Impossible de créer l'action Optimize",
  },
  topErrors: {
    title: "Top erreurs détectées",
    totalPrefix: "total:",
    emptyTitle: "Aucune erreur détectée",
    emptyDescription: "Les réponses IA analysées sont alignées avec votre Brand Canon pour les filtres sélectionnés.",
    seeMore: "Voir plus",
    sheetDescription: "Détail de l'erreur détectée et action Optimize recommandée.",
    aiClaim: "Ce que l’IA dit",
    impact: "Impact",
    generatedFix: "Contenu généré (Fix)",
    added: "Ajouté",
    fix: "Fix",
    errorPrefix: "Erreur #",
    severity: {
      high: "Critique",
      medium: "Moyenne",
      low: "Faible",
    },
  },
} as const;

export const PERCEPTION_SCORE_CARD_COLORS = {
  positioning: {
    accent: "hsl(var(--chart-perception-positioning))",
    accentSoft: "hsl(var(--chart-perception-positioning) / 0.18)",
    ring: "hsl(var(--chart-perception-positioning) / 0.95)",
  },
  factual: {
    accent: "hsl(var(--chart-perception-factual))",
    accentSoft: "hsl(var(--chart-perception-factual) / 0.18)",
    ring: "hsl(var(--chart-perception-factual) / 0.95)",
  },
  sentiment: {
    accent: "hsl(var(--chart-perception-sentiment))",
    accentSoft: "hsl(var(--chart-perception-sentiment) / 0.18)",
    ring: "hsl(var(--chart-perception-sentiment) / 0.95)",
  },
  ringTrack: "hsl(var(--muted) / 0.5)",
} as const;

export const PERCEPTION_DONUT_COLORS = {
  axis: {
    positioning: "hsl(var(--chart-perception-positioning))",
    use_cases: "hsl(var(--chart-perception-use-cases))",
    sentiment: "hsl(var(--chart-perception-sentiment))",
    features: "hsl(var(--chart-perception-features))",
    competitors: "hsl(var(--chart-perception-competitors))",
  },
  primary: APP_CHART_UI_COLORS.primary,
  primaryMuted: APP_CHART_UI_COLORS.primaryMuted,
  background: APP_CHART_UI_COLORS.background,
  shadow: APP_CHART_UI_COLORS.primary,
} as const;

export const PERCEPTION_HEATMAP_AXIS_COLORS: Record<string, string> = {
  positioning: "hsl(var(--chart-perception-positioning))",
  use_cases: "hsl(var(--chart-perception-use-cases))",
  features: "hsl(var(--chart-perception-features))",
  sentiment: "hsl(var(--chart-perception-sentiment))",
  competitors: "hsl(var(--chart-perception-competitors))",
};

export const PERCEPTION_TREND_COLORS = {
  positioning: "hsl(var(--chart-perception-positioning))",
  factual: "hsl(var(--chart-perception-factual))",
  sentiment: "hsl(var(--chart-perception-sentiment))",
} as const;

export function getModelIconForName(modelName: string): string {
  const normalized = modelName.toLowerCase();
  if (normalized.includes("chatgpt") || normalized.includes("openai")) return "/models/openai.svg";
  if (normalized.includes("perplexity")) return "/models/perplexity.svg";
  if (normalized.includes("claude")) return "/models/claude.svg";
  if (normalized.includes("gemini")) return "/models/gemini.svg";
  if (normalized.includes("mistral")) return "/models/mistral.svg";
  if (normalized.includes("copilot")) return "/models/copilot.svg";
  return "/models/openai.svg";
}
