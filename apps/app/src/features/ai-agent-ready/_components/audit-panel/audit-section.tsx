import type { AuditCategoryID, AuditCheckResult } from "../../_lib/shared/types";
import { AuditCheckAccordion } from "./audit-check-accordion";

type AuditSectionProps = {
  id: AuditCategoryID;
  label: string;
  checks: AuditCheckResult[];
  openCheckIDs: string[];
  onToggleCheck: (checkID: string) => void;
};

export function AuditSection({
  id,
  label,
  checks,
  openCheckIDs,
  onToggleCheck,
}: AuditSectionProps) {
  if (checks.length === 0) return null;

  return (
    <section aria-labelledby={`audit-section-${id}`} className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 id={`audit-section-${id}`} className="text-xl font-extrabold text-[#3a2418]">
          {label}
        </h2>
        <span className="rounded-full border border-[#eadfd3] bg-[#fffdf9] px-3 py-1 text-sm font-bold text-[#866d5d]">
          {checks.length} checks
        </span>
      </div>
      <div className="space-y-3">
        {checks.map((check) => (
          <AuditCheckAccordion
            key={check.id}
            check={check}
            open={openCheckIDs.includes(check.id)}
            onToggle={() => onToggleCheck(check.id)}
          />
        ))}
      </div>
    </section>
  );
}
