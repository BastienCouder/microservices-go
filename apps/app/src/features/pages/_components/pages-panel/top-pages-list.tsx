import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { PageInsight } from "../../_lib/pages-panel/types";

type TopPagesListProps = {
  pages: PageInsight[];
  search: string;
  onSearchChange: (value: string) => void;
  selectedPageUrl: string | null;
  onSelectPage: (url: string) => void;
};

export function TopPagesList({
  pages,
  search,
  onSearchChange,
  selectedPageUrl,
  onSelectPage,
}: TopPagesListProps) {
  return (
    <Card className="flex min-h-0 overflow-hidden rounded-md border-border/60 bg-card/95">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher"
            className="h-10 rounded-md border-border/70 bg-background pl-9 text-sm"
          />
        </div>

        <ScrollArea className="min-h-0 flex-1 pr-2">
          <div className="space-y-3 pb-1">
            {pages.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 bg-muted/15 px-4 py-10 text-sm text-muted-foreground">
                Aucune page ne correspond à la recherche.
              </div>
            ) : (
              pages.map((page, index) => (
                <button
                  key={page.url}
                  type="button"
                  onClick={() => onSelectPage(page.url)}
                  className={cn(
                    "group w-full cursor-pointer rounded-md bg-background p-4 text-left transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    selectedPageUrl === page.url
                      ? "border border-border/50"
                      : "border border-border/50",
                  )}
                  aria-label={`Page ${index + 1}: ${page.hostname}${page.path}`}
                >
                  <div className="mb-4 rounded-md">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      
                      <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-md border text-xs font-bold",
                          selectedPageUrl === page.url
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border/50 bg-white text-muted-foreground",
                        )}
                      >
                        {index + 1}
                      </div>

                      <p className="line-clamp-2 break-all text-xs font-medium leading-relaxed text-foreground/90 transition-colors group-hover:text-foreground md:text-sm">
                        {page.path}
                      </p>

                      </div>

                    <Badge
                      variant="secondary"
                      className={cn(
                        "h-8 shrink-0 rounded-sm px-2 font-mono text-xs font-bold",
                        selectedPageUrl === page.url
                          ? "bg-primary/10 text-primary"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      {page.citationShare}%
                    </Badge>
                    </div>
                  </div>

                  <div className="mb-3 p-2 flex justify-between overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-3 rounded-full bg-primary"
                      style={{ width: `${Math.min(100, page.citationShare)}%` }}
                    />

                  </div>

                  <div className="flex items-center justify-between border-t border-border/40 pt-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex -space-x-1">
                        {page.models.slice(0, 3).map((model) => (
                          <span
                            key={model.id}
                            title={model.label}
                            className="grid h-6 w-6 place-items-center rounded-md border border-border/70 bg-background p-1 shadow-sm"
                          >
                            <img
                              src={model.iconPath}
                              alt=""
                              width={14}
                              height={14}
                              loading="lazy"
                              decoding="async"
                              className="h-3.5 w-3.5 object-contain"
                            />
                          </span>
                        ))}
                      </div>
                      {page.models.length > 3 ? (
                        <span className="text-[11px] font-medium text-muted-foreground">
                          +{page.models.length - 3}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{page.promptCount}</span>
                      <span>réponses</span>
                      <div className="h-[12px] w-px bg-border" />
                      <span className="font-semibold text-foreground">{page.citationCount}</span>
                      <span>citations</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
