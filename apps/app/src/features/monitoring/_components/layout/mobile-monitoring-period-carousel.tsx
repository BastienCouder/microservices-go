"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/hooks/use-i18n";

import { getMonitoringPeriodOptions } from "../../_lib/shared/monitoring-periods";

type MobileMonitoringPeriodCarouselProps = {
  value: string;
  onValueChange: (value: string) => void;
};

export function MobileMonitoringPeriodCarousel({
  value,
  onValueChange,
}: MobileMonitoringPeriodCarouselProps) {
  const { locale } = useLocale();
  const options = getMonitoringPeriodOptions(locale);

  return (
    <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
      <div className="flex w-max snap-x snap-mandatory gap-2 pb-1 pr-4">
        {options.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onValueChange(option.value)}
              className={cn(
                "flex min-h-14 min-w-[96px] snap-start flex-col items-start justify-center rounded-[20px] border px-4 py-3 text-left transition-all",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-[0_16px_36px_-20px_hsl(var(--primary)/0.9)]"
                  : "border-slate-200/80 bg-white text-slate-900 shadow-sm",
              )}
              aria-pressed={isActive}
            >
              <span
                className={cn(
                  "text-sm font-semibold tracking-tight",
                  isActive ? "text-primary-foreground" : "text-slate-950",
                )}
              >
                {option.label}
              </span>
              <span
                className={cn(
                  "text-[11px]",
                  isActive ? "text-primary-foreground/75" : "text-slate-500",
                )}
              >
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
