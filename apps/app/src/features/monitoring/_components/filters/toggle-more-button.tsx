import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18nScope } from "@/shared/hooks/use-i18n";

type ToggleMoreButtonProps = {
  showAll: boolean;
  hiddenCount: number;
  onToggle: () => void;
};

export function ToggleMoreButton({
  showAll,
  hiddenCount,
  onToggle,
}: ToggleMoreButtonProps) {
  const content = useI18nScope("monitoring-filters-panel");

  return (
    <Button
      variant="ghost"
      className="mt-1 min-h-9 w-full whitespace-normal py-2 text-xs leading-tight text-muted-foreground hover:text-foreground md:text-sm lg:min-h-7 lg:py-1 lg:text-xs"
      onClick={onToggle}
    >
      {showAll ? (
        <>
          {content.showLess} <ChevronUp className="ml-1 h-3 w-3" />
        </>
      ) : (
        <>
          {content.showMore} ({hiddenCount}) <ChevronDown className="ml-1 h-3 w-3" />
        </>
      )}
    </Button>
  );
}
