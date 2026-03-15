type Dictionary = Record<string, string>;

const MONITORING_ANALYTICS_PANEL: Dictionary = {
  autoInsightsTitle: "Insights automatiques",
  autoInsightsDescription: "Observations clés détectées à partir des tendances de visibilité et de citations.",
  kpiMentionRateTitle: "Taux de mention",
  kpiVisibilityScoreTitle: "Score de visibilité",
  kpiAvgPositionTitle: "Rang moyen",
  mentionRateSubSuffix: "réponses mentionnent votre marque",
  trendVs7dSuffix: "vs 7j",
  betterPositionLabel: "meilleure position",
  visibilityScoreSub: "Score combiné mention × position × sentiment",
  avgPositionSub: "Sur toutes les réponses où vous êtes cité",
  visibilityAnalyticsTitle: "Analyse de visibilité",
  visibilityAnalyticsDescription: "Suivez l'évolution de la visibilité de votre marque sur les modèles IA sélectionnés.",
  aiSentimentTitle: "Ton des réponses IA",
  aiSentimentDescription: "Répartition des réponses qui mentionnent votre marque : positif, neutre ou négatif. Ce n'est pas un score unique.",
  factualAccuracyLabel: "Réponses avec citation",
  factualAccuracyDescription: "Part des réponses qui s'appuient sur au moins une source.",
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

const MONITORING_FILTERS_PANEL: Dictionary = {
  filters: "Filtres",
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
};

const MONITORING_ACTIVITY_PANEL: Dictionary = {
  criticalUpdates: "Mises à jour critiques",
  promptsStream: "Flux de prompts",
  noPromptsFound: "Aucun prompt trouvé.",
  showMore: "Voir plus",
  showLess: "Voir moins",
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
  close: "Fermer",
  detailedAnalysis: "Analyse détaillée",
  copyPrompt: "Copier le prompt",
  promptCopied: "Prompt copié",
  copyUnavailable: "Copie indisponible",
  userPrompt: "Prompt utilisateur",
  responseWithHighlights: "Signaux détectés",
  visibility: "Visibilité",
  mention: "Mention",
  responseTone: "Ton",
  citations: "Citations",
  pagesCited: "Pages citées",
  sourceCoverage: "Couverture des sources",
  analysisSummary: "Résumé d'analyse",
  model: "Modèle",
  persona: "Persona",
  factualAccuracyLabel: "Réponses avec citation",
  sentimentPositive: "Positif",
  sentimentNeutral: "Neutre",
  sentimentNegative: "Négatif",
  yes: "OUI",
  no: "NON",
};

const CONTENT_BY_NAMESPACE: Record<string, Dictionary> = {
  "monitoring-analytics-panel": MONITORING_ANALYTICS_PANEL,
  "monitoring-filters-panel": MONITORING_FILTERS_PANEL,
  "monitoring-activity-panel": MONITORING_ACTIVITY_PANEL,
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
