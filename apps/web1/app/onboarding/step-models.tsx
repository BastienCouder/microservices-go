"use client";

import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const AI_MODELS = [
    { id: "gpt-4o", name: "ChatGPT", description: "Access web search results", live: true },
    { id: "perplexity", name: "Perplexity Search", description: "Online model with real-time web index", live: true },
    { id: "google-ai-overview", name: "AI Overviews", description: "Google AI Overviews inside Search", live: true },
    { id: "google-ai-mode", name: "AI Mode", description: "Google AI Mode inside Search", live: true },
    { id: "copilot", name: "Microsoft Copilot", description: "Copilot with web grounding", live: true },
    { id: "gemini-pro", name: "Google Gemini", description: "Gemini web interface", live: true },
    { id: "grok", name: "Grok AI", description: "Grok web interface", live: true },
    { id: "gpt-5", name: "GPT 5 (Chat)", description: "OpenAI Chat interface", live: false },
    { id: "deepseek", name: "DeepSeek", description: "DeepSeek Chat", live: false },
    { id: "mistral", name: "Mistral", description: "Mistral Large used in chat", live: false },
    { id: "gpt-oss", name: "GPT OSS 120B", description: "GPT OSS via Groq", live: false },
    { id: "claude", name: "Claude", description: "Claude Sonnet in chat", live: false },
] as const;

type StepModelsProps = {
    hideBack?: boolean;
    nextLabel?: string;
};

export function StepModels({ hideBack = false, nextLabel = "Start Audit" }: StepModelsProps) {
    const { selectedModels, setSelectedModels, nextStep, prevStep } = useOnboarding();

    const toggleModel = (modelId: string) => {
        if (selectedModels.includes(modelId)) {
            setSelectedModels(selectedModels.filter((id) => id !== modelId));
            return;
        }
        setSelectedModels([...selectedModels, modelId]);
    };

    return (
          <div className="w-full min-h-[calc(100dvh-180px)] space-y-6 rounded-md bg-white p-6 sm:min-h-0 sm:p-8">
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">AI Models to Monitor</h2>
                <p className="text-sm text-muted-foreground sm:text-base">Choose the AI models where you want to track your brand&apos;s visibility.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {AI_MODELS.map((model) => {
                    const selected = selectedModels.includes(model.id);

                    return (
                        <button
                            key={model.id}
                            type="button"
                            onClick={() => toggleModel(model.id)}
                            className={`relative rounded-xl border p-4 text-left transition ${selected ? "border-primary bg-primary/[0.03] shadow-sm" : "border-border/80 bg-white hover:border-primary/40"}`}
                        >
                            {model.live ? (
                                <span className="absolute left-4 top-2 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">Live</span>
                            ) : (
                                <span className="absolute left-4 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Chat</span>
                            )}
                            <div className="absolute right-3 top-3">
                                <Checkbox checked={selected} onCheckedChange={() => toggleModel(model.id)} />
                            </div>
                            <div className="pt-5">
                                <p className="text-base font-semibold text-zinc-950 sm:text-lg">{model.name}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{model.description}</p>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center justify-between border-t border-border/70 pt-4">
                {hideBack ? <div /> : <Button variant="outline" onClick={prevStep}>Back</Button>}
                <Button className="min-w-36" onClick={nextStep} disabled={selectedModels.length < 1}>{nextLabel}</Button>
            </div>
        </div>
    );
}
