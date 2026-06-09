import { MultiSelectFilterPopover } from "@/components/shared/multi-select-filter-popover";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

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
  const { t } = useScopedI18n("error-hub");
  const summaryLabel = allCompetitorsSelected
    ? t("allCompetitors")
    : selectedCompetitors.length > 1
      ? t("selectedCountPlural", { count: selectedCompetitors.length })
      : t("selectedCountSingular", { count: selectedCompetitors.length });
  const options = availableCompetitors.map((competitor) => ({
    id: competitor,
    label: competitor,
  }));

  return (
    <MultiSelectFilterPopover
      open={open}
      onOpenChange={onOpenChange}
      label={t("competitorsLabel")}
      summaryLabel={summaryLabel}
      title={t("competitorsLabel")}
      options={options}
      selectedIds={selectedCompetitors}
      onToggle={toggleCompetitor}
      contentClassName="w-[360px]"
      emptyLabel={t("noCompetitorAvailable")}
      gridClassName="sm:grid-cols-1"
    />
  );
}
