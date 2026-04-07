import { useOnboarding, type PromptWithLanguage } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { FloatingPanelHeader } from "@/components/ui/floating-panel-header";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

const LANGUAGE_OPTIONS = [
    { value: "fr", label: "French (France)" },
    { value: "en", label: "English (United States)" },
    { value: "es", label: "Spanish" },
] as const;

const QUICK_TEMPLATES = [
    "best alternative to [brand]",
    "[brand] pricing vs competitors",
    "is [brand] reliable for enterprise",
    "top tools like [brand] in 2026",
] as const;

type StepPromptsProps = {
    hideBack?: boolean;
    nextLabel?: string;
};

export function StepPrompts({ hideBack = false, nextLabel = "Next" }: StepPromptsProps) {
    const { selectedPrompts, setSelectedPrompts, nextStep, prevStep } = useOnboarding();

    const updatePrompt = (index: number, nextValue: Partial<PromptWithLanguage>) => {
        const clone = [...selectedPrompts];
        clone[index] = {
            ...clone[index],
            text: clone[index]?.text ?? "",
            language: clone[index]?.language ?? "en",
            ...nextValue,
        };
        setSelectedPrompts(clone);
    };

    const addPrompt = (template?: string) => {
        setSelectedPrompts([
            ...selectedPrompts,
            {
                text: template ?? "",
                language: "en",
            },
        ]);
    };

    const removePrompt = (index: number) => {
        setSelectedPrompts(selectedPrompts.filter((_, i) => i !== index));
    };

    return (
        <div className="h-full w-full space-y-6 rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:min-h-0 sm:p-8">
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">Key Prompts to Monitor</h2>
                <p className="text-sm text-muted-foreground sm:text-base">
                    Add the questions your customers ask AI models. Keep prompts specific and realistic.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[250px_1fr]">
                <aside className="space-y-4">
                    <div className="rounded-xl border border-border/70 bg-zinc-50/70 p-4">
                        <Label className="text-sm font-semibold">Template Library</Label>
                        <p className="mt-1 text-xs text-muted-foreground">Click a template to add it instantly.</p>
                        <div className="mt-3 space-y-2">
                            {QUICK_TEMPLATES.map((template) => (
                                <button
                                    key={template}
                                    type="button"
                                    onClick={() => addPrompt(template)}
                                    className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                                >
                                    {template}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-zinc-50/70 p-4">
                        <p className="text-sm font-semibold text-foreground">Prompt checklist</p>
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <li>Be specific about use case</li>
                            <li>Include brand or competitor context</li>
                            <li>Use real user phrasing</li>
                        </ul>
                    </div>
                </aside>

                <section className="space-y-4 lg:flex lg:h-[560px] lg:flex-col">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-zinc-50/70 px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-foreground">Prompt Workspace</p>
                            <p className="text-xs text-muted-foreground">{selectedPrompts.length} prompts configured</p>
                        </div>
                        <Button variant="outline" onClick={() => addPrompt()}>
                            <Plus className="size-4 text-primary" />
                            Add Prompt
                        </Button>
                    </div>

                    <div className="space-y-4 lg:flex-1 lg:overflow-y-auto lg:pr-1">
                        {selectedPrompts.map((prompt, index) => (
                            <div key={`${index}-${prompt.text}`} className="space-y-3 rounded-xl border border-border/70 bg-background p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                                <div className="flex items-start gap-2">
                                    <Textarea
                                        value={prompt.text}
                                        onChange={(e) => updatePrompt(index, { text: e.target.value })}
                                        className="min-h-[96px] bg-background text-sm"
                                        placeholder="Type a prompt to monitor"
                                    />
                                    <Button variant="outline" size="icon" onClick={() => removePrompt(index)} aria-label="Delete prompt">
                                        <Trash2 className="size-4 text-primary" />
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[130px_1fr] sm:items-center">
                                    <Label className="text-xs font-medium text-muted-foreground">Language</Label>
                                    <Select
                                        value={prompt.language || "en"}
                                        onValueChange={(value: "fr" | "en" | "es") => updatePrompt(index, { language: value })}
                                    >
                                        <SelectTrigger className="h-10 rounded-lg border-border/80 bg-background text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="p-0">
                                            <FloatingPanelHeader
                                                title="Language"
                                                description="Choose the language used for this monitored prompt."
                                                className="px-3.5 pt-3.5"
                                            />
                                            {LANGUAGE_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <div className="flex items-center justify-between border-t border-border/70 pt-4">
                {hideBack ? <div /> : <Button variant="outline" onClick={prevStep}>Back</Button>}
                <Button className="min-w-36" onClick={nextStep} disabled={selectedPrompts.length < 1}>
                    {nextLabel}
                </Button>
            </div>
        </div>
    );
}
