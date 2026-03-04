export const APP_CHART_PALETTE = [
  "hsl(186 49% 62%)",
  "hsl(204 40% 47%)",
  "hsl(221 39% 34%)",
  "hsl(200 63% 68%)",
  "hsl(230 53% 58%)",
  "hsl(213 29% 45%)",
  "hsl(193 34% 56%)",
] as const;

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

export const DASHBOARD_TEXT = {
  chartConfig: {
    models: {
      chatgpt: "ChatGPT",
      perplexity: "Perplexity",
      claude: "Claude",
      gemini: "Google Gemini",
      mistral: "Mistral",
      copilot: "Copilot",
    },
    brands: {
      brand: "Nike",
      comp1: "Ad",
      comp2: "Pu",
      other: "Others",
    },
    sentiment: {
      sentiment: "Positive",
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
  primary: APP_CHART_PALETTE[6],
  primaryMuted: "hsl(193 34% 56% / 0.6)",
} as const;

export const AI_SENTIMENT_COLORS = {
  positive: APP_CHART_PALETTE[0],
  neutral: APP_CHART_PALETTE[1],
  negative: APP_CHART_PALETTE[2],
  legendFallback: APP_CHART_UI_COLORS.legendFallback,
} as const;

export const VISIBILITY_ANALYTICS_COLORS = {
  series: APP_CHART_PALETTE,
  axisTick: APP_CHART_UI_COLORS.axisTick,
  tooltipCursor: APP_CHART_UI_COLORS.tooltipCursor,
  fallbackBar: APP_CHART_PALETTE[4],
} as const;

export const BRAND_VISIBILITY_COLORS = {
  primaryBrand: APP_CHART_PALETTE[0],
  competitors: APP_CHART_PALETTE.slice(1, 7),
  axis: APP_CHART_UI_COLORS.axisTick,
  tooltipCursor: "hsl(var(--muted) / 0.2)",
  legendFallback: APP_CHART_UI_COLORS.legendFallback,
} as const;

export const PERCEPTION_SCORE_CARD_COLORS = {
  positioning: {
    accent: APP_CHART_PALETTE[0],
    accentSoft: "hsl(186 49% 62% / 0.18)",
    ring: "hsl(186 49% 62% / 0.95)",
  },
  factual: {
    accent: APP_CHART_PALETTE[1],
    accentSoft: "hsl(204 40% 47% / 0.18)",
    ring: "hsl(204 40% 47% / 0.95)",
  },
  sentiment: {
    accent: APP_CHART_PALETTE[2],
    accentSoft: "hsl(221 39% 34% / 0.18)",
    ring: "hsl(221 39% 34% / 0.95)",
  },
  ringTrack: "hsl(var(--muted) / 0.5)",
} as const;

export const PERCEPTION_DONUT_COLORS = {
  axis: {
    positioning: APP_CHART_PALETTE[0],
    use_cases: APP_CHART_PALETTE[2],
    sentiment: APP_CHART_PALETTE[3],
    features: APP_CHART_PALETTE[4],
    competitors: APP_CHART_PALETTE[5],
  },
  primary: APP_CHART_UI_COLORS.primary,
  primaryMuted: APP_CHART_UI_COLORS.primaryMuted,
  background: APP_CHART_UI_COLORS.background,
  shadow: APP_CHART_UI_COLORS.primary,
} as const;

export const PERCEPTION_HEATMAP_AXIS_COLORS: Record<string, string> = {
  positioning: APP_CHART_PALETTE[0],
  use_cases: APP_CHART_PALETTE[2],
  features: APP_CHART_PALETTE[3],
  sentiment: APP_CHART_PALETTE[4],
  competitors: APP_CHART_PALETTE[5],
};

export const PERCEPTION_TREND_COLORS = {
  positioning: APP_CHART_PALETTE[0],
  factual: APP_CHART_PALETTE[1],
  sentiment: APP_CHART_PALETTE[2],
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
