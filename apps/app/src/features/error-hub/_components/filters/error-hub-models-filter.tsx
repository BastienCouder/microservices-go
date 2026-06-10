import { MultiSelectFilterPopover } from "@/components/shared/multi-select-filter-popover";
import type { ProjectModelMeta } from "@/lib/project-models";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

import { getModelVisual } from "../../_lib/error-hub-utils";

export function ErrorHubModelsFilter({
  allModelsSelected,
  availableModels,
  onOpenChange,
  open,
  projectModelLookup,
  selectedModels,
  toggleModel,
}: {
  allModelsSelected: boolean;
  availableModels: string[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectModelLookup: ReadonlyMap<string, ProjectModelMeta>;
  selectedModels: string[];
  toggleModel: (model: string) => void;
}) {
  const { t } = useScopedI18n("error-hub");
  const summaryLabel = allModelsSelected
    ? t("allModels")
    : selectedModels.length > 1
      ? t("selectedCountPlural", { count: selectedModels.length })
      : t("selectedCountSingular", { count: selectedModels.length });
  const options = availableModels.map((model) => {
    const meta = getModelVisual(model, projectModelLookup);

    return {
      id: model,
      label: meta.label,
      description: [meta.provider, meta.name !== meta.label ? meta.name : ""]
        .filter(Boolean)
        .join(" - "),
      iconSrc: meta.icon,
      imageAlt: model,
    };
  });

  return (
    <MultiSelectFilterPopover
      open={open}
      onOpenChange={onOpenChange}
      label={t("modelsLabel")}
      summaryLabel={summaryLabel}
      title={t("modelsLabel")}
      options={options}
      selectedIds={selectedModels}
      onToggle={toggleModel}
      emptyLabel={t("noModelsDetected")}
      showIconSlot
    />
  );
}
