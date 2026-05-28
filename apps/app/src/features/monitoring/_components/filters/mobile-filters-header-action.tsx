"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { FiltersPanel } from ".";

const MOBILE_HEADER_ACTIONS_SLOT_ID = "mobile-header-actions-slot";

export function MobileFiltersHeaderAction() {
  const content = useI18nScope("monitoring-filters-panel");
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById(MOBILE_HEADER_ACTIONS_SLOT_ID));
  }, []);

  if (!target) {
    return null;
  }

  return createPortal(
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 rounded-lg border border-white/60 bg-white/20 px-4 text-sm font-medium text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl"
          aria-label={content.filters}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {content.filters}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="data-[side=left]:w-full h-dvh w-screen max-w-none border-r border-border/60 bg-background p-2 sm:h-full sm:w-[28rem] sm:max-w-[28rem]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{content.filters}</SheetTitle>
          <SheetDescription>{content.resetFilters}</SheetDescription>
        </SheetHeader>
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <FiltersPanel />
        </div>
      </SheetContent>
    </Sheet>,
    target,
  );
}
