import type {
  PerceptionRadarPoint,
  PerceptionTrendPoint,
} from "@/lib/perception-data";
import { translateI18nText } from "@/shared/hooks/use-i18n";

import { getPerceptionAxisLabel } from "./perception-i18n";

export type PerceptionHeroInsight = {
  brandName: string;
  title: string;
  summary: string;
  microCopy: string;
  metricValue: string;
  metricLabel: string;
  momentumLabel: string;
  momentumTone: "up" | "stable" | "down";
  trend: number[];
  scopeLabel: string;
  extraLabel?: string;
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildTrendValues(points: PerceptionTrendPoint[]) {
  return points.map((point) =>
    average([point.positioning, point.factual, point.sentiment]),
  );
}

function getMomentumTone(delta: number): PerceptionHeroInsight["momentumTone"] {
  if (delta >= 3) return "up";
  if (delta <= -3) return "down";
  return "stable";
}

function getMomentumLabel(delta: number, locale: string) {
  if (Math.abs(delta) < 3) {
    return translateI18nText(
      "perception-brand-canon",
      "heroMomentumStable",
      locale,
    );
  }

  return translateI18nText("perception-brand-canon", "heroMomentumPoints", locale, {
    delta: `${delta > 0 ? "+" : ""}${delta}`,
  });
}

function getAxisSentence(
  strongestAxis: PerceptionRadarPoint | null,
  weakestAxis: PerceptionRadarPoint | null,
  locale: string,
) {
  if (!strongestAxis && !weakestAxis) {
    return translateI18nText("perception-brand-canon", "heroNoSignals", locale);
  }
  if (!strongestAxis) {
    return translateI18nText("perception-brand-canon", "heroWeakestOnly", locale, {
      label: weakestAxis ? getPerceptionAxisLabel(weakestAxis.axis, locale) : "",
    });
  }
  if (!weakestAxis || strongestAxis.axis === weakestAxis.axis) {
    return translateI18nText("perception-brand-canon", "heroStrongestLeads", locale, {
      label: getPerceptionAxisLabel(strongestAxis.axis, locale),
    });
  }

  return translateI18nText("perception-brand-canon", "heroStrongestNeedsWork", locale, {
    strongest: getPerceptionAxisLabel(strongestAxis.axis, locale),
    weakest: getPerceptionAxisLabel(weakestAxis.axis, locale).toLowerCase(),
  });
}

export function buildPerceptionHeroInsight(
  radar: PerceptionRadarPoint[],
  trendPoints: PerceptionTrendPoint[],
  meta: {
    windowLabel: string;
    analyzedResponses: number;
  },
  locale: string,
): PerceptionHeroInsight {
  const overallScore = average(radar.map((point) => point.score));
  const alignedAxesCount = radar.filter((point) => point.score >= point.target).length;
  const strongestAxis =
    radar.length > 0
      ? [...radar].sort((left, right) => right.score - left.score)[0]
      : null;
  const weakestAxis =
    radar.length > 0
      ? [...radar].sort((left, right) => left.score - right.score)[0]
      : null;
  const trend = buildTrendValues(trendPoints);
  const firstTrend = trend[0] ?? overallScore;
  const lastTrend = trend[trend.length - 1] ?? overallScore;
  const momentumDelta = lastTrend - firstTrend;
  const totalAxes = radar.length;
  const metricValue = totalAxes > 0 ? `${alignedAxesCount}/${totalAxes}` : "--";
  const strongestLabel = strongestAxis
    ? getPerceptionAxisLabel(strongestAxis.axis, locale)
    : "";
  const responsesLabel = translateI18nText(
    "perception-brand-canon",
    "heroResponsesAnalyzed",
    locale,
    { count: meta.analyzedResponses },
  );

  return {
    brandName: `${overallScore}/100`,
    title: translateI18nText("perception-brand-canon", "heroScoreTitle", locale),
    summary: strongestAxis
      ? translateI18nText("perception-brand-canon", "heroBestAxisSummary", locale, {
          label: strongestLabel,
        })
      : "",
    microCopy: getAxisSentence(strongestAxis, weakestAxis, locale),
    metricValue,
    metricLabel: translateI18nText("perception-brand-canon", "heroMetricLabel", locale),
    momentumLabel: getMomentumLabel(momentumDelta, locale),
    momentumTone: getMomentumTone(momentumDelta),
    trend: trend.length > 0 ? trend : [overallScore],
    scopeLabel: meta.windowLabel,
    extraLabel: responsesLabel,
  };
}
