"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { parseResponseRichTextBlocks } from "../../_lib/response-rich-text";

function renderInlineRichText(content: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|<(https?:\/\/[^>\s]+)>|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(content.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      nodes.push(
        <a
          key={`${match.index}-link`}
          href={match[3]}
          target="_blank"
          rel="noreferrer"
          className="break-all font-medium text-primary underline underline-offset-4"
        >
          {match[2]}
        </a>,
      );
    } else if (match[4]) {
      nodes.push(
        <a
          key={`${match.index}-autolink`}
          href={match[4]}
          target="_blank"
          rel="noreferrer"
          className="break-all font-medium text-primary underline underline-offset-4"
        >
          {match[4]}
        </a>,
      );
    } else if (match[5]) {
      nodes.push(
        <strong key={`${match.index}-strong`} className="font-semibold text-foreground">
          {match[5]}
        </strong>,
      );
    } else if (match[6]) {
      nodes.push(
        <em key={`${match.index}-em`} className="italic text-foreground">
          {match[6]}
        </em>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex));
  }

  return nodes;
}

function renderTableCellClassName(compact: boolean) {
  return compact
    ? "min-w-32 px-3 py-2 align-top text-xs leading-5 break-normal whitespace-normal text-foreground/90 [overflow-wrap:normal]"
    : "min-w-40 px-4 py-3 align-top text-sm leading-6 break-normal whitespace-normal text-foreground/90 [overflow-wrap:normal]";
}

export function RichResponseText({
  content,
  compact = false,
  className,
}: {
  content: string;
  compact?: boolean;
  className?: string;
}) {
  const blocks = parseResponseRichTextBlocks(content);

  return (
    <div className={cn("space-y-4", compact && "space-y-3", className)}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3
              key={`heading-${index}`}
              className={cn(
                "scroll-m-20 font-semibold tracking-tight text-foreground",
                compact ? "text-sm" : block.level <= 2 ? "text-lg" : "text-base",
              )}
            >
              {renderInlineRichText(block.content)}
            </h3>
          );
        }

        if (block.type === "ul") {
          return (
            <ul
              key={`ul-${index}`}
              className={cn(
                "list-disc pl-5 marker:text-primary",
                compact ? "space-y-1.5 text-xs leading-6" : "space-y-2 text-sm leading-7",
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`ul-item-${itemIndex}`}>{renderInlineRichText(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol
              key={`ol-${index}`}
              className={cn(
                "list-decimal pl-5 marker:font-semibold marker:text-primary",
                compact ? "space-y-1.5 text-xs leading-6" : "space-y-2 text-sm leading-7",
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`ol-item-${itemIndex}`}>{renderInlineRichText(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "table") {
          const columnCount = Math.max(block.headers.length, ...block.rows.map((row) => row.length));

          return (
            <div key={`table-${index}`} className="space-y-3 [overflow-wrap:normal]">
              <div className="space-y-3 md:hidden">
                {block.rows.map((row, rowIndex) => (
                  <div
                    key={`table-card-${rowIndex}`}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    {Array.from({ length: columnCount }).map((_, cellIndex) => (
                      <div
                        key={`table-card-${rowIndex}-cell-${cellIndex}`}
                        className={cn(
                          "space-y-1.5 py-2",
                          cellIndex > 0 && "border-t border-slate-100",
                        )}
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground break-normal [overflow-wrap:normal]">
                          {renderInlineRichText(block.headers[cellIndex] ?? `Col ${cellIndex + 1}`)}
                        </div>
                        <div className="min-w-0 text-sm leading-6 break-words text-foreground/90">
                          {renderInlineRichText(row[cellIndex] ?? "—")}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <div className="overflow-x-auto rounded-xl border border-slate-200 [overflow-wrap:normal]">
                  <table
                    className={cn(
                      "min-w-max w-full border-collapse text-left break-normal [overflow-wrap:normal]",
                      compact ? "text-xs" : "text-sm",
                    )}
                  >
                    <thead className="bg-slate-50/80">
                      <tr>
                        {Array.from({ length: columnCount }).map((_, cellIndex) => (
                          <th
                            key={`table-head-${cellIndex}`}
                            className={cn(
                              renderTableCellClassName(compact),
                              "border-b border-slate-200 font-semibold text-foreground",
                            )}
                          >
                            {renderInlineRichText(block.headers[cellIndex] ?? "")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, rowIndex) => (
                        <tr key={`table-row-${rowIndex}`} className="border-b border-slate-100 last:border-b-0">
                          {Array.from({ length: columnCount }).map((_, cellIndex) => (
                            <td
                              key={`table-row-${rowIndex}-cell-${cellIndex}`}
                              className={renderTableCellClassName(compact)}
                            >
                              {renderInlineRichText(row[cellIndex] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        }

        return (
          <p
            key={`p-${index}`}
            className={cn(compact ? "text-xs leading-6 text-foreground/90" : "text-sm leading-7 text-foreground/90")}
          >
            {renderInlineRichText(block.content)}
          </p>
        );
      })}
    </div>
  );
}
