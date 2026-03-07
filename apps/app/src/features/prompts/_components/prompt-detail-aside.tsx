"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PromptItem } from "./types";

type PromptDetailAsideProps = {
  selectedPrompt: PromptItem | null;
  onRunSelect: (runId: string) => void;
};

export function PromptDetailAside({ selectedPrompt, onRunSelect }: PromptDetailAsideProps) {
  if (!selectedPrompt) return null;

  return (
    <aside className="hidden w-96 shrink-0 border-l 2xl:block">
      <div className="h-full overflow-auto p-5">
        <h3 className="text-lg font-semibold">{selectedPrompt.prompt}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>{selectedPrompt.stage}</Badge>
          {selectedPrompt.persona ? <Badge variant="outline">{selectedPrompt.persona}</Badge> : null}
        </div>

        <div className="mt-4 space-y-2">
          <div className="text-sm font-medium">30-day trend mini chart</div>
          <div className="flex h-14 items-end gap-1 rounded-md border p-2">
            {selectedPrompt.trend30d.map((value, index) => (
              <div
                key={`${selectedPrompt.id}-${index}`}
                className="w-full rounded-sm bg-primary/70"
                style={{ height: `${Math.max(10, value)}%` }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Mention Rate</span>
            <span className="font-semibold">{selectedPrompt.mentionRate}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Runs</span>
            <span className="font-semibold">{selectedPrompt.runs.length} total</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">SOV</span>
            <span className="font-semibold">{selectedPrompt.sov}%</span>
          </div>
        </div>

        <div className="mt-5">
          <h4 className="mb-2 text-sm font-semibold">Latest runs</h4>
          <div className="space-y-2">
            {selectedPrompt.runs.length === 0 && (
              <div className="rounded-md border p-3 text-xs text-muted-foreground">No recent runs.</div>
            )}
            {selectedPrompt.runs.slice(0, 5).map((run) => (
              <button
                type="button"
                key={run.id}
                onClick={() => onRunSelect(run.id)}
                className="w-full rounded-md border p-3 text-left text-xs hover:bg-muted"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{run.model}</span>
                  <span className="text-muted-foreground">{run.minutesAgo}min</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {run.mention ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                  )}
                  <span>{run.rank ? `#${run.rank}` : "No mention"}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
