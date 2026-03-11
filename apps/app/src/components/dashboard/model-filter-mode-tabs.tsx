"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  groupedLabel = "Regrouper IA",
  uniqueLabel = "Par IA",
  className = "flex-col",
  listClassName = "h-8 w-full",
}: ModelFilterModeTabsProps) {
  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as "grouped" | "unique")} className={className}>
      <TabsList className={listClassName}>
        <TabsTrigger value="grouped" className="px-2 text-[10px] lg:text-[10px]">
          {groupedLabel}
        </TabsTrigger>
        <TabsTrigger value="unique" className="px-2 text-[10px] lg:text-[10px]">
          {uniqueLabel}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
