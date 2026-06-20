import type { PerceptionResponseRecord } from "./shared/perception-data";

export function averagePerceptionResponseScore(response: PerceptionResponseRecord) {
  const values = Object.values(response.metrics);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export function formatPerceptionResponseTime(value: string | null, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "2-digit" }),
  });
}

export function getWeakestPerceptionAxis(response: PerceptionResponseRecord) {
  return Object.entries(response.metrics).reduce(
    (weakest, [axis, score]) => (score < weakest.score ? { axis, score } : weakest),
    { axis: "positioning", score: response.metrics.positioning },
  );
}
