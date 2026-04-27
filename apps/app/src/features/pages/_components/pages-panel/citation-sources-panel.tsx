import { Globe2 } from "lucide-react";

import { SectionTitle } from "@/components/shared/section-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { CitationSource } from "../../_lib/pages-panel/types";
import { ModelIconStack } from "./model-badge";

export function CitationSourcesPanel({ sources }: { sources: CitationSource[] }) {
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
        {sources.length === 0 ? (
          <div className="flex min-h-[190px] items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/15 px-4 text-center text-sm text-muted-foreground">
            Aucun site tiers détecté pour le moment.
          </div>
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
