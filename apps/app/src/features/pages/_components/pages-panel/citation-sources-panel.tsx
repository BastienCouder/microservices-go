import { Globe2 } from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { SectionTitle } from "@/components/shared/section-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

import type { CitationSource } from "../../_lib/pages-panel/types";
import { ModelIconStack } from "./model-badge";

type CitationSourcesPanelProps = {
  errorLabel?: string | null;
  sources: CitationSource[];
  loading?: boolean;
};

export function CitationSourcesPanel({
  errorLabel,
  sources,
  loading = false,
}: CitationSourcesPanelProps) {
  return (
    <Card className="rounded-md border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          <SectionTitle>Sites qui nous citent</SectionTitle>
        </CardTitle>
        <CardDescription>
          Domaines externes qui apparaissent comme sources à côté de votre marque.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-md border border-border/60 bg-background px-3 py-3"
              >
                <div className="flex items-start gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                    <Skeleton className="mt-2 h-3 w-40" />
                    <div className="mt-3 flex gap-1">
                      <Skeleton className="h-6 w-6 rounded-md" />
                      <Skeleton className="h-6 w-6 rounded-md" />
                      <Skeleton className="h-6 w-6 rounded-md" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sources.length === 0 ? (
          <EmptyStateCard
            label={errorLabel || "Aucun site tiers détecté pour le moment."}
            className="h-[190px]"
          />
        ) : (
          <ScrollArea className="h-[230px] pr-3 [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
            <div className="space-y-3">
              {sources.map((source) => (
                <div
                  key={source.hostname}
                  className="rounded-md border border-border/60 bg-background px-3 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                      <Globe2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-semibold">
                          {source.hostname}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {source.coverageShare}%
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {source.citationCount} citations • {source.promptCount} réponses
                      </div>
                      <div className="mt-3">
                        <ModelIconStack models={source.models} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
