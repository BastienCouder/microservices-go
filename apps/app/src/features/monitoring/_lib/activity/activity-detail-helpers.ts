import type { MonitoringPrompt } from "@/hooks/use-monitoring-data";

export function getAlertTypeLabel(value?: string): string {
  const key = (value || "").trim().toLowerCase();
  if (!key) return "";

  const labels: Record<string, string> = {
    visibility_drop: "Baisse de visibilite",
    competitor_surge: "Concurrence en hausse",
    ranking_loss: "Perte de position",
    sentiment_drop: "Baisse de sentiment",
    factual_error_spike: "Hausse des erreurs factuelles",
    mention_drop: "Baisse des mentions",
    citation_drop: "Baisse des citations",
    pricing_mismatch: "Decalage pricing",
  };

  return labels[key] || key.replace(/_/g, " ");
}

export function getSentimentMeta(
  value: MonitoringPrompt["sentiment"],
  content: Record<string, string>,
) {
  if (value === "positive") {
    return {
      label: content.sentimentPositive || "Positif",
      toneClass: "text-emerald-700",
      badgeClass: "bg-emerald-50 text-emerald-700",
    };
  }

  if (value === "negative") {
    return {
      label: content.sentimentNegative || "Negatif",
      toneClass: "text-rose-700",
      badgeClass: "bg-rose-50 text-rose-700",
    };
  }

  return {
    label: content.sentimentNeutral || "Neutre",
    toneClass: "text-amber-700",
    badgeClass: "bg-amber-50 text-amber-700",
  };
}

export function getScoreToneClass(score: number): string {
  if (score >= 80) return "text-primary";
  if (score >= 55) return "text-amber-700";
  return "text-rose-700";
}
