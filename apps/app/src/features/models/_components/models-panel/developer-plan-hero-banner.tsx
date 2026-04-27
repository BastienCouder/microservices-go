"use client";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type DeveloperPlanHeroBannerProps = {
  currentPlanLabel: string | null;
};

export function DeveloperPlanHeroBanner({
  currentPlanLabel,
}: DeveloperPlanHeroBannerProps) {
  return (
    <section className="relative overflow-hidden rounded-md bg-linear-to-br from-primary via-primary to-primary/80 p-4 text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.14)] md:p-5">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_74%_72%,rgba(255,255,255,0.08),transparent_28%)] opacity-80" />
        <div className="absolute right-[22%] h-full w-px bg-white/14" />
        <div className="absolute left-[28%] top-[28%] h-full w-px bg-white/8" />
        <div className="absolute bottom-[30%] left-[38%] h-px w-full bg-white/12" />
        <div className="absolute bottom-[22%] left-[6%] right-[24%] h-px w-full bg-white/8" />
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="">
            <h3 className="max-w-[32rem] text-xl font-semibold leading-tight tracking-tight text-white md:text-2xl">
              Activez vos propres clés API LLM et profitez d’une utilisation illimitée
            </h3>
            <p className="max-w-[44rem] w-full mt-2 text-sm text-primary-foreground/82">
              {currentPlanLabel
                ? `Vous êtes actuellement sur le plan ${currentPlanLabel}.`
                : "Votre plan actuel n'inclut pas le mode Developer."}{" "}
        
              Passez en mode développeur pour connecter facilement OpenAI, Anthropic, Google, Mistral AI et d’autres services, en toute autonomie avec vos identifiants.
            </p>
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-transparent bg-white/20 text-white backdrop-blur-sm">
            <ArrowRight className="h-5 w-5" />
          </div>
        </div>

        <div className="absolute bottom-0 right-0">
          <Button variant="secondary">Activer le mode developer</Button>
        </div>
      </div>
    </section>
  );
}
