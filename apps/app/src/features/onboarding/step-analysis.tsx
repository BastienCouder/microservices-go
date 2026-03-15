import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/use-onboarding";

type StepAnalysisProps = {
    hideBack?: boolean;
};

export function StepAnalysis({ hideBack = false }: StepAnalysisProps) {
    const { websiteUrl, brandName, selectedPrompts, selectedModels, prevStep } = useOnboarding();
    const navigate = useNavigate();
    const [progress, setProgress] = useState(10);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((oldProgress) => Math.min(oldProgress + Math.random() * 7, 100));
        }, 350);

        return () => {
            clearInterval(timer);
        };
    }, []);

    return (
        <div className="w-full min-h-[calc(100dvh-180px)] space-y-6 rounded-[32px] border border-white/70 bg-white/95 p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:min-h-0 sm:p-8">
            <div>
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">Analyzing Brand Visibility</h2>
                <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                    We are querying {selectedModels.length} AI models with {selectedPrompts.length} prompts for <strong>{brandName || "your brand"}</strong>.
                </p>
            </div>

            <div className="space-y-2">
                <Progress value={progress} className="h-3" />
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Running audit pipeline...</span>
                    <span>{Math.round(progress)}%</span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-left text-sm text-zinc-700 sm:grid-cols-2">
                <div className="rounded-md border border-border/80 p-3">Website: {websiteUrl || "not provided"}</div>
                <div className="rounded-md border border-border/80 p-3">Competitors benchmarked</div>
                <div className="rounded-md border border-border/80 p-3">Prompts clustered by intent</div>
                <div className="rounded-md border border-border/80 p-3">Visibility score generated</div>
            </div>

            <div className="flex items-center justify-between border-t border-border/70 pt-4">
                {hideBack ? <div /> : <Button variant="outline" onClick={prevStep}>Back</Button>}
                <Button onClick={() => navigate("/monitoring")} disabled={progress < 95}>Go to monitoring</Button>
            </div>
        </div>
    );
}
