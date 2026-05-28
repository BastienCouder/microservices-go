import { MultiSelectFilterPopover } from "@/components/shared/multi-select-filter-popover";
import type { ProjectModelMeta } from "@/lib/project-models";

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
  const summaryLabel = allModelsSelected
    ? "Tous les modèles"
    : `${selectedModels.length} sélectionné${selectedModels.length > 1 ? "s" : ""}`;
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
      label="Modèles"
      summaryLabel={summaryLabel}
      title="Modèles"
      options={options}
      selectedIds={selectedModels}
      onToggle={toggleModel}
      emptyLabel="Aucun modèle détecté"
      showIconSlot
    />
  );
}
