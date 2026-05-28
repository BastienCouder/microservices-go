import { MultiSelectFilterPopover } from "@/components/shared/multi-select-filter-popover";

export function ErrorHubCompetitorsFilter({
  allCompetitorsSelected,
  availableCompetitors,
  onOpenChange,
  open,
  selectedCompetitors,
  toggleCompetitor,
}: {
  allCompetitorsSelected: boolean;
  availableCompetitors: string[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  selectedCompetitors: string[];
  toggleCompetitor: (competitor: string) => void;
}) {
  const summaryLabel = allCompetitorsSelected
    ? "Tous les concurrents"
    : `${selectedCompetitors.length} sélectionné${selectedCompetitors.length > 1 ? "s" : ""}`;
  const options = availableCompetitors.map((competitor) => ({
    id: competitor,
    label: competitor,
  }));

  return (
    <MultiSelectFilterPopover
      open={open}
      onOpenChange={onOpenChange}
      label="Concurrents"
      summaryLabel={summaryLabel}
      title="Concurrents"
      options={options}
      selectedIds={selectedCompetitors}
      onToggle={toggleCompetitor}
      contentClassName="w-[360px]"
      emptyLabel="Aucun concurrent disponible"
      gridClassName="sm:grid-cols-1"
    />
  );
}
