import type { OptimizationError } from "@/lib/optimization-errors-data";
import type { PerceptionSeverity } from "@/lib/perception-data";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { PerceptionTopErrorCard } from "../../perception/_components";
import { getCrawlerGroupLabel } from "../_lib/error-hub-utils";
import { ErrorHubColumnLoading } from "./template";

type ErrorHubColumnProps = {
  actionStatusesByErrorId: ReadonlyMap<string, string>;
  columnIndex: number;
  emptyLabel?: string | null;
  errors: OptimizationError[];
  generatedIds: ReadonlySet<string>;
  loading: boolean;
  locale: string;
  markingDoneErrorIds: ReadonlySet<string>;
  modelLookup: ReturnType<
    typeof import("../../perception/_components").buildPerceptionModelLookup
  >;
  onCreateAction: (error: OptimizationError) => void | Promise<void>;
  onMarkDone: (error: OptimizationError) => void | Promise<void>;
  onOpenDetails: (error: OptimizationError) => void;
  savingErrorIds: ReadonlySet<string>;
  severity: PerceptionSeverity;
  title: string;
  tone: string;
  totalColumns: number;
  getContextBadge: (
    error: OptimizationError,
  ) => { label: string; className: string } | undefined;
  getContextMeta: (
    error: OptimizationError,
  ) => { label: string; value: string } | undefined;
};

export function ErrorHubColumn({
  actionStatusesByErrorId,
  columnIndex,
  emptyLabel,
  errors,
  generatedIds,
  getContextBadge,
  getContextMeta,
  loading,
  locale,
  markingDoneErrorIds,
  modelLookup,
  onCreateAction,
  onMarkDone,
  onOpenDetails,
  savingErrorIds,
  severity,
  title,
  tone,
  totalColumns,
}: ErrorHubColumnProps) {
  return (
    <section
      className="relative flex min-h-[420px] flex-col rounded-md bg-muted/20 p-2 lg:min-h-0"
      data-severity={severity}
    >
      {columnIndex !== totalColumns - 1 && (
        <div className="absolute right-[-16px] top-4 hidden h-[calc(100%-32px)] w-1 bg-border lg:block" />
      )}

      <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge className={cn("rounded-sm border px-2 py-0.5", tone)}>
              {loading ? (
                <Skeleton className="h-3 w-4 rounded-sm bg-current/20" />
              ) : (
                errors.length
              )}
              <div className="ml-1">{title}</div>
            </Badge>
          </div>
        </div>
      </div>

      <div className="min-h-0 space-y-3 lg:-mx-1 lg:flex-1 lg:overflow-y-auto lg:px-1 lg:pb-1 lg:pt-1">
        {loading ? (
          <ErrorHubColumnLoading />
        ) : errors.length > 0 ? (
          errors.map((error, index) => {
            const previous = index > 0 ? errors[index - 1] : null;
            const groupLabel = getCrawlerGroupLabel(error, locale);
            const previousGroupLabel = previous
              ? getCrawlerGroupLabel(previous, locale)
              : undefined;
            const shouldRenderGroupHeader =
              groupLabel !== undefined && groupLabel !== previousGroupLabel;

            return (
              <div key={error.id} className="space-y-2">
                {shouldRenderGroupHeader ? (
                  <div className="rounded-md border border-border/60 bg-background/80 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {locale.startsWith("fr")
                        ? "Problèmes détectés sur cette page"
                        : "Issues detected on this page"}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">
                      {groupLabel}
                    </p>
                  </div>
                ) : null}

                <PerceptionTopErrorCard
                  contextBadge={getContextBadge(error)}
                  contextMeta={getContextMeta(error)}
                  error={error}
                  footerAlign="end"
                  index={index}
                  locale={locale}
                  modelLookup={modelLookup}
                  onOpenDetails={() => onOpenDetails(error)}
                  showIndex={false}
                  actionGenerated={generatedIds.has(error.id)}
                  actionSaving={savingErrorIds.has(error.id)}
                  actionStatus={actionStatusesByErrorId.get(error.id)}
                  markingActionDone={markingDoneErrorIds.has(error.id)}
                  onCreateAction={() => void onCreateAction(error)}
                  onMarkActionDone={() => void onMarkDone(error)}
                />
              </div>
            );
          })
        ) : (
          <EmptyStateCard
            label={emptyLabel || "Aucune erreur à afficher dans cette colonne pour les filtres sélectionnés."}
            className="h-24 bg-background/60"
          />
        )}
      </div>
    </section>
  );
}
