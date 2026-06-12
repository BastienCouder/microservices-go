import {
  getAIModelFamilyLabel,
  getAIProviderIconPath,
} from "@/lib/ai-provider-assets";
import { translateI18nText } from "@/shared/hooks/use-i18n";
import i18n from "@/shared/i18n";

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

export const MONITORING_TEXT = {
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
  pricing: "Tarification",
  use_cases: "Cas d'usage",
  features: "Fonctionnalités",
  sentiment: "Sentiment",
  competitors: "Concurrents",
} as const;

export const PERCEPTION_PERIOD_LABELS = {
  all: "Depuis le début",
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  "last-run": "Dernière exécution",
} as const;

type PerceptionPeriodKey = keyof typeof PERCEPTION_PERIOD_LABELS;
type PerceptionAxisLabelKey = keyof typeof PERCEPTION_AXIS_LABELS;

function currentI18nLocale(): string {
  return i18n.resolvedLanguage || i18n.language || "fr";
}

export function getPerceptionPeriodLabel(period: PerceptionPeriodKey): string {
  const keyByPeriod: Record<PerceptionPeriodKey, string> = {
    all: "periodAll",
    "7d": "period7d",
    "30d": "period30d",
    "90d": "period90d",
    "last-run": "periodLastRun",
  };

  return translateI18nText("perception", keyByPeriod[period], currentI18nLocale());
}

export function getPerceptionAxisLabel(axis: PerceptionAxisLabelKey): string {
  const keyByAxis: Record<PerceptionAxisLabelKey, string> = {
    positioning: "axisPositioning",
    pricing: "axisPricing",
    use_cases: "axisUseCases",
    features: "axisFeatures",
    sentiment: "axisSentiment",
    competitors: "axisCompetitors",
  };

  return translateI18nText("perception", keyByAxis[axis], currentI18nLocale());
}

export const PERCEPTION_PERIOD_BADGE_LABELS = {
  all: "All",
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
  "last-run": "Run",
} as const;

