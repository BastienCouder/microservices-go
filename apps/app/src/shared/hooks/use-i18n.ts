type Dictionary = Record<string, string>;

const DASHBOARD_ANALYTICS_PANEL: Dictionary = {
  autoInsightsTitle: "Insights automatiques",
  autoInsightsDescription: "Observations clés détectées à partir des tendances de visibilité et de citations.",
  kpiMentionRateTitle: "Taux de mention",
  kpiVisibilityScoreTitle: "Score de visibilité",
  kpiAvgPositionTitle: "Rang moyen",
  mentionRateSubSuffix: "prompts incluent votre marque",
  trendVs7dSuffix: "vs 7j",
  betterPositionLabel: "meilleure position",
  visibilityScoreSub: "Score combiné mention × position × sentiment",
  avgPositionSub: "Sur toutes les réponses où vous êtes cité",
  visibilityAnalyticsTitle: "Analyse de visibilité",
  visibilityAnalyticsDescription: "Suivez l'évolution de la visibilité de votre marque sur les modèles IA sélectionnés.",
  aiSentimentTitle: "Sentiment IA",
  aiSentimentDescription: "Répartition positive, neutre et négative avec score de fiabilité factuelle.",
  factualAccuracyLabel: "Fiabilité factuelle",
  sentimentPositive: "Positif",
  sentimentNeutral: "Neutre",
  sentimentNegative: "Négatif",
  topCitedPagesTitle: "Pages les plus citées",
  topCitedPagesDescription: "Couverture de citation sur les URLs les plus référencées.",
  top3Coverage: "Couverture top 3",
  longTailPages: "Pages longue traîne",
  insightCitationsLabel: "Citations",
  brandVisibilityTitle: "Visibilité de la marque",
  brandVisibilityDescription: "Suivez les performances de votre marque dans le temps face à vos concurrents",
  topBrands: "Top marques",
  byVisibility: "par visibilité",
  mentions: "mentions",
  noDataAvailable: "Aucune donnée disponible",
};

const DASHBOARD_FILTERS_PANEL: Dictionary = {
  brandControl: "Marque actuelle",
  changeBrand: "Modifier la marque",
  export: "Exporter les données",
  exporting: "Export en cours...",
  filters: "Filtres",
  filterScope: "Périmètre des filtres",
  period: "Période",
  personas: "Personas",
  models: "Modèles",
  clear: "Supprimer",
  clearPersonas: "Effacer",
  clearCompetitors: "Effacer",
  resetFilters: "Réinitialiser les filtres",
  topCompetitors: "Top concurrents (SOV)",
  showLess: "Voir moins",
  showMore: "Voir plus",
  noDataAvailable: "Aucune donnée disponible",
  useGlobalPeriod: "Utiliser la période globale",
  today24h: "Aujourd'hui (24h)",
  last7Days: "7 derniers jours",
  last14Days: "14 derniers jours",
  last30Days: "30 derniers jours",
  last3Months: "3 derniers mois",
  filterScopeTitle: "Périmètre des filtres",
  scopedWidgets: "Widgets ciblés",
  resetScope: "Réinitialiser les filtres",
  kpiCardsPeriod: "Période des cartes KPI",
  visibilityAnalyticsPeriod: "Période visibility analytics",
  competitorAnalyticsPeriod: "Période competitor analytics",
  scopeCriticalUpdates: "Mises à jour critiques",
  scopePromptsStream: "Flux de prompts",
  scopeKpiCards: "Cartes KPI",
  scopeVisibilityAnalytics: "Visibility analytics",
  scopeBrandVisibility: "Visibilité de la marque",
  scopeAiSentiment: "Sentiment IA",
  scopeTopCitedPages: "Pages les plus citées",
  scopeAutoInsights: "Insights automatiques",
  exportCenter: "Centre d'export",
  exportGuide: "1. Choisir un preset  2. Choisir un format  3. Exporter",
  preset: "Preset",
  format: "Format",
  customDatasets: "Datasets personnalisés",
  all: "Tout",
  noDatasetSelected: "Aucun dataset sélectionné",
  selectedSuffix: "dataset(s) sélectionné(s)",
  showAdvancedOptions: "Afficher les options avancées",
  hideAdvancedOptions: "Masquer les options avancées",
  alertsUnreadOnly: "Alertes : non lus uniquement",
  runsLimit: "Limite des runs (1-500)",
  datasetKpis: "Cartes KPI",
  datasetPromptRuns: "Flux de prompts",
  datasetAlerts: "Mises à jour critiques",
  datasetCompetitors: "Concurrents",
  datasetVisibility: "Visibility analytics",
  datasetRuns: "Runs d'analyse",
  datasetPrompts: "Prompts du projet",
  datasetDashboard: "Snapshot dashboard",
  helperUnreadOnly: "Option non lu uniquement disponible",
  helperLimitOption: "Option de limite disponible",
  presetEssentials: "Essentiels",
  presetEssentialsDesc: "KPI + prompts + alertes + concurrents",
  presetExecutive: "Exécutif",
  presetExecutiveDesc: "Snapshot dashboard pour le management",
  presetRaw: "Données brutes",
  presetRawDesc: "Dataset détaillé pour BI/Excel",
  exportFailed: "Échec de l'export",
  selectAtLeastOneDataset: "Sélectionne au moins un dataset à exporter.",
};

const DASHBOARD_ACTIVITY_PANEL: Dictionary = {
  criticalUpdates: "Mises à jour critiques",
  promptsStream: "Flux de prompts",
  noPromptsFound: "Aucun prompt trouvé.",
  showMore: "Voir plus",
  mentioned: "Mentionné",
  missed: "Manqué",
  rankTop: "Rang #1",
  alertInsight: "Insight alerte",
  triggerPrompt: "Prompt déclencheur",
  score: "Score",
  mentions: "Mentions",
  rank: "Rang",
  competitors: "Concurrents",
  notAvailable: "N/A",
  noDataAvailable: "Aucune donnée disponible",
  ignore: "Ignorer",
  optimize: "Optimiser",
  detailedAnalysis: "Analyse détaillée",
  createOptimizeAction: "Créer une action d'optimisation",
  copyPrompt: "Copier le prompt",
  userPrompt: "Prompt utilisateur",
  responseWithHighlights: "Réponse avec points clés",
  visibility: "Visibilité",
  mention: "Mention",
  yes: "OUI",
  no: "NON",
  markAsReviewed: "Marquer comme revu",
  createCorrectionTask: "Créer une tâche de correction",
};

const CONTENT_BY_NAMESPACE: Record<string, Dictionary> = {
  "dashboard-analytics-panel": DASHBOARD_ANALYTICS_PANEL,
  "dashboard-filters-panel": DASHBOARD_FILTERS_PANEL,
  "dashboard-activity-panel": DASHBOARD_ACTIVITY_PANEL,
};

function humanizeKey(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

export function useI18nScope(namespace?: string): Dictionary {
  const scoped = namespace ? CONTENT_BY_NAMESPACE[namespace] : undefined;

  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop !== "string") return "";
        if (scoped && prop in scoped) return scoped[prop] ?? "";
        return humanizeKey(prop);
      },
    },
  ) as Dictionary;
}

export function useLocale(): { locale: string } {
  if (typeof navigator === "undefined") {
    return { locale: "fr" };
  }
  const locale = navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
  return { locale };
}
