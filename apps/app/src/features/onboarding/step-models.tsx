import { Button } from "@/components/ui/button";
import { ModelCard } from "@/features/monitoring/components/filters-panel/model-card";
import { useOnboarding } from "@/hooks/use-onboarding";

const AI_MODELS = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    modelGroup: "ChatGPT",
    description: "OpenAI chat interface",
    icon: "/models/openai.svg",
    live: true,
  },
  {
    id: "perplexity",
    name: "Perplexity Search",
    modelGroup: "Perplexity",
    description: "Live web search answers",
    icon: "/models/perplexity.svg",
    live: true,
  },
  {
    id: "gemini-pro",
    name: "Gemini Pro",
    modelGroup: "Gemini",
    description: "Google Gemini web interface",
    icon: "/models/gemini.svg",
    live: true,
  },
  {
    id: "copilot",
    name: "Microsoft Copilot",
    modelGroup: "Copilot",
    description: "Microsoft grounded answers",
    icon: "/models/copilot.svg",
    live: true,
  },
  {
    id: "claude",
    name: "Claude Sonnet",
    modelGroup: "Claude",
    description: "Anthropic conversational model",
    icon: "/models/claude.svg",
    live: false,
  },
  {
    id: "mistral",
    name: "Mistral Large",
    modelGroup: "Mistral",
    description: "Mistral chat experience",
    icon: "/models/mistral.svg",
    live: false,
  },
] as const;

type StepModelsProps = {
  hideBack?: boolean;
  nextLabel?: string;
};

export function StepModels({
  hideBack = false,
  nextLabel = "Start audit",
}: StepModelsProps) {
  const { selectedModels, setSelectedModels, nextStep, prevStep } =
    useOnboarding();

  const toggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels(selectedModels.filter((id) => id !== modelId));
      return;
    }

    setSelectedModels([...selectedModels, modelId]);
  };

  return (
    <div className="w-full min-h-[calc(100dvh-180px)] space-y-6 rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:min-h-0 sm:p-8">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">
          AI models to monitor
        </h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          Choose where you want to track your brand before the first analysis
          starts.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[24px] border border-border/70 bg-muted/20 px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          {selectedModels.length} selected
        </span>
        <span className="text-sm text-muted-foreground">
          You can change this later from the Models page.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {AI_MODELS.map((model) => {
          const selected = selectedModels.includes(model.id);

          return (
            <div key={model.id} className="relative">
              <span
                className={[
                  "pointer-events-none absolute left-3 top-3 z-10 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  model.live
                    ? "bg-primary/12 text-primary"
                    : "bg-zinc-900/6 text-zinc-600",
                ].join(" ")}
              >
                {model.live ? "Live" : "Chat"}
              </span>
              <ModelCard
                name={model.name}
                description={model.description}
                icon={model.icon}
                selected={selected}
                onClick={() => toggleModel(model.id)}
                modelGroup={model.modelGroup}
                size="models"
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border/70 pt-4">
        {hideBack ? <div /> : <Button variant="outline" onClick={prevStep}>Back</Button>}
        <Button
          className="min-w-36"
          onClick={nextStep}
          disabled={selectedModels.length < 1}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
