import { memo, useMemo, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { cn } from "@/lib/utils";

type ModelFilterMode = "grouped" | "unique";

type ModelFilterModeTabsProps = {
  value: ModelFilterMode;
  onValueChange: (value: ModelFilterMode) => void;
  groupedLabel?: string;
  uniqueLabel?: string;
  className?: string;
  listClassName?: string;
  triggerClassName?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "compact";
};

const DEFAULT_CONFIGS = {
  size: {
    sm: { list: "h-7", trigger: "px-2 py-1 text-[10px]" },
    md: { list: "h-8", trigger: "px-3 py-1.5 text-xs" },
    lg: { list: "h-9", trigger: "px-4 py-2 text-sm" }
  },
  variant: {
    default: { list: "w-full", trigger: "" },
    compact: { list: "w-auto", trigger: "min-w-0" }
  }
} as const;

export const ModelFilterModeTabs = memo(function ModelFilterModeTabs({
  value,
  onValueChange,
  groupedLabel,
  uniqueLabel,
  className = "flex-col",
  listClassName,
  triggerClassName,
  disabled = false,
  size = "md",
  variant = "default",
}: ModelFilterModeTabsProps) {
  const content = useI18nScope("monitoring-filters-panel");
  
  const resolvedLabels = useMemo(() => ({
    grouped: groupedLabel ?? content.groupedAI,
    unique: uniqueLabel ?? content.byAI
  }), [groupedLabel, uniqueLabel, content.groupedAI, content.byAI]);

  const configClasses = useMemo(() => ({
    list: cn(
      DEFAULT_CONFIGS.size[size].list,
      DEFAULT_CONFIGS.variant[variant].list,
      listClassName
    ),
    trigger: cn(
      DEFAULT_CONFIGS.size[size].trigger,
      DEFAULT_CONFIGS.variant[variant].trigger,
      triggerClassName
    )
  }), [size, variant, listClassName, triggerClassName]);

  const handleValueChange = useCallback((newValue: string) => {
    if (!disabled && newValue !== value) {
      onValueChange(newValue as ModelFilterMode);
    }
  }, [disabled, value, onValueChange]);

  return (
    <Tabs 
      value={value} 
      onValueChange={handleValueChange} 
      className={cn(disabled && "opacity-50 pointer-events-none", className)}
    >
      <TabsList className={configClasses.list}>
        <TabsTrigger 
          value="grouped" 
          className={configClasses.trigger}
          disabled={disabled}
        >
          {resolvedLabels.grouped}
        </TabsTrigger>
        <TabsTrigger 
          value="unique" 
          className={configClasses.trigger}
          disabled={disabled}
        >
          {resolvedLabels.unique}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
});
