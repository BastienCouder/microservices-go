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

export const APP_CHART_UI_COLORS = {
  axisTick: "hsl(var(--muted-foreground))",
  tooltipCursor: "hsl(var(--muted) / 0.18)",
  legendFallback: "hsl(var(--muted))",
  background: "hsl(var(--background))",
  primary: "hsl(193 34% 56%)",
  primaryMuted: "hsl(193 34% 56% / 0.6)",
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
    accent: "hsl(186 49% 62%)",
    accentSoft: "hsl(186 49% 62% / 0.18)",
    ring: "hsl(186 49% 62% / 0.95)",
  },
  factual: {
    accent: "hsl(204 40% 47%)",
    accentSoft: "hsl(204 40% 47% / 0.18)",
    ring: "hsl(204 40% 47% / 0.95)",
  },
  sentiment: {
    accent: "hsl(221 39% 34%)",
    accentSoft: "hsl(221 39% 34% / 0.18)",
    ring: "hsl(221 39% 34% / 0.95)",
  },
  ringTrack: "hsl(var(--muted) / 0.5)",
} as const;

export const PERCEPTION_DONUT_COLORS = {
  axis: {
    positioning: "hsl(186 49% 62%)",
    use_cases: "hsl(221 39% 34%)",
    sentiment: "hsl(200 63% 68%)",
    features: "hsl(230 53% 58%)",
    competitors: "hsl(213 29% 45%)",
  },
  primary: APP_CHART_UI_COLORS.primary,
  primaryMuted: APP_CHART_UI_COLORS.primaryMuted,
  background: APP_CHART_UI_COLORS.background,
  shadow: APP_CHART_UI_COLORS.primary,
} as const;

export const PERCEPTION_HEATMAP_AXIS_COLORS: Record<string, string> = {
  positioning: "hsl(186 49% 62%)",
  use_cases: "hsl(221 39% 34%)",
  features: "hsl(200 63% 68%)",
  sentiment: "hsl(230 53% 58%)",
  competitors: "hsl(213 29% 45%)",
};

export const PERCEPTION_TREND_COLORS = {
  positioning: "hsl(186 49% 62%)",
  factual: "hsl(204 40% 47%)",
  sentiment: "hsl(221 39% 34%)",
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
