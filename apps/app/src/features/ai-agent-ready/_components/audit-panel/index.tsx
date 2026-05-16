import { ChevronUp, FlaskConical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils";

import { CHECK_GROUPS, SCAN_MODES } from "../../_lib/audit/audit-config";
import { useAgentReadyAuditViewModel } from "../../_lib/audit/use-agent-ready-audit-view-model";
import { MOCK_AGENT_READY_SCAN } from "../../_lib/shared/mock-scan";
import type { AuditCategoryID, AuditCheckResult } from "../../_lib/shared/types";
import { AuditSection } from "./audit-section";
import { CheckGroupCard } from "./check-group-card";
import { ScanHero } from "./scan-hero";
import { ScanModeTabs } from "./scan-mode-tabs";
import { ScoreSummaryCard } from "./score-summary-card";

type AgentReadyAuditPanelProps = {
  apiBaseURL: string;
};

const sectionLabels: Record<AuditCategoryID, string> = {
  discoverability: "Discoverability",
  content: "Content",
  bot_access: "Bot Access Control",
};

const sectionOrder: AuditCategoryID[] = ["discoverability", "content", "bot_access"];

export function AgentReadyAuditPanel({ apiBaseURL }: AgentReadyAuditPanelProps) {
  const viewModel = useAgentReadyAuditViewModel({ apiBaseURL });
  const [openCheckIDs, setOpenCheckIDs] = useState<string[]>([]);

  useEffect(() => {
    if (!viewModel.result) return;
    const firstFail = viewModel.result.checks.find((check) => check.status === "fail");
    setOpenCheckIDs(firstFail ? [firstFail.id] : []);
  }, [viewModel.result]);

  const checksByCategory = useMemo(() => {
    const grouped = new Map<AuditCategoryID, AuditCheckResult[]>();
    if (!viewModel.result) return grouped;

    for (const category of sectionOrder) {
      grouped.set(
        category,
        viewModel.result.checks.filter((check) => check.category_id === category),
      );
    }
    return grouped;
  }, [viewModel.result]);

  const toggleOpenCheck = (checkID: string) => {
    setOpenCheckIDs((current) =>
      current.includes(checkID)
        ? current.filter((item) => item !== checkID)
        : [...current, checkID],
    );
  };

  return (
    <main className="min-h-full bg-[#f7f3ee] px-3 py-4 text-[#3a2418] md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
        <ScanHero
          url={viewModel.url}
          urlError={viewModel.urlError}
          canScan={viewModel.canScan}
          isScanning={viewModel.isScanning}
          onURLChange={viewModel.setURL}
          onScan={viewModel.runScan}
        />

        <section className="rounded-[24px] border border-[#eadfd3] bg-[#fffaf5] p-5 shadow-[0_12px_32px_rgba(58,36,24,0.045)] md:p-6">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={viewModel.customizeOpen}
            onClick={() => viewModel.setCustomizeOpen(!viewModel.customizeOpen)}
          >
            <span>
              <span className="block text-lg font-extrabold text-[#3a2418]">
                Customize scan
              </span>
              <span className="mt-1 block text-sm leading-6 text-[#866d5d]">
                Choose the active audit surface and checks before scanning.
              </span>
            </span>
            <ChevronUp
              className={cn(
                "size-5 shrink-0 text-[#866d5d] transition duration-150",
                !viewModel.customizeOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>

          {viewModel.customizeOpen ? (
            <div className="mt-5 space-y-5">
              <ScanModeTabs
                modes={SCAN_MODES}
                value={viewModel.mode}
                onChange={viewModel.selectMode}
              />
              <p className="text-sm leading-6 text-[#866d5d]">
                {viewModel.activeModeDescription}
              </p>
              <div className="grid gap-4 lg:grid-cols-3">
                {CHECK_GROUPS.map((group) => (
                  <CheckGroupCard
                    key={group.id}
                    group={group}
                    selectedChecks={viewModel.selectedChecks}
                    onToggle={viewModel.toggleCheck}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <div aria-live="polite" className="sr-only">
          {viewModel.isScanning ? "Scan in progress" : "Scan idle"}
        </div>

        {viewModel.error ? (
          <div className="rounded-[18px] border border-[#df4c4c]/25 bg-[#fff6f4] p-4 text-sm font-semibold text-[#a83333]">
            {viewModel.error}
          </div>
        ) : null}

        {viewModel.isScanning ? <LoadingState /> : null}

        {!viewModel.result && !viewModel.isScanning ? (
          <EmptyAuditState onLoadExample={() => viewModel.setResult(MOCK_AGENT_READY_SCAN)} />
        ) : null}

        {viewModel.result ? (
          <>
            <ScoreSummaryCard result={viewModel.result} />
            <div className="space-y-8">
              {sectionOrder.map((categoryID) => (
                <AuditSection
                  key={categoryID}
                  id={categoryID}
                  label={sectionLabels[categoryID]}
                  checks={checksByCategory.get(categoryID) ?? []}
                  openCheckIDs={openCheckIDs}
                  onToggleCheck={toggleOpenCheck}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

function LoadingState() {
  return (
    <section className="rounded-[24px] border border-[#eadfd3] bg-[#fffaf5] p-6 shadow-[0_12px_32px_rgba(58,36,24,0.045)]">
      <div className="flex items-center gap-4">
        <div className="grid size-12 place-items-center rounded-full bg-[#f26a21]/10">
          <FlaskConical className="size-5 animate-pulse text-[#f26a21]" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-[#3a2418]">Running content checks</h2>
          <p className="mt-1 text-sm leading-6 text-[#866d5d]">
            Fetching headers, robots.txt, sitemap, and Markdown negotiation signals.
          </p>
        </div>
      </div>
      <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#d8d1ca]/55">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-[#f26a21]" />
      </div>
    </section>
  );
}

function EmptyAuditState({ onLoadExample }: { onLoadExample: () => void }) {
  return (
    <section className="rounded-[24px] border border-dashed border-[#eadfd3] bg-[#fffdf9] p-6 text-center">
      <h2 className="text-lg font-extrabold text-[#3a2418]">No scan yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#866d5d]">
        Enter a URL to see the score, blocking checks, and implementation prompts.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-5 rounded-[14px] border-[#eadfd3] bg-[#fffaf5] text-[#3a2418] hover:bg-[#fff3e8]"
        onClick={onLoadExample}
      >
        Load example scan
      </Button>
    </section>
  );
}
