import { translateI18nText } from "@/shared/hooks/use-i18n";
import i18n from "@/shared/i18n";
import type { MonitoringPrompt } from "../shared/monitoring-data";

export function getAlertTypeLabel(
  value: string | undefined,
  content?: Record<string, string>,
): string {
  const key = (value || "").trim().toLowerCase();
  if (!key) return "";

  const labels: Record<string, string> = {
    visibility_drop: content?.alertTypeVisibilityDrop || "Visibility drop",
    competitor_surge: content?.alertTypeCompetitorSurge || "Competitor surge",
    ranking_loss: content?.alertTypeRankingLoss || "Ranking loss",
    sentiment_drop: content?.alertTypeSentimentDrop || "Sentiment drop",
    factual_error_spike: content?.alertTypeFactualErrorSpike || "Factual error spike",
    mention_drop: content?.alertTypeMentionDrop || "Mention drop",
    citation_drop: content?.alertTypeCitationDrop || "Citation drop",
    pricing_mismatch: content?.alertTypePricingMismatch || "Pricing mismatch",
  };

  return labels[key] || key.replace(/_/g, " ");
}

export function getSentimentMeta(
  value: MonitoringPrompt["sentiment"],
  content: Record<string, string>,
) {
  const locale = i18n.resolvedLanguage || i18n.language || "fr";
  if (value === "positive") {
    return {
      label:
        content.sentimentPositive ||
        translateI18nText("monitoring-activity-panel", "sentimentPositive", locale),
      toneClass: "text-emerald-700",
      badgeClass: "bg-emerald-50 text-emerald-700",
    };
  }

  if (value === "negative") {
    return {
      label:
        content.sentimentNegative ||
        translateI18nText("monitoring-activity-panel", "sentimentNegative", locale),
      toneClass: "text-rose-700",
      badgeClass: "bg-rose-50 text-rose-700",
    };
  }

  return {
    label:
      content.sentimentNeutral ||
      translateI18nText("monitoring-activity-panel", "sentimentNeutral", locale),
    toneClass: "text-amber-700",
    badgeClass: "bg-amber-50 text-amber-700",
  };
}

export function getScoreToneClass(score: number): string {
  if (score >= 80) return "text-primary";
  if (score >= 55) return "text-amber-700";
  return "text-rose-700";
}
