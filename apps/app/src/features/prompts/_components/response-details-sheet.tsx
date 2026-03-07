"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PromptRunRow } from "./types";

type ResponseDetailsSheetProps = {
  response: PromptRunRow | null;
  onOpenChange: (open: boolean) => void;
};

export function ResponseDetailsSheet({ response, onOpenChange }: ResponseDetailsSheetProps) {
  return (
    <Sheet open={response !== null} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        {response && (
          <>
            <SheetHeader>
              <SheetTitle>Response details</SheetTitle>
              <SheetDescription>
                {response.model} · {response.time}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-6 text-sm">
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">Prompt</div>
                <p className="mt-1 font-medium">{response.prompt}</p>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">Response</div>
                <p className="mt-1 leading-relaxed">{response.response}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Mention</div>
                  <div className="mt-1 font-semibold">{response.mention ? "Yes" : "No"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Rank</div>
                  <div className="mt-1 font-semibold">{response.rank ?? "-"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Concurrent</div>
                  <div className="mt-1 font-semibold">{response.competitor}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Error</div>
                  <div className="mt-1 font-semibold">{response.error ?? "-"}</div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">Highlights</div>
                <ul className="mt-2 space-y-1">
                  {response.highlights.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
