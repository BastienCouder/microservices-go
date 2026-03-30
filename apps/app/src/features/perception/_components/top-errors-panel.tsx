"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  formatPerceptionErrorTypeLabel,
  formatPerceptionPriorityLabel,
  getModelIconForName,
  PERCEPTION_TEXT,
} from "@/lib/app-data";
import { cn } from "@/lib/utils";
import type { PerceptionError } from "@/lib/perception-data";
import { MonitoringSectionTitle } from "@/features/monitoring/_components/shared/monitoring-section-title";

export function TopErrorsPanel({
  errors,
}: {
  errors: PerceptionError[];
}) {
  const [selectedError, setSelectedError] = useState<PerceptionError | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h4>
            <MonitoringSectionTitle>{PERCEPTION_TEXT.topErrors.title}</MonitoringSectionTitle>
          </h4>
        </div>
        <Badge variant="secondary" className="h-5 bg-primary/10 px-1.5 font-mono text-[10px] text-primary">
    {errors.length}
        </Badge>
      </div>

      <div className="space-y-3">
        {errors.length === 0 ? (
          <div className="rounded-md bg-background p-4 text-center">
            <p className="text-sm font-medium text-foreground">{PERCEPTION_TEXT.topErrors.emptyTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {PERCEPTION_TEXT.topErrors.emptyDescription}
            </p>
          </div>
        ) : (
          errors.map((error, index) => (
            <TopErrorCard
              key={error.id}
              error={error}
              index={index}
              onOpenDetails={() => setSelectedError(error)}
            />
          ))
        )}

        <Button asChild variant="ghost" size="sm" className="w-full text-xs">
          <Link to="/optimize/actions">{PERCEPTION_TEXT.topErrors.seeMore}</Link>
        </Button>
      </div>

      <Sheet open={selectedError !== null} onOpenChange={(open) => !open && setSelectedError(null)}>
        <SheetContent side="right" className="w-full p-0 sm:w-[420px] sm:max-w-[420px]">
          {selectedError ? (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-border/60 p-4 text-left">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline">{formatPerceptionErrorTypeLabel(selectedError.type)}</Badge>
                  <Badge variant={selectedError.optimizePriority === "high" ? "destructive" : "secondary"}>
                    {formatPerceptionPriorityLabel(selectedError.optimizePriority)}
                  </Badge>
                  {selectedError.detectedInModels.map((model) => (
                    <Badge
                      key={`sheet-${selectedError.id}-${model}`}
                      variant="secondary"
                      className="inline-flex items-center gap-1 font-normal"
                    >
                      <img src={getModelIconForName(model)} alt="" className="h-3 w-3 shrink-0" aria-hidden="true" decoding="async" />
                      {model}
                    </Badge>
                  ))}
                </div>
                <SheetTitle className="text-base leading-tight">{selectedError.title}</SheetTitle>
                <SheetDescription>
                  {PERCEPTION_TEXT.topErrors.sheetDescription}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <section className="space-y-1">
                  <h5 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {PERCEPTION_TEXT.topErrors.aiClaim}
                  </h5>
                  <p className="text-sm leading-relaxed text-foreground">{selectedError.issue}</p>
                </section>

                <section className="space-y-1">
                  <h5 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{PERCEPTION_TEXT.topErrors.impact}</h5>
                  <p className="text-sm leading-relaxed text-foreground">{selectedError.impact}</p>
                </section>

                <section className="space-y-1">
                  <h5 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {PERCEPTION_TEXT.topErrors.generatedFix}
                  </h5>
                  <div className="rounded-md bg-muted/40 p-3 text-sm leading-relaxed">{selectedError.generatedContent}</div>
                </section>
              </div>

            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function getSeverityTone(severity: PerceptionError["severity"]) {
  if (severity === "high") return { dot: "bg-rose-500", label: "text-rose-500", tag: PERCEPTION_TEXT.topErrors.severity.high };
  if (severity === "medium") return { dot: "bg-amber-500", label: "text-amber-600", tag: PERCEPTION_TEXT.topErrors.severity.medium };
  return { dot: "bg-sky-500", label: "text-sky-600", tag: PERCEPTION_TEXT.topErrors.severity.low };
}

function TopErrorCard({
  error,
  index,
  onOpenDetails,
}: {
  error: PerceptionError;
  index: number;
  onOpenDetails: () => void;
}) {
  const tone = getSeverityTone(error.severity);

  return (
    <div
      className="group relative cursor-pointer rounded-2xl border border-border/70 bg-card/80 p-4 text-left transition-colors hover:border-primary/25 hover:bg-muted/10"
      onClick={onOpenDetails}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetails();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className={cn("h-2 w-2 rounded-full", tone.dot)} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {PERCEPTION_TEXT.topErrors.errorPrefix}
              {index + 1}
            </span>
            <Badge variant="outline" className={cn("rounded-full px-2 py-0 text-[10px] font-medium", tone.label)}>
              {tone.tag}
            </Badge>
          </div>

          <div className="space-y-2">
            <p className="line-clamp-2 text-sm font-medium leading-6 text-foreground">{error.title}</p>
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{error.issue}</p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {error.detectedInModels.slice(0, 2).map((model) => (
              <Badge key={model} variant="outline" className="inline-flex items-center gap-1 font-normal">
                <img src={getModelIconForName(model)} alt={model} className="h-3 w-3 shrink-0" aria-hidden="true" decoding="async" />
                {model}
              </Badge>
            ))}
            {error.detectedInModels.length > 2 ? (
              <Badge variant="outline" className="font-normal">
                +{error.detectedInModels.length - 2}
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-muted-foreground">
              {formatPerceptionErrorTypeLabel(error.type)}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {PERCEPTION_TEXT.topErrors.seeMore}
            </span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 right-3 opacity-0 transition-opacity group-hover:opacity-100">
        <ChevronRight className={cn("h-4 w-4", tone.label)} />
      </div>
    </div>
  );
}
