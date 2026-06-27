import { Search } from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { SectionTitle } from "@/components/shared/section-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
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
  hasLatestContentCrawl?: boolean;
  onQueryChange: (value: string) => void;
  onTogglePage: (url: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onShowLatestContentCrawl?: () => void;
};

export function DiscoveredPagesSelectionView({
  query,
  records,
  filteredRecords,
  selectedURLs,
  selectedCount,
  allSelected,
  hasLatestContentCrawl = false,
  onQueryChange,
  onTogglePage,
  onToggleAll,
  onShowLatestContentCrawl,
}: DiscoveredPagesSelectionViewProps) {
  const { t } = useScopedI18n("crawler-panel");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background px-3 py-3 md:px-4 md:py-4">
      <div className="flex w-full items-center justify-between gap-2">
        <SectionTitle showIndicator={false}>{t("discoveredPagesTitle")}</SectionTitle>
        <Badge
          variant="secondary"
          className="h-6 bg-primary/10 px-2 font-mono text-xs text-primary"
        >
          {records.length}
        </Badge>
      </div>

      <div className="mt-3 flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("filterDiscoveredPagesPlaceholder")}
            className="pl-9"
          />
        </div>

        <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:shrink-0 lg:items-center lg:justify-end">
          {hasLatestContentCrawl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onShowLatestContentCrawl}
              className="col-span-2 w-full lg:w-auto"
            >
              {t("viewLatestContentCrawl")}
            </Button>
          ) : null}
          <Badge
            variant="outline"
            className="flex h-8 justify-center rounded-sm px-2 font-mono text-xs"
          >
            {t("selectedCount", { count: selectedCount })}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggleAll(!allSelected)}
            className="w-full lg:w-auto"
          >
            {allSelected ? t("deselectAll") : t("selectAll")}
          </Button>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-auto pb-4">
        {filteredRecords.length === 0 ? (
          <EmptyStateCard
            label={
              records.length === 0
                ? t("noDomainPagesDetected")
                : t("noPagesMatchingSearch")
            }
            className="h-32"
          />
        ) : (
          <div className="flex min-h-0 w-full flex-1 flex-col space-y-3 p-1">
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
                    "group w-full cursor-pointer rounded-md bg-background px-3 py-2.5 text-left transition-all hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:px-4 lg:py-3",
                    checked && "bg-primary/5 ring-2 ring-primary/20",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-3 lg:mb-3">
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
                      aria-label={t("selectPageAria", { url: recordURL })}
                      onCheckedChange={(nextChecked) =>
                        onTogglePage(recordURL, nextChecked === true)
                      }
                      onClick={(event) => event.stopPropagation()}
                    />
                  </div>

                  <div className="flex flex-col gap-2 border-t border-border/40 pt-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                      {recordURL}
                    </div>

                    <Badge
                      variant={checked ? "secondary" : "outline"}
                      className="h-6 shrink-0 rounded-sm px-2 text-xs font-bold"
                    >
                      {checked ? t("selectedBadge") : record.status}
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
