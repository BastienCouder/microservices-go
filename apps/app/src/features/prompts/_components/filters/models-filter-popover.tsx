import { ModelCard } from "@/components/shared/model-card";
import { MultiSelectFilterPopover } from "@/components/shared/multi-select-filter-popover";
import { useI18nScope, useScopedI18n } from "@/shared/hooks/use-i18n";

type ModelVisual = {
  icon: string;
  description: string;
  label: string;
  provider: string;
  name: string;
};

type ModelsFilterPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allModelsSelected: boolean;
  selectedModels: string[];
  availableModels: string[];
  loading?: boolean;
  getModelVisual: (model: string) => ModelVisual;
  toggleModel: (model: string) => void;
};

export function ModelsFilterPopover({
  open,
  onOpenChange,
  allModelsSelected,
  selectedModels,
  availableModels,
  loading = false,
  getModelVisual,
  toggleModel,
}: ModelsFilterPopoverProps) {
  const content = useI18nScope("prompts-workspace");
  const { t } = useScopedI18n("prompts-workspace");
  const summaryLabel =
    allModelsSelected
      ? content.allModels
      : t("selectedModels", { count: selectedModels.length });
  const options = availableModels.map((model) => {
    const meta = getModelVisual(model);

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
      label={content.models}
      summaryLabel={summaryLabel}
      title={content.aiCoverageTitle}
      options={options}
      selectedIds={selectedModels}
      onToggle={toggleModel}
      loading={loading}
      contentClassName="w-[640px]"
      gridClassName="sm:grid-cols-2"
      renderOption={(option, selected, onToggleOption) => {
        const meta = getModelVisual(option.id);
        return (
          <ModelCard
            name={meta.name}
            description={meta.description || meta.name}
            icon={meta.icon || meta.name || option.id}
            selected={selected}
            onClick={onToggleOption}
            modelGroup={meta.label || meta.provider || meta.name}
            size="small"
            variant="monitoring"
          />
        );
      }}
    />
  );
}
