import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ContentOptimizerCrawlRecord } from "../../../_lib/content-optimizer-api";
import { pathnameFromURL } from "../_lib/crawl-panel-utils";

type ReanalyzeDialogProps = {
  open: boolean;
  reviewingDiscoveredPages: boolean;
  reanalyzing: boolean;
  reanalyzePages: ContentOptimizerCrawlRecord[];
  reanalyzeURLs: Set<string>;
  allReanalyzePagesSelected: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onTogglePage: (url: string, checked: boolean) => void;
  onSubmit: () => void;
};

export function ReanalyzeDialog({
  open,
  reviewingDiscoveredPages,
  reanalyzing,
  reanalyzePages,
  reanalyzeURLs,
  allReanalyzePagesSelected,
  onOpenChange,
  onToggleAll,
  onTogglePage,
  onSubmit,
}: ReanalyzeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {reviewingDiscoveredPages
              ? "Choisir les pages à analyser"
              : "Réanalyser certaines pages"}
          </DialogTitle>
          <DialogDescription>
            {reviewingDiscoveredPages
              ? "Sélectionnez les pages détectées à analyser. Vous pouvez relancer une découverte plus tard pour récupérer les nouvelles pages ajoutées sur le site."
              : "La limite est de 100 pages par défaut. L'analyse va régénérer les erreurs des pages sélectionnées et remplacer les anciennes erreurs de ces pages. Les erreurs des pages non sélectionnées sont conservées."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-md border">
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
              <label className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={allReanalyzePagesSelected}
                  onCheckedChange={(checked) => onToggleAll(checked === true)}
                />
                <span>Toutes les pages</span>
              </label>
              <span className="text-xs text-muted-foreground">
                {reanalyzeURLs.size}/{reanalyzePages.length}
              </span>
            </div>

            <div className="max-h-[360px] overflow-auto p-2">
              {reanalyzePages.length === 0 ? (
                <EmptyStateCard
                  label="Aucune page disponible pour cette réanalyse."
                  className="h-24"
                />
              ) : (
                <div className="space-y-1">
                  {reanalyzePages.map((record) => {
                    const recordURL = record.url.trim();

                    return (
                      <label
                        key={recordURL}
                        className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={reanalyzeURLs.has(recordURL)}
                          onCheckedChange={(checked) =>
                            onTogglePage(recordURL, checked === true)
                          }
                        />
                        <span className="min-w-0 space-y-0.5">
                          <span className="block truncate text-sm font-medium">
                            {record.title || pathnameFromURL(recordURL)}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {recordURL}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button type="button" onClick={onSubmit} disabled={reanalyzing}>
            Lancer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
