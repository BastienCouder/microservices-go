import { Lightbulb } from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { SectionTitle } from "@/components/shared/section-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { PagesOpportunity } from "../../_lib/pages-panel/types";

export function OpportunitiesPanel({
  opportunities,
  loading = false,
}: {
  opportunities: PagesOpportunity[];
  loading?: boolean;
}) {
  return (
    <Card className="rounded-md border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          <SectionTitle>Priorités SEO IA</SectionTitle>
        </CardTitle>
        <CardDescription>
          Actions à fort levier à partir des citations observées.
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
                    <div className="flex items-start justify-between gap-3">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-6 w-14 rounded-full" />
                    </div>
                    <Skeleton className="mt-2 h-3 w-full" />
                    <Skeleton className="mt-2 h-3 w-4/5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : opportunities.length === 0 ? (
          <EmptyStateCard
            label="Les opportunités apparaîtront dès que des citations seront disponibles."
            className="h-[150px]"
          />
        ) : (
          <div className="space-y-3">
            {opportunities.map((opportunity) => (
              <div
                key={opportunity.title}
                className="rounded-md border border-border/60 bg-background px-3 py-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-md",
                      opportunity.tone === "primary" && "bg-primary/10 text-primary",
                      opportunity.tone === "warning" && "bg-amber-100 text-amber-700",
                      opportunity.tone === "neutral" && "bg-muted text-muted-foreground",
                    )}
                  >
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold leading-5">
                        {opportunity.title}
                      </h3>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                        {opportunity.metric}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {opportunity.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
