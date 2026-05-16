import { CheckCircle2, CircleAlert, CircleX, Link2 } from "lucide-react";

import type { AuditScanResult } from "../../_lib/shared/types";
import { CategoryScorePill } from "./category-score-pill";
import { ScoreGauge } from "./score-gauge";

type ScoreSummaryCardProps = {
  result: AuditScanResult;
};

export function ScoreSummaryCard({ result }: ScoreSummaryCardProps) {
  const completed = result.summary.passed + result.summary.failed + result.summary.warning;

  return (
    <section className="rounded-[24px] border border-[#eadfd3] bg-[#fffaf5] p-5 shadow-[0_18px_50px_rgba(58,36,24,0.06)] md:p-7">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#866d5d]">
            <Link2 className="size-4 text-[#f26a21]" aria-hidden="true" />
            <span className="truncate">{result.url}</span>
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <h2 className="text-3xl font-extrabold text-[#3a2418]">{result.level}</h2>
            <span className="rounded-full bg-[#f26a21]/10 px-3 py-1 text-sm font-bold text-[#a84510]">
              {completed}/{result.checks.length} checks reviewed
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#866d5d]">
            {result.summary.failed > 0
              ? "Focus on failed checks first. They block agents from finding or reusing your content reliably."
              : "The core content surface is in good shape. Keep policy and discovery signals current."}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Counter
              icon={CheckCircle2}
              label="Passed"
              value={result.summary.passed}
              className="text-[#1fa35b]"
            />
            <Counter
              icon={CircleAlert}
              label="Warnings"
              value={result.summary.warning}
              className="text-[#f3a43b]"
            />
            <Counter
              icon={CircleX}
              label="Failed"
              value={result.summary.failed}
              className="text-[#df4c4c]"
            />
          </div>
        </div>

        <ScoreGauge score={result.score} />
      </div>

      <div className="mt-7 grid gap-3 md:grid-cols-3">
        {result.categories.map((category) => (
          <CategoryScorePill key={category.id} category={category} />
        ))}
      </div>
    </section>
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
    <div className="rounded-[18px] border border-[#eadfd3] bg-[#fffdf9] p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-[#866d5d]">
        <Icon className={className} aria-hidden="true" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold text-[#3a2418]">{value}</div>
    </div>
  );
}
