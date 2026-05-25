import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionTitle } from "@/components/shared/section-title";
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

  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.filter((check) => check.status === "fail").length;
  const warningCount = checks.filter((check) => check.status === "warning").length;

  return (
    <Card aria-labelledby={`audit-section-${id}`} className="border-border/60">
      <CardHeader className="flex flex-col gap-3 space-y-0 border-b sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base">
            <SectionTitle showIndicator={false}>{label}</SectionTitle>
          </CardTitle>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-border/60">
            {checks.length} checks
          </Badge>
          {passCount > 0 ? (
            <Badge variant="secondary" className="bg-green-500/10 text-green-700">
              {passCount} OK
            </Badge>
          ) : null}
          {warningCount > 0 ? (
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-700">
              {warningCount} alertes
            </Badge>
          ) : null}
          {failCount > 0 ? (
            <Badge variant="secondary" className="bg-destructive/10 text-destructive">
              {failCount} bloquants
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {checks.map((check) => (
          <AuditCheckAccordion
            key={check.id}
            check={check}
            open={openCheckIDs.includes(check.id)}
            onToggle={() => onToggleCheck(check.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}
