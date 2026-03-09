import { useOnboarding, type CompetitorItem } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { useState } from "react";

type StepCompetitorsProps = {
    hideBack?: boolean;
    nextLabel?: string;
};

export function StepCompetitors({ hideBack = false, nextLabel = "Next" }: StepCompetitorsProps) {
    const { competitors, setCompetitors, nextStep, prevStep } = useOnboarding();
    const [newName, setNewName] = useState("");
    const [newWebsite, setNewWebsite] = useState("");

    const addCompetitor = () => {
        const name = newName.trim();
        const website = newWebsite.trim();
        if (!name || !website) return;

        const alreadyExists = competitors.some((item) => item.name.toLowerCase() === name.toLowerCase());
        if (alreadyExists) return;

        const newItem: CompetitorItem = {
            name,
            website,
            logo: name.slice(0, 2).toUpperCase(),
        };

        setCompetitors([...competitors, newItem]);
        setNewName("");
        setNewWebsite("");
    };

    return (
     <div className="h-full w-full space-y-6 rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:min-h-0 sm:p-8">
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">Competitive Landscape</h2>
                <p className="text-sm text-muted-foreground sm:text-base">Identify your top competitors to monitor how you compare in AI recommendations.</p>
            </div>

            <div className="space-y-2">
                <Label className="text-sm font-semibold">Competitors</Label>
                <p className="text-xs text-muted-foreground">For best results, list at least 5 competitors that are relevant to your brand.</p>
            </div>

            <div className="space-y-3">
                {competitors.map((competitor, index) => (
                    <div key={`${competitor.name}-${index}`} className="grid grid-cols-[1fr_1fr_44px] items-center gap-2">
                        <Input
                            value={competitor.name}
                            onChange={(e) => {
                                const clone = [...competitors];
                                clone[index] = { ...clone[index], name: e.target.value };
                                setCompetitors(clone);
                            }}
                            className="h-11"
                        />
                        <Input
                            value={competitor.website}
                            onChange={(e) => {
                                const clone = [...competitors];
                                clone[index] = { ...clone[index], website: e.target.value };
                                setCompetitors(clone);
                            }}
                            className="h-11"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCompetitors(competitors.filter((_, i) => i !== index))}
                            aria-label="Remove competitor"
                        >
                            <Trash2 className="size-4 text-primary" />
                        </Button>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Competitor name" />
                <Input value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} placeholder="https://example.com" />
                <Button variant="outline" size={'sm'} onClick={addCompetitor}>
                    Add Competitor
                </Button>
            </div>

            <div className="flex items-center justify-between border-t border-border/70 pt-4">
                {hideBack ? <div /> : <Button variant="outline" onClick={prevStep}>Back</Button>}
                <Button className="min-w-36" onClick={nextStep} disabled={competitors.length < 1}>{nextLabel}</Button>
            </div>
        </div>
    );
}
