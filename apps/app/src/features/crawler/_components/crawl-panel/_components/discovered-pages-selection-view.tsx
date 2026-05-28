import { Search } from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { SectionTitle } from "@/components/shared/section-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/shared/utils";
import type { ContentOptimizerCrawlRecord } from "../../../_lib/content-optimizer-api";
import { hostnameFromURL, pathnameFromURL } from "../_lib/crawl-panel-utils";

type DiscoveredPagesSelectionViewProps = {
  query: string;
  records: ContentOptimizerCrawlRecord[];
  filteredRecords: ContentOptimizerCrawlRecord[];
  selectedURLs: Set<string>;
  selectedCount: number;
  allSelected: boolean;
  onQueryChange: (value: string) => void;
  onTogglePage: (url: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
};

export function DiscoveredPagesSelectionView({
  query,
  records,
  filteredRecords,
  selectedURLs,
  selectedCount,
  allSelected,
  onQueryChange,
  onTogglePage,
  onToggleAll,
}: DiscoveredPagesSelectionViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background px-4 py-4">
   {/*    <div className="flex items-center justify-between gap-2">
        <Badge
          variant="secondary"
          className="h-6 bg-primary/10 px-2 font-mono text-xs text-primary"
        >
          {records.length}
        </Badge>
      </div>
 */}
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Filtrer les pages découvertes"
            className="pl-9"
          />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          <Badge
            variant="outline"
            className="h-8 rounded-sm px-2 font-mono text-xs"
          >
            {selectedCount} sélectionnée(s)
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggleAll(!allSelected)}
          >
            {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </Button>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-auto pb-4">
        {filteredRecords.length === 0 ? (
          <EmptyStateCard
            label={
              records.length === 0
                ? "Aucune page du domaine n'a été détectée."
                : "Aucune page ne correspond à la recherche."
            }
            className="h-32"
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col space-y-3 p-1">
            {filteredRecords.map((record) => {
              const recordURL = record.url.trim();
              const checked = selectedURLs.has(recordURL);

              return (
                <button
                  key={record.url}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => onTogglePage(recordURL, !checked)}
                  className={cn(
                    "group w-full cursor-pointer rounded-md bg-background px-3 py-2.5 text-left transition-all hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    checked && "bg-primary/5 ring-2 ring-primary/20",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground md:text-sm">
                          {hostnameFromURL(record.url)}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground md:text-xs">
                          {pathnameFromURL(record.url)}
                        </p>
                      </div>
                    </div>

                    <Checkbox
                      checked={checked}
                      aria-label={`Sélectionner ${recordURL}`}
                      onCheckedChange={(nextChecked) =>
                        onTogglePage(recordURL, nextChecked === true)
                      }
                      onClick={(event) => event.stopPropagation()}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-2">
                    <div className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                      {recordURL}
                    </div>

                    <Badge
                      variant={checked ? "secondary" : "outline"}
                      className="h-6 shrink-0 rounded-sm px-2 text-xs font-bold"
                    >
                      {checked ? "Sélectionnée" : record.status}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
