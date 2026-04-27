import { Lightbulb } from "lucide-react";

import { SectionTitle } from "@/components/shared/section-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { PagesOpportunity } from "../../_lib/pages-panel/types";

export function OpportunitiesPanel({
  opportunities,
}: {
  opportunities: PagesOpportunity[];
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
        {opportunities.length === 0 ? (
          <div className="flex min-h-[150px] items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/15 px-4 text-center text-sm text-muted-foreground">
            Les opportunités apparaîtront dès que des citations seront disponibles.
          </div>
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
