import { FlaskConical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

import { useAgentReadyAuditViewModel } from "../../_lib/audit/use-agent-ready-audit-view-model";
import type { AuditCheckResult } from "../../_lib/shared/types";
import { AuditCheckAccordion } from "./audit-check-accordion";
import { ScanHero } from "./scan-hero";
import { ScoreSummaryCard } from "./score-summary-card";
import { useSelectedOrganizationPermissions } from "@/shared/organization-permissions";

type AgentReadyAuditPanelProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function AgentReadyAuditPanel({ apiBaseURL, routeSearch }: AgentReadyAuditPanelProps) {
  const { t } = useScopedI18n("ai-agent-ready");
  const viewModel = useAgentReadyAuditViewModel({ apiBaseURL, routeSearch });
  const permissions = useSelectedOrganizationPermissions({ apiBaseURL, routeSearch });
  const [openCheckIDs, setOpenCheckIDs] = useState<string[]>([]);

  const actionableChecks = useMemo(
    () =>
      (viewModel.result?.checks ?? [])
        .filter((check) => check.status === "fail" || check.status === "warning")
        .sort((left, right) => {
          if (left.status === right.status) return 0;
          return left.status === "fail" ? -1 : 1;
        }),
    [viewModel.result],
  );

  useEffect(() => {
    if (actionableChecks.length === 0) {
      setOpenCheckIDs([]);
      return;
    }
    setOpenCheckIDs([actionableChecks[0].id]);
  }, [actionableChecks]);

  const toggleOpenCheck = (checkID: string) => {
    setOpenCheckIDs((current) =>
      current.includes(checkID)
        ? current.filter((item) => item !== checkID)
        : [...current, checkID],
      );
  };

  const scanCard = (
    <ScanHero
      url={viewModel.url}
      urlError={viewModel.urlError}
      canScan={viewModel.canScan}
      isScanning={viewModel.isScanning}
      loadingProject={viewModel.loadingProject}
      projectName={viewModel.projectName}
      onAnalyze={viewModel.runScan}
      canEdit={permissions.canEdit}
    />
  );

  if (!viewModel.result && !viewModel.isScanning && !viewModel.error) {
    return (
      <main className="flex h-full min-h-0 items-center justify-center overflow-y-auto px-4 py-6">
        <div className="w-full max-w-[760px]">{scanCard}</div>
      </main>
    );
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-y-auto px-2 pb-4 pt-2 sm:px-4 sm:pb-5 md:p-4">
      <PageHeader
        title={t("title")}
        baseline={t("pageBaseline")}
        className="gap-3 md:gap-4"
      />

      <div className="space-y-3 sm:space-y-4">
        {scanCard}

        <div aria-live="polite" className="sr-only">
          {viewModel.isScanning ? t("scanInProgress") : t("scanIdle")}
        </div>

        {viewModel.error ? (
          <EmptyStateCard label={viewModel.error} className="h-24 border-destructive/20 bg-destructive/5 text-destructive" />
        ) : null}

        {viewModel.isScanning ? <LoadingState /> : null}

        {viewModel.result ? (
          <>
            <ScoreSummaryCard result={viewModel.result} />
            <ActionableChecksCard
              checks={actionableChecks}
              openCheckIDs={openCheckIDs}
              onToggleCheck={toggleOpenCheck}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

function LoadingState() {
  const { t } = useScopedI18n("ai-agent-ready");
  return (
    <Card className="border-border/60">
      <CardContent className="pt-4">
        <div className="flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <FlaskConical className="size-5 animate-pulse" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("loadingTitle")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("loadingDescription")}
            </p>
          </div>
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

function ActionableChecksCard({
  checks,
  openCheckIDs,
  onToggleCheck,
}: {
  checks: AuditCheckResult[];
  openCheckIDs: string[];
  onToggleCheck: (checkID: string) => void;
}) {
  const { t } = useScopedI18n("ai-agent-ready");
  if (checks.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-6">
          <div className="text-sm font-medium text-foreground">{t("nothingPriorityTitle")}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("nothingPriorityDescription")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">
          <SectionTitle showIndicator={false}>{t("priorityActionsTitle")}</SectionTitle>
        </CardTitle>
        <CardDescription>{t("priorityActionsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
