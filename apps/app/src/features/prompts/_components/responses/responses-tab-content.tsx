import { TooltipProvider } from "@/components/ui/tooltip";
import type { ModelVisual, PromptRunRow, ResponseView } from "../../_lib/types";
import { ResponsesContent } from "./responses-table-view";

type ResponsesTabContentProps = {
  onlyErrors: boolean;
  setOnlyErrors: (value: boolean) => void;
  criticalOnly: boolean;
  setCriticalOnly: (value: boolean) => void;
  noMentionOnly: boolean;
  setNoMentionOnly: (value: boolean) => void;
  showHistorical: boolean;
  setShowHistorical: (value: boolean) => void;
  topCompetitor: string;
  setTopCompetitor: (value: string) => void;
  availableCompetitors: string[];
  viewMode: ResponseView;
  setViewMode: (value: ResponseView) => void;
  filteredResponses: PromptRunRow[];
  filteredResponsesTotal: number;
  hasMoreResponses: boolean;
  loadMoreResponses: () => void;
  setSelectedResponseId: (id: string | null) => void;
  getModelVisual: (model: string) => ModelVisual;
  rankTone: (rank: number) => string;
  truncate: (value: string, max?: number) => string;
};

export function ResponsesTabContent(props: ResponsesTabContentProps) {
  return (
    <TooltipProvider delayDuration={120}>
      <div className="m-0 flex min-h-0 flex-1 flex-col">
        <ResponsesContent {...props} />
      </div>
    </TooltipProvider>
  );
}
