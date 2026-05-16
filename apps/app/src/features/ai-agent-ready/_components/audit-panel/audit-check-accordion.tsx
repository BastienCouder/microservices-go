import { ChevronDown, ExternalLink, SlidersHorizontal } from "lucide-react";

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
        "overflow-hidden rounded-[18px] border bg-[#fffaf5] transition duration-150",
        check.status === "fail"
          ? "border-[#df4c4c]/25 bg-[#fff6f4]"
          : "border-[#eadfd3]",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
        aria-expanded={open}
        aria-controls={contentID}
        onClick={onToggle}
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-3">
            <span className="text-base font-extrabold text-[#3a2418]">{check.label}</span>
            <StatusBadge status={check.status} />
          </span>
          <span className="mt-2 block text-sm leading-6 text-[#866d5d]">
            {check.issue}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-[#866d5d] transition duration-150",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div id={contentID} className="border-t border-[#eadfd3] px-5 pb-5 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <DetailBlock title="Goal" value={check.goal} />
            <DetailBlock title="Issue detected" value={check.issue} />
            <DetailBlock title="How to implement" value={check.how_to_implement} />
          </div>

          {check.evidence?.length ? (
            <div className="mt-4 rounded-[14px] border border-[#eadfd3] bg-[#fffdf9] p-4">
              <h4 className="text-sm font-extrabold text-[#3a2418]">Evidence</h4>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-[#866d5d]">
                {check.evidence.slice(0, 4).map((item) => (
                  <li key={item} className="break-words">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {check.resources.map((resource) => (
                <a
                  key={resource.url}
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#eadfd3] bg-[#fffdf9] px-3 py-1.5 text-sm font-bold text-[#3a2418] transition hover:border-[#f26a21]/50 hover:bg-[#fff3e8]"
                >
                  {resource.label}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ))}
            </div>
            <div className="flex gap-2">
              <CopyPromptButton prompt={check.prompt} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-[14px] border-[#eadfd3] bg-[#fffdf9] text-[#3a2418] hover:bg-[#fff3e8]"
              >
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                Details
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function DetailBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[#eadfd3] bg-[#fffdf9] p-4">
      <h4 className="text-sm font-extrabold text-[#3a2418]">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-[#866d5d]">{value}</p>
    </div>
  );
}
