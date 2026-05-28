import { ChecklistFilterSection } from "@/components/shared/checklist-filter-section";
import { useI18nScope } from "@/shared/hooks/use-i18n";

const PERSONAS_COUNT = 4;

type PersonaFilterSectionProps = {
  personaOptions: Array<{ id: string; label: string }>;
  selectedPersonas: string[];
  togglePersona: (id: string) => void;
  clearPersonas: () => void;
  showAllPersonas: boolean;
  setShowAllPersonas: (value: boolean) => void;
};

export function PersonaFilterSection({
  personaOptions,
  selectedPersonas,
  togglePersona,
  clearPersonas,
  showAllPersonas,
  setShowAllPersonas,
}: PersonaFilterSectionProps) {
  const content = useI18nScope("monitoring-filters-panel");
  const visiblePersonas = showAllPersonas
    ? personaOptions
    : personaOptions.slice(0, PERSONAS_COUNT);
  const options = visiblePersonas.map((persona) => ({
    id: persona.id,
    label: persona.label,
  }));

  if (personaOptions.length === 0) {
    return null;
  }

  return (
    <ChecklistFilterSection
      headerTitle={content.personas}
      clearLabel={content.clearPersonas}
      clearButtonClassName="min-w-[5.5rem] lg:min-w-[4.5rem] lg:text-[10px]"
      selectedIds={selectedPersonas}
      options={options}
      onToggle={togglePersona}
      onClear={clearPersonas}
      showAll={showAllPersonas}
      hiddenCount={Math.max(0, personaOptions.length - PERSONAS_COUNT)}
      onToggleMore={() => setShowAllPersonas(!showAllPersonas)}
      showMoreLabel={content.showMore}
      showLessLabel={content.showLess}
    />
  );
}
