import type { ReactNode } from "react";
import { Building2, Globe, ListChecks, Radar, Sparkles } from "lucide-react";
import { useOnboarding } from "@/hooks/use-onboarding";

const STEP_LABELS = [
  "Website",
  "Brand profile",
  "Competitors",
  "Prompts",
  "Models",
  "Analysis",
] as const;

export function OnboardingLeftPanel() {
  const {
    step,
    totalSteps,
    websiteUrl,
    brandName,
    competitors,
    selectedPrompts,
    selectedModels,
  } = useOnboarding();

  return (
    <aside className="hidden h-full w-[42%] min-w-[420px] shrink-0 border-r border-white/60 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92)_0%,_rgba(244,247,252,0.9)_100%)] p-8 lg:flex lg:flex-col xl:min-w-[480px]">
    
    </aside>
  );
}

function SummaryTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/80 bg-white/70 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <span className="text-xs font-medium tracking-[0.14em] uppercase text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}
