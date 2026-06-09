import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import type { AuditScanResult } from "../../_lib/shared/types";
import { ScoreGauge } from "./score-gauge";

type ScoreSummaryCardProps = {
  result: AuditScanResult;
};

export function ScoreSummaryCard({ result }: ScoreSummaryCardProps) {
  const levelLabel =
    result.level === "Ready"
      ? "Prêt"
      : result.level === "Partially Ready"
        ? "Partiellement prêt"
        : "Non prêt";

  return (
    <Card className="border-border/60">
      <CardContent className="pt-4">
        <div className="grid gap-6 xl:grid-cols-[180px_minmax(0,1fr)] xl:items-center">
          <ScoreGauge score={result.score} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-foreground">{levelLabel}</h2>
              <span className="text-sm text-muted-foreground">Score global</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {result.summary.failed > 0
                ? "Les points ci-dessous sont ceux à traiter en priorité pour éviter que les agents ratent ou exploitent mal le site."
                : "Aucun point bloquant détecté sur les contrôles lancés."}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Counter
                icon={CheckCircle2}
                label="Validés"
                value={result.summary.passed}
                className="text-green-700"
              />
              <Counter
                icon={CircleAlert}
                label="Alertes"
                value={result.summary.warning}
                className="text-amber-700"
              />
              <Counter
                icon={CircleX}
                label="Bloquants"
                value={result.summary.failed}
                className="text-destructive"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Counter({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className={className} aria-hidden="true" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
