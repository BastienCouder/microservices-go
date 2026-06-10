import { ChecklistFilterSection } from "@/components/shared/checklist-filter-section";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { SectionTitle } from "@/components/shared/section-title";

const COMPETITORS_COUNT = 3;

type CompetitorFilterSectionProps = {
  competitors: Array<{ name: string; sov: number }>;
  selectedCompetitors: string[];
  toggleCompetitor: (name: string) => void;
  clearCompetitors: () => void;
  showAllCompetitors: boolean;
  setShowAllCompetitors: (value: boolean) => void;
};

export function CompetitorFilterSection({
  competitors,
  selectedCompetitors,
  toggleCompetitor,
  clearCompetitors,
  showAllCompetitors,
  setShowAllCompetitors,
}: CompetitorFilterSectionProps) {
  const content = useI18nScope("monitoring-filters-panel");
  const visibleCompetitors = showAllCompetitors
    ? competitors
    : competitors.slice(0, COMPETITORS_COUNT);
  const options = visibleCompetitors.map((competitor) => ({
    id: competitor.name,
    label: competitor.name,
    meta: `${competitor.sov.toFixed(1)}%`,
  }));

  return (
    <ChecklistFilterSection
      headerVariant="title"
      headerTitle={<SectionTitle>{content.topCompetitors}</SectionTitle>}
      clearLabel={content.clearCompetitors}
      clearButtonClassName="min-w-[6.5rem] lg:min-w-[5.25rem]"
      selectedIds={selectedCompetitors}
      options={options}
      onToggle={toggleCompetitor}
      onClear={clearCompetitors}
      emptyLabel={content.noDataAvailable}
      showAll={showAllCompetitors}
      hiddenCount={Math.max(0, competitors.length - COMPETITORS_COUNT)}
      onToggleMore={() => setShowAllCompetitors(!showAllCompetitors)}
      showMoreLabel={content.showMore}
      showLessLabel={content.showLess}
    />
  );
}
