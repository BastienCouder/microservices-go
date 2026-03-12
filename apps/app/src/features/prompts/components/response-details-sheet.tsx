"use client";

import { Badge } from "@/components/ui/badge";
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
              <SheetTitle>Details de la reponse</SheetTitle>
              <SheetDescription>
                {response.model} · {response.time}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-6 text-sm">
              {response.isHistorical ? (
                <div className="flex">
                  <Badge variant="outline" className="font-normal">
                    Historique
                  </Badge>
                </div>
              ) : null}
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">Prompt</div>
                <p className="mt-1 font-medium">{response.prompt}</p>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">Reponse</div>
                <p className="mt-1 leading-relaxed">{response.response}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Mention</div>
                  <div className="mt-1 font-semibold">{response.mention ? "Oui" : "Non"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Classement</div>
                  <div className="mt-1 font-semibold">{response.rank ?? "-"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Concurrent</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {response.competitors.length > 0 ? (
                      response.competitors.map((competitor) => (
                        <span key={competitor} className="rounded-full border px-2 py-1 text-xs font-medium">
                          {competitor}
                        </span>
                      ))
                    ) : (
                      <span className="font-semibold">Aucun</span>
                    )}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Erreur</div>
                  <div className="mt-1 font-semibold">{response.error ?? "-"}</div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">Points cles</div>
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
