import type { AuditCategoryScore } from "../../_lib/shared/types";

type CategoryScorePillProps = {
  category: AuditCategoryScore;
};

export function CategoryScorePill({ category }: CategoryScorePillProps) {
  const ratio =
    category.max_score > 0 ? Math.round((category.score / category.max_score) * 100) : 0;

  return (
    <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-3">
      <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span>{category.label}</span>
        <span>{ratio}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, ratio)}%` }}
        />
      </div>
      <div className="mt-2 text-sm font-medium text-foreground">
        {category.score}/{category.max_score}
      </div>
    </div>
  );
}
