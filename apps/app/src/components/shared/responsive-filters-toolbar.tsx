import { useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type ResponsiveFiltersToolbarProps = {
  children: () => ReactNode;
  className?: string;
  desktopClassName?: string;
  label: string;
  mobileClassName?: string;
};

export function ResponsiveFiltersToolbar({
  children,
  className,
  desktopClassName,
  label,
  mobileClassName,
}: ResponsiveFiltersToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className={className}>
      <Collapsible
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        className={cn("mt-5 md:hidden", mobileClassName)}
      >
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="flex h-11 w-full items-center justify-between rounded-lg px-4"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="h-4 w-4" />
              {label}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                filtersOpen && "rotate-180",
              )}
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="mt-3 flex flex-col gap-2">{children()}</div>
        </CollapsibleContent>
      </Collapsible>

      <div
        className={cn(
          "mt-5 hidden flex-col gap-2 md:flex md:flex-row md:flex-wrap md:items-center",
          desktopClassName,
        )}
      >
        {children()}
      </div>
    </div>
  );
}
