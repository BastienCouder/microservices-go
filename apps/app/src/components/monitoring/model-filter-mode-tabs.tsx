"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18nScope } from "@/shared/hooks/use-i18n";

type ModelFilterModeTabsProps = {
  value: "grouped" | "unique";
  onValueChange: (value: "grouped" | "unique") => void;
  groupedLabel?: string;
  uniqueLabel?: string;
  className?: string;
  listClassName?: string;
};

export function ModelFilterModeTabs({
  value,
  onValueChange,
  groupedLabel,
  uniqueLabel,
  className = "flex-col",
  listClassName = "h-8 w-full",
}: ModelFilterModeTabsProps) {
  const content = useI18nScope("monitoring-filters-panel");
  const resolvedGroupedLabel = groupedLabel ?? content.groupedAI;
  const resolvedUniqueLabel = uniqueLabel ?? content.byAI;

  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as "grouped" | "unique")} className={className}>
      <TabsList className={listClassName}>
        <TabsTrigger value="grouped" className="px-2 text-[10px] lg:text-[10px]">
          {resolvedGroupedLabel}
        </TabsTrigger>
        <TabsTrigger value="unique" className="px-2 text-[10px] lg:text-[10px]">
          {resolvedUniqueLabel}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
