import { Clock3, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { AnimatedWave } from "@/features/onboarding/animated-wave";
import { OnboardingStep } from "@/features/onboarding/step-shell";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

export function ContentOptimizerLayout() {
  const { t } = useScopedI18n("content-optimizer");

  return (
    <div className="relative flex h-full min-h-[calc(100vh-2rem)] overflow-hidden rounded-md bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_34%),linear-gradient(180deg,_#f8f9fc_0%,_#f1f3f8_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <AnimatedWave />
      </div>

      <div className="relative z-10 flex w-full items-center justify-center px-4 py-8 md:px-8">
        <div className="w-full max-w-[760px]">
          <OnboardingStep
            title={
              <div className="flex flex-wrap justify-center items-center gap-2">
                <span>{t("title")}</span>
              </div>
            }
            description={t("description")}
            className="border-white/80 bg-white/90"
            contentClassName="space-y-5"
          >
           <></>
          </OnboardingStep>
        </div>
      </div>
    </div>
  );
}
