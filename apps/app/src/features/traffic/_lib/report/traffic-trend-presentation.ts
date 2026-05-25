import type { TrafficDailyPoint } from "./types";

type TrafficTrendPresentation = {
  points: TrafficDailyPoint[];
  showEveryLabel: number;
  labelClassName: string;
  chartClassName: string;
  barGapClassName: string;
};

const mobileMaxPoints = 5;

export function getTrafficTrendPresentation(
  points: TrafficDailyPoint[],
  isMobile: boolean,
): TrafficTrendPresentation {
  const maxPoints = isMobile ? mobileMaxPoints : 10;
  const visiblePoints = points.slice(-maxPoints);
  const showEveryLabel = isMobile ? 1 : (visiblePoints.length > 6 ? 2 : 1);

  return {
    points: visiblePoints,
    showEveryLabel,
    labelClassName: isMobile
      ? "w-full text-center text-[10px] leading-tight"
      : "w-full text-center text-[10px] leading-tight",
    chartClassName: isMobile ? "h-44 px-2 pb-6 pt-4" : "h-40 px-3 pb-5 pt-4",
    barGapClassName: isMobile ? "gap-1.5" : "gap-2",
  };
}
