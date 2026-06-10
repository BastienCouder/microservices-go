import { MultiSelectFilterPopover } from "@/components/shared/multi-select-filter-popover";
import { useI18nScope } from "@/shared/hooks/use-i18n";

type CompetitorsFilterPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCompetitors: string[];
  toggleCompetitor: (value: string) => void;
  clearCompetitors: () => void;
  availableCompetitors: string[];
  loading?: boolean;
};

export function CompetitorsFilterPopover({
  open,
  onOpenChange,
  selectedCompetitors,
  toggleCompetitor,
  clearCompetitors,
  availableCompetitors,
  loading = false,
}: CompetitorsFilterPopoverProps) {
  const content = useI18nScope("prompts-workspace");
  const selectedCompetitorLabel =
    selectedCompetitors.length === 0
      ? content.allCompetitors
      : selectedCompetitors.length === 1
        ? selectedCompetitors[0]!
        : `${selectedCompetitors.length} ${content.competitorsSelected}`;
  const options = availableCompetitors.map((competitor) => ({
    id: competitor,
    label: competitor,
  }));

  return (
    <MultiSelectFilterPopover
      open={open}
      onOpenChange={onOpenChange}
      label={content.competitors}
      summaryLabel={selectedCompetitorLabel}
      title={content.topCompetitorsTitle}
      options={options}
      selectedIds={selectedCompetitors}
      onToggle={toggleCompetitor}
      allOption={{
        label: content.allCompetitors,
        selected: selectedCompetitors.length === 0,
        onSelect: clearCompetitors,
      }}
      className="sm:min-w-[240px] sm:max-w-[360px]"
      loading={loading}
    />
  );
}