export const PERCEPTION_TEXT = {
  donut: {
    title: "Perception de votre marque",
    subtitle: "Niveau d'alignement de votre marque dans les réponses IA.",
    scoreCaption: "score perception",
    overallLabel: "Score global",
    bestAxisLabel: "Point fort",
    weakestAxisLabel: "Point à renforcer",
    axisListTitle: "Classement des axes",
    axisListDescription: "Du mieux compris au plus fragile pour repérer immédiatement où agir.",
    alignedAxesLabel: "axes au niveau attendu",
    targetLabel: "Objectif",
    aboveTarget: "Objectif atteint",
    belowTarget: "À renforcer",
    grades: {
      insufficient: "Insuffisant",
      fragile: "Fragile",
      good: "Bien",
      veryGood: "Très bien",
      excellent: "Excellent",
    },
  },
  heatmap: {
    title: "Carte de chaleur modèle × axe",
    description: "Compare les modèles qui comprennent le mieux chaque axe de perception.",
    modelColumn: "Modèle",
    grades: {
      excellent: "Excellent",
      good: "Bon",
      medium: "Moyen",
      low: "Faible",
    },
  },
  trend: {
    title: "Évolution de la perception",
    descriptionPrefix: "Évolution de la clarté du positionnement, de la fiabilité des informations et de la tonalité des réponses sur la période",
    descriptionSuffix: "pour mesurer l'impact des actions d'optimisation.",
    series: {
      positioning: "Clarté du positionnement",
      factual: "Fiabilité des informations",
      sentiment: "Tonalité des réponses",
    },
    definitions: {
      positioning: "Capacité des IA à rattacher correctement la marque à sa catégorie et à sa promesse.",
      factual: "Fiabilité des informations utilisées par les IA, avec des réponses exactes et vérifiables.",
      sentiment: "Ton global employé par les IA quand elles parlent de votre marque, du négatif au positif.",
    },
  },
  scoreCards: {
    positioning: {
      title: "Clarté du positionnement",
      hint: "Score moyen actuel sur 100 de la clarté avec laquelle les IA rattachent la marque à son positionnement",
    },
    factual: {
      title: "Fiabilité des informations",
      hint: "Score moyen sur 100 du niveau de fiabilité et de vérifiabilité des informations utilisées",
    },
    sentiment: {
      title: "Tonalité des réponses",
      hint: "Score moyen sur 100 du ton employé par les IA quand elles parlent de votre marque",
    },
  },
  leftPanel: {
    title: "Profil de marque",
    tabs: {
      brand: "Marque",
      filters: "Filtres",
    },
    source: {
      project: "Projet",
      fallback: "Repli",
      demo: "Démo",
    },
    helper: "Référence utilisée pour comparer ce que les IA disent avec la réalité de la marque.",
    responsesLabel: "réponses analysées",
  },
  brandCanon: {
    labels: {
      brand: "Marque",
      category: "Catégorie réelle",
      positioning: "Positionnement de référence",
      audience: "Audience cible",
      useCases: "Cas d'usage prioritaires",
      features: "Fonctionnalités que l'IA doit citer",
    },
    empty: translateI18nText("perception-brand-canon", "summaryEmpty", currentI18nLocale()),
    demoHint: "Mode démo : vous pouvez modifier le référentiel sur la page dédiée, sans sauvegarde serveur.",
    projectHint: "Conseil : utilisez ici des formulations simples et factuelles pour réduire les erreurs des IA.",
  },
  filters: {
    title: "Filtres",
    models: "Modèles",
    all: "Tous",
    clear: "Effacer",
    reset: "Réinitialiser",
    groupedMode: "Regrouper IA",
    uniqueMode: "Par IA",
    showMore: "Voir plus",
    showLess: "Voir moins",
    period: "Période",
    noModels: "Aucun modèle disponible",
  },
  optimizeActions: {
    title: "Actions d'optimisation générées",
    description: "Les boutons [Créer une action] à droite créent des brouillons d'actions directement exploitables.",
    empty: "Aucune action générée pour le moment. Cliquez sur [Créer une action] dans la colonne de droite.",
    statusPrefix: "Statut",
    createActionError: "Impossible de créer l'action d'optimisation",
  },
  topErrors: {
    title: "Principales erreurs détectées",
    emptyTitle: "Aucune erreur détectée",
    seeMore: "Voir plus",
    sheetDescription: "Détail de l'erreur détectée et action d'optimisation recommandée.",
    aiClaim: "Ce que l'IA dit",
    impact: "Impact",
    generatedFix: "Correction proposée",
    added: "Ajoutée",
    fix: "Créer une action",
    markDone: "Marquer fait",
    errorPrefix: "Erreur n°",
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

export const PERCEPTION_AXIS_COLORS = {
  positioning: "hsl(var(--chart-perception-positioning))",
  use_cases: "hsl(var(--chart-perception-use-cases))",
  features: "hsl(var(--chart-perception-features))",
  sentiment: "hsl(var(--chart-perception-sentiment))",
  competitors: "hsl(var(--chart-perception-competitors))",
} as const;

export const PERCEPTION_DONUT_COLORS = {
  axis: PERCEPTION_AXIS_COLORS,
  primary: APP_CHART_UI_COLORS.primary,
  primaryMuted: APP_CHART_UI_COLORS.primaryMuted,
  background: APP_CHART_UI_COLORS.background,
  shadow: APP_CHART_UI_COLORS.primary,
} as const;

export const PERCEPTION_HEATMAP_AXIS_COLORS: Record<string, string> = PERCEPTION_AXIS_COLORS;

export const PERCEPTION_TREND_COLORS = {
  positioning: "hsl(var(--chart-perception-positioning))",
  factual: "hsl(var(--chart-perception-factual))",
  sentiment: "hsl(var(--chart-perception-sentiment))",
} as const;

export const PERCEPTION_PRIORITY_LABELS = {
  high: "Élevée",
  medium: "Moyenne",
  low: "Faible",
} as const;

export const PERCEPTION_STATUS_LABELS = {
  draft: "Brouillon",
  published: "Publiée",
  processing: "En cours",
  done: "Terminée",
} as const;

export const PERCEPTION_FIX_TYPE_LABELS = {
  prompt_patch: "Ajustement de prompt",
  website_copy: "Mise à jour du site",
  schema_update: "Mise à jour du schema",
  faq_snippet: "Extrait de FAQ",
} as const;

export const PERCEPTION_ERROR_TYPE_LABELS = {
  positioning_gap: "Écart de positionnement",
  citation_gap: "Manque de citations",
  use_case_gap: "Écart sur les cas d'usage",
  sentiment_gap: "Écart de sentiment",
  competitive_gap: "Écart concurrentiel",
  pricing_gap: "Écart tarifaire",
  wrong_category: "Mauvaise catégorie",
  missing_feature: "Fonctionnalité absente",
  competitor_misattribution: "Confusion concurrentielle",
} as const;

function sentenceCase(value: string): string {
  if (!value) return "";
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}

export function formatPerceptionPriorityLabel(value: string): string {
  const normalized = value.trim().toLowerCase() as keyof typeof PERCEPTION_PRIORITY_LABELS;
  return PERCEPTION_PRIORITY_LABELS[normalized] ?? sentenceCase(value);
}

export function formatPerceptionStatusLabel(value: string): string {
  const normalized = value.trim().toLowerCase() as keyof typeof PERCEPTION_STATUS_LABELS;
  return PERCEPTION_STATUS_LABELS[normalized] ?? sentenceCase(value.replace(/_/g, " "));
}

export function formatPerceptionFixTypeLabel(value: string): string {
  const normalized = value.trim().toLowerCase() as keyof typeof PERCEPTION_FIX_TYPE_LABELS;
  return PERCEPTION_FIX_TYPE_LABELS[normalized] ?? sentenceCase(value.replace(/_/g, " "));
}

export function formatPerceptionErrorTypeLabel(value: string): string {
  const normalized = value.trim().toLowerCase() as keyof typeof PERCEPTION_ERROR_TYPE_LABELS;
  return PERCEPTION_ERROR_TYPE_LABELS[normalized] ?? sentenceCase(value.replace(/_/g, " "));
}

export function getModelGroupForName(modelName: string): string {
  return getAIModelFamilyLabel(modelName, modelName);
}

export function getModelIconForName(modelName: string): string {
  return getAIProviderIconPath(modelName);
}
