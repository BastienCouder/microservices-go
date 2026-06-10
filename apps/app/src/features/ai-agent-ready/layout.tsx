import { memo } from "react";
import { Clock3, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { AnimatedWave } from "@/features/onboarding/animated-wave";
import { OnboardingStep } from "@/features/onboarding/step-shell";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

type AgentReadyLayoutProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export const AgentReadyLayout = memo(function AgentReadyLayout({
  apiBaseURL: _apiBaseURL,
  routeSearch: _routeSearch,
}: AgentReadyLayoutProps) {
  const { t } = useScopedI18n("ai-agent-ready");

  return (
    <div className="relative flex h-full min-h-[calc(100vh-2rem)] overflow-hidden rounded-md bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_34%),linear-gradient(180deg,_#f8f9fc_0%,_#f1f3f8_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <AnimatedWave />
      </div>

      <div className="relative z-10 flex w-full items-center justify-center px-4 py-8 md:px-8">
        <div className="w-full max-w-[760px]">
          <OnboardingStep
            title={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span>{t("title")}</span>
                <Badge variant="secondary" className="gap-1 rounded-full px-3 py-1 text-xs">
                  <Clock3 className="h-3.5 w-3.5" />
                  {t("badge")}
                </Badge>
              </div>
            }
            description={t("description")}
            className="border-white/80 bg-white/90"
            contentClassName="space-y-5"
          >
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-5 text-left shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("cardTitle")}
              </div>
              <p className="text-sm leading-6 text-slate-600">{t("cardDescription")}</p>
            </div>
          </OnboardingStep>
        </div>
      </div>
    </div>
  );
});
