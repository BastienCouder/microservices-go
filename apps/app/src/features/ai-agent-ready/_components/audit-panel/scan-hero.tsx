import { CircleHelp, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

import { CHECK_GROUPS } from "../../_lib/audit/audit-config";

type ScanHeroProps = {
  url: string;
  urlError: string;
  canScan: boolean;
  isScanning: boolean;
  loadingProject?: boolean;
  projectName?: string;
  onAnalyze: () => void;
};

export function ScanHero({
  url,
  urlError,
  canScan,
  isScanning,
  loadingProject = false,
  projectName = "",
  onAnalyze,
}: ScanHeroProps) {
  const { t } = useScopedI18n("ai-agent-ready");
  const title = projectName
    ? t("heroTitleProject", { projectName })
    : t("heroTitleFallback");

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-4 pt-5">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {t("heroDescription")}
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto justify-start p-0 text-muted-foreground"
            >
              <CircleHelp className="size-4" aria-hidden="true" />
              {t("heroSeeChecks")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("heroChecksTitle")}</DialogTitle>
              <DialogDescription>{t("heroChecksDescription")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {CHECK_GROUPS.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div className="text-sm font-semibold text-foreground">
                    {t(`checkGroup_${group.id}_label`)}
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {group.checks
                      .filter((check) => !check.disabled)
                      .map((check) => (
                        <li key={check.id} className="flex gap-2">
                          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span>
                            <span className="font-medium text-foreground">
                              {t(`check_${check.id}_label`)}
                            </span>
                            {" - "}
                            {t(`check_${check.id}_description`)}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <form
          className="flex flex-col gap-3 lg:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            onAnalyze();
          }}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={url}
                placeholder="https://example.com"
                className="h-11 rounded-xl border-border/70 bg-background pl-9"
                readOnly
              />
            </div>
            {loadingProject ? (
              <p className="text-sm text-muted-foreground">{t("heroLoadingUrl")}</p>
            ) : null}
            {!loadingProject && urlError ? (
              <p className="text-sm font-medium text-destructive">{urlError}</p>
            ) : null}
            {!loadingProject && !url && !urlError ? (
              <p className="text-sm text-muted-foreground">
                {t("heroNoUrl")}
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={!canScan} className="min-w-44 self-end">
            {isScanning ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isScanning ? t("heroScanning") : t("heroAnalyze")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
