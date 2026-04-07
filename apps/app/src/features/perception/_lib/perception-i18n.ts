import type {
  PerceptionAxisKey,
  PerceptionSeverity,
  PerceptionTrendPeriodKey,
} from "@/lib/perception-data";
import { translateI18nText } from "@/shared/hooks/use-i18n";

type SupportedLocale = "en" | "fr";

const PERIOD_TRANSLATION_KEYS: Record<PerceptionTrendPeriodKey, string> = {
  all: "periodAll",
  "7d": "period7d",
  "30d": "period30d",
  "90d": "period90d",
  "last-run": "periodLastRun",
};

const AXIS_TRANSLATION_KEYS: Record<PerceptionAxisKey, string> = {
  positioning: "axisPositioning",
  pricing: "axisPricing",
  use_cases: "axisUseCases",
  features: "axisFeatures",
  sentiment: "axisSentiment",
  competitors: "axisCompetitors",
};

const PRIORITY_TRANSLATION_KEYS = {
  high: "priorityHigh",
  medium: "priorityMedium",
  low: "priorityLow",
} as const;

const STATUS_TRANSLATION_KEYS = {
  draft: "statusDraft",
  published: "statusPublished",
  processing: "statusProcessing",
  done: "statusDone",
} as const;

const FIX_TYPE_TRANSLATION_KEYS = {
  prompt_patch: "fixTypePromptPatch",
  website_copy: "fixTypeWebsiteCopy",
  schema_update: "fixTypeSchemaUpdate",
  faq_snippet: "fixTypeFaqSnippet",
} as const;

const ERROR_TYPE_TRANSLATION_KEYS = {
  positioning_gap: "errorTypePositioningGap",
  citation_gap: "errorTypeCitationGap",
  use_case_gap: "errorTypeUseCaseGap",
  sentiment_gap: "errorTypeSentimentGap",
  competitive_gap: "errorTypeCompetitiveGap",
  pricing_gap: "errorTypePricingGap",
  wrong_category: "errorTypeWrongCategory",
  missing_feature: "errorTypeMissingFeature",
  competitor_misattribution: "errorTypeCompetitorMisattribution",
} as const;

const SEVERITY_TRANSLATION_KEYS: Record<PerceptionSeverity, string> = {
  high: "topErrorsSeverityHigh",
  medium: "topErrorsSeverityMedium",
  low: "topErrorsSeverityLow",
};

function normalizeLocale(locale: string): SupportedLocale {
  return locale.toLowerCase().startsWith("fr") ? "fr" : "en";
}

function sentenceCase(value: string): string {
  const normalized = value.replace(/_/g, " ").trim();
  if (!normalized) return "";
  return `${normalized[0]?.toUpperCase() ?? ""}${normalized.slice(1)}`;
}

function translatePerception(
  key: string,
  locale: string,
  options?: Record<string, unknown>,
): string {
  return translateI18nText("perception", key, normalizeLocale(locale), options);
}

function formatMappedPerceptionLabel(
  value: string,
  locale: string,
  keyMap: Record<string, string>,
): string {
  const normalized = value.trim().toLowerCase();
  const key = keyMap[normalized];
  if (!key) {
    return sentenceCase(value);
  }
  return translatePerception(key, locale);
}

export function getPerceptionPeriodLabel(
  period: PerceptionTrendPeriodKey,
  locale: string,
): string {
  return translatePerception(PERIOD_TRANSLATION_KEYS[period], locale);
}

export function getPerceptionPeriodBadgeLabel(
  period: PerceptionTrendPeriodKey,
  locale: string,
): string {
  if (period === "last-run") {
    return translatePerception("periodBadgeLastRun", locale);
  }

  return getPerceptionPeriodLabel(period, locale);
}

export function buildPerceptionPeriodOptions(locale: string): Array<{
  value: PerceptionTrendPeriodKey;
  label: string;
}> {
  return (Object.keys(PERIOD_TRANSLATION_KEYS) as PerceptionTrendPeriodKey[]).map((value) => ({
    value,
    label: getPerceptionPeriodLabel(value, locale),
  }));
}

export function getPerceptionAxisLabel(axis: PerceptionAxisKey, locale: string): string {
  return translatePerception(AXIS_TRANSLATION_KEYS[axis], locale);
}

export function getPerceptionGradeLabel(score: number, locale: string): string {
  if (score >= 90) return translatePerception("gradeExcellent", locale);
  if (score >= 80) return translatePerception("gradeVeryGood", locale);
  if (score >= 65) return translatePerception("gradeGood", locale);
  if (score >= 50) return translatePerception("gradeFragile", locale);
  return translatePerception("gradeInsufficient", locale);
}

export function getPerceptionHeatmapGradeLabel(score: number, locale: string): string {
  if (score >= 80) return translatePerception("heatmapGradeExcellent", locale);
  if (score >= 65) return translatePerception("heatmapGradeGood", locale);
  if (score >= 50) return translatePerception("heatmapGradeMedium", locale);
  return translatePerception("heatmapGradeLow", locale);
}

export function formatPerceptionPriorityLabel(value: string, locale: string): string {
  return formatMappedPerceptionLabel(value, locale, PRIORITY_TRANSLATION_KEYS);
}

export function formatPerceptionStatusLabel(value: string, locale: string): string {
  return formatMappedPerceptionLabel(value, locale, STATUS_TRANSLATION_KEYS);
}

export function formatPerceptionFixTypeLabel(value: string, locale: string): string {
  return formatMappedPerceptionLabel(value, locale, FIX_TYPE_TRANSLATION_KEYS);
}

export function formatPerceptionErrorTypeLabel(value: string, locale: string): string {
  return formatMappedPerceptionLabel(value, locale, ERROR_TYPE_TRANSLATION_KEYS);
}

export function getPerceptionSeverityLabel(
  severity: PerceptionSeverity,
  locale: string,
): string {
  return translatePerception(SEVERITY_TRANSLATION_KEYS[severity], locale);
}
