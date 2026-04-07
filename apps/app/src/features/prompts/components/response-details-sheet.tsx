"use client";

import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { PromptRunRow } from "./types";

type ResponseDetailsSheetProps = {
  response: PromptRunRow | null;
  onOpenChange: (open: boolean) => void;
};

export function ResponseDetailsSheet({ response, onOpenChange }: ResponseDetailsSheetProps) {
  const { t } = useScopedI18n("prompts-workspace");

  return (
    <Sheet open={response !== null} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        {response && (
          <>
            <SheetHeader>
              <SheetTitle>{t("responseDetailsTitle")}</SheetTitle>
              <SheetDescription>
                {response.model} · {response.time}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-6 text-sm">
              {response.isHistorical ? (
                <div className="flex">
                  <Badge variant="outline" className="font-normal">
                    {t("historical")}
                  </Badge>
                </div>
              ) : null}
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">{t("prompt")}</div>
                <p className="mt-1 font-medium">{response.prompt}</p>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">{t("response")}</div>
                <p className="mt-1 leading-relaxed">{response.response}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">{t("mention")}</div>
                  <div className="mt-1 font-semibold">{response.mention ? t("yes") : t("no")}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">{t("rank")}</div>
                  <div className="mt-1 font-semibold">{response.rank ?? "-"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">{t("competitor")}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {response.competitors.length > 0 ? (
                      response.competitors.map((competitor) => (
                        <span key={competitor} className="rounded-full border px-2 py-1 text-xs font-medium">
                          {competitor}
                        </span>
                      ))
                    ) : (
                      <span className="font-semibold">{t("none")}</span>
                    )}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">{t("error")}</div>
                  <div className="mt-1 font-semibold">{response.error ?? "-"}</div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">{t("keyPoints")}</div>
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
