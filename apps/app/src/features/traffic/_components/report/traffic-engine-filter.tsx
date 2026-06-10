import { ChevronDown } from "lucide-react";

import { FloatingPanelHeader } from "@/components/ui/floating-panel-header";
import { Button } from "@/components/ui/button";
import { ModelCard } from "@/components/shared/model-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { getTrafficEngineIconPath } from "../../_lib/report/traffic-engine-assets";

type TrafficEngineFilterProps = {
  value: string;
  engines: string[];
  onValueChange: (value: string) => void;
};

export function TrafficEngineFilter({
  value,
  engines,
  onValueChange,
}: TrafficEngineFilterProps) {
  const { t } = useScopedI18n("traffic-report");
  const options = ["all", ...engines.filter((engine) => engine !== "all")];
  const currentLabel = value === "all" ? t("allEngines") : value;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full min-w-0 justify-between"
        >
          <span className="truncate">{currentLabel}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,32rem)] p-0">
        <FloatingPanelHeader title={t("enginesTitle")} />
        <div className="grid max-h-[360px] grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
          {options.map((engine) => {
            const label = engine === "all" ? t("allEngines") : engine;
            return (
              <ModelCard
                key={engine}
                name={engine === "all" ? t("allSources") : t("aiEngine")}
                modelGroup={label}
                icon={getTrafficEngineIconPath(engine)}
                selected={value === engine}
                onClick={() => onValueChange(engine)}
                size="small"
                variant="models"
              />
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
