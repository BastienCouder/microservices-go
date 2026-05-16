import type { AuditCategoryScore } from "../../_lib/shared/types";

type CategoryScorePillProps = {
  category: AuditCategoryScore;
};

export function CategoryScorePill({ category }: CategoryScorePillProps) {
  const ratio =
    category.max_score > 0 ? Math.round((category.score / category.max_score) * 100) : 0;

  return (
    <div className="rounded-full border border-[#eadfd3] bg-[#fffdf9] px-3 py-2">
      <div className="flex items-center justify-between gap-4 text-xs font-bold text-[#3a2418]">
        <span>{category.label}</span>
        <span>{ratio}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#d8d1ca]/50">
        <div
          className="h-full rounded-full bg-[#f26a21]"
          style={{ width: `${Math.min(100, ratio)}%` }}
        />
      </div>
    </div>
  );
}
