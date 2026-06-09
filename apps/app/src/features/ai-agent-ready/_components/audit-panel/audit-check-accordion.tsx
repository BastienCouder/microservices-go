import { ChevronDown, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils";

import type { AuditCheckResult } from "../../_lib/shared/types";
import { CopyPromptButton } from "./copy-prompt-button";
import { StatusBadge } from "./status-badge";

type AuditCheckAccordionProps = {
  check: AuditCheckResult;
  open: boolean;
  onToggle: () => void;
};

export function AuditCheckAccordion({
  check,
  open,
  onToggle,
}: AuditCheckAccordionProps) {
  const contentID = `audit-check-${check.id}`;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border transition duration-150",
        check.status === "fail"
          ? "border-destructive/20 bg-destructive/5"
          : "border-border/60 bg-muted/15",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
        aria-expanded={open}
        aria-controls={contentID}
        onClick={onToggle}
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-foreground sm:text-base">{check.label}</span>
            <StatusBadge status={check.status} />
            <span className="text-xs font-medium text-muted-foreground">
              {check.score}/{check.max_score}
            </span>
          </span>
          <span className="mt-2 block text-sm leading-6 text-muted-foreground">
            {check.issue}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition duration-150",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div id={contentID} className="border-t border-border/60 px-4 pb-4 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <DetailBlock title="Objectif" value={check.goal} />
            <DetailBlock title="Problème détecté" value={check.issue} />
            <DetailBlock title="Implémentation" value={check.how_to_implement} />
          </div>

          {check.evidence?.length ? (
            <div className="mt-4 rounded-xl border border-border/60 bg-background/80 p-4">
              <h4 className="text-sm font-semibold text-foreground">Preuves détectées</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
                {check.evidence.slice(0, 4).map((item) => (
                  <li key={item} className="break-words">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {check.resources.map((resource) => (
                <Button key={resource.url} asChild type="button" variant="outline" size="sm">
                  <a href={resource.url} target="_blank" rel="noreferrer">
                    {resource.label}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyPromptButton prompt={check.prompt} />
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function DetailBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/80 p-4">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{value}</p>
    </div>
  );
}
