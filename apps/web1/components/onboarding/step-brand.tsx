"use client";

import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type StepBrandProps = {
    hideBack?: boolean;
    nextLabel?: string;
};

const BRAND_PREP_MESSAGES = [
    "Cross-checking website copy and structure...",
    "Extracting brand entities and service categories...",
    "Building your editable brand profile...",
];

function PrimarySvgIcon({ src }: { src: string }) {
    return (
        <span
            aria-hidden="true"
            className="h-4 w-4 bg-primary"
            style={{
                maskImage: `url(${src})`,
                WebkitMaskImage: `url(${src})`,
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskPosition: "center",
                maskSize: "contain",
                WebkitMaskSize: "contain",
            }}
        />
    );
}

export function StepBrand({ hideBack = false, nextLabel = "Next" }: StepBrandProps) {
    const {
        brandName,
        setBrandName,
        brandShortDescription,
        setBrandShortDescription,
        brandDescription,
        setBrandDescription,
        industry,
        setIndustry,
        keyFeatures,
        setKeyFeatures,
        brandPersonas,
        setBrandPersonas,
        brandPreparationCompleted,
        setBrandPreparationCompleted,
        nextStep,
        prevStep,
    } = useOnboarding();

    const [newFeature, setNewFeature] = useState("");
    const [newPersona, setNewPersona] = useState("");
    const [isPreparingLocal, setIsPreparingLocal] = useState(true);
    const [prepProgress, setPrepProgress] = useState(0);
    const isPreparing = !brandPreparationCompleted && isPreparingLocal;

    useEffect(() => {
        if (brandPreparationCompleted) return;

        const durationMs = 15600;
        const start = Date.now();

        const progressTimer = setInterval(() => {
            const elapsed = Date.now() - start;
            const base = Math.min((elapsed / durationMs) * 100, 100);
            const withJitter = Math.min(base + Math.random() * 2, 100);
            setPrepProgress(Math.round(withJitter));

            if (base >= 100) {
                clearInterval(progressTimer);
                setPrepProgress(100);
                setTimeout(() => {
                    setBrandPreparationCompleted(true);
                    setIsPreparingLocal(false);
                }, 420);
            }
        }, 170);

        return () => {
            clearInterval(progressTimer);
        };
    }, [brandPreparationCompleted, setBrandPreparationCompleted]);

    const messageMotion = (index: number) => {
        const p = prepProgress;
        const windowSize = 3;

        if (index === 0) {
            if (p <= 33) return { opacity: 1, y: 0 };
            if (p >= 33 + windowSize) return { opacity: 0, y: -10 };
            const t = (p - 33) / windowSize;
            return { opacity: 1 - t, y: -10 * t };
        }

        if (index === 1) {
            if (p < 33) return { opacity: 0, y: 10 };
            if (p < 33 + windowSize) {
                const t = (p - 33) / windowSize;
                return { opacity: t, y: 10 * (1 - t) };
            }
            if (p <= 66) return { opacity: 1, y: 0 };
            if (p >= 66 + windowSize) return { opacity: 0, y: -10 };
            const t = (p - 66) / windowSize;
            return { opacity: 1 - t, y: -10 * t };
        }

        if (p < 66) return { opacity: 0, y: 10 };
        if (p < 66 + windowSize) {
            const t = (p - 66) / windowSize;
            return { opacity: t, y: 10 * (1 - t) };
        }
        return { opacity: 1, y: 0 };
    };

    const addFeature = () => {
        const value = newFeature.trim();
        if (!value || keyFeatures.includes(value)) return;
        setKeyFeatures([...keyFeatures, value]);
        setNewFeature("");
    };

    const addPersona = () => {
        const value = newPersona.trim();
        if (!value || brandPersonas.includes(value)) return;
        setBrandPersonas([...brandPersonas, value]);
        setNewPersona("");
    };

    if (isPreparing) {
        return (
            <div className="w-full min-h-[calc(100dvh-180px)] space-y-6 rounded-md bg-white p-4 sm:min-h-0 sm:p-8">
                <div className="flex flex-col items-center gap-4">
                    <p className="text-center text-sm font-bold text-primary">{prepProgress}%</p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear"
                            style={{ width: `${prepProgress}%` }}
                        />
                    </div>
                </div>
                <div className="flex justify-center">
                    <div className="relative flex min-h-8 w-full items-center justify-center overflow-hidden rounded-lg bg-primary/5 px-3 sm:px-4">
                        <Sparkles className="mr-2 size-4 shrink-0 text-primary" />
                        <div className="relative h-5 flex-1 overflow-hidden text-center">
                            {BRAND_PREP_MESSAGES.map((message, index) => {
                                const motion = messageMotion(index);
                                return (
                                    <p
                                        key={message}
                                        className="absolute left-0 right-0 top-0 flex items-center justify-center text-xs text-muted-foreground transition-all duration-300 sm:text-sm"
                                        style={{ opacity: motion.opacity, transform: `translateY(${motion.y}px)` }}
                                    >
                                        {message}
                                    </p>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full space-y-6 rounded-none bg-white p-6 sm:min-h-0 sm:p-8">
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">Brand Intelligence</h2>
                <p className="text-sm text-muted-foreground sm:text-base">We are analyzing your website to understand your products and target customers.</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="brand-short-description" className="text-sm font-semibold">Short Description</Label>
                <p className="text-xs text-muted-foreground">A brief summary of what your brand does.</p>
                <Textarea
                    id="brand-short-description"
                    className="min-h-[86px] text-sm"
                    value={brandShortDescription}
                    onChange={(e) => setBrandShortDescription(e.target.value)}
                    placeholder="A brief summary of what your brand does"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="brand-industry" className="text-sm font-semibold">Industry</Label>
                <p className="text-xs text-muted-foreground">The industry your brand operates in.</p>
                <Input
                    id="brand-industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="Independent Software Development Services"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="brand-description" className="text-sm font-semibold">Description</Label>
                <p className="text-xs text-muted-foreground">A detailed description of your brand.</p>
                <Textarea
                    id="brand-description"
                    className="min-h-[180px] text-sm"
                    value={brandDescription}
                    onChange={(e) => setBrandDescription(e.target.value)}
                    placeholder="Detailed description"
                />
            </div>

            <div className="space-y-3">
                <Label className="text-sm font-semibold">Key features</Label>
                <p className="text-xs text-muted-foreground">List at least 3 specific features of your product or service.</p>
                <div className="space-y-2">
                    {keyFeatures.map((feature, index) => (
                        <div key={`${feature}-${index}`} className="flex items-center gap-2 rounded-sm border border-border/80 px-3 py-2">
                            <Input
                                value={feature}
                                onChange={(e) => {
                                    const clone = [...keyFeatures];
                                    clone[index] = e.target.value;
                                    setKeyFeatures(clone);
                                }}
                                className="h-9 border-0 shadow-none focus-visible:ring-0"
                            />
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setKeyFeatures(keyFeatures.filter((_, i) => i !== index))}
                                aria-label="Delete feature"
                            >
                                <PrimarySvgIcon src="/delete.svg" />
                            </Button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Input
                        value={newFeature}
                        onChange={(e) => setNewFeature(e.target.value)}
                        placeholder="Add a key feature"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") addFeature();
                        }}
                    />
                    <Button variant="outline" size="sm" onClick={addFeature}>
                        Add feature
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="brand-name" className="text-sm font-semibold">Persona</Label>
                <p className="text-xs text-muted-foreground">Describe your ideal customer profile.</p>
                <Input
                    id="brand-name"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Brand name"
                />
                <div className="space-y-2">
                    {brandPersonas.map((persona, index) => (
                        <div key={`${persona}-${index}`} className="flex items-center gap-2 rounded-sm border border-border/80 px-3 py-2">
                            <Input
                                value={persona}
                                onChange={(e) => {
                                    const clone = [...brandPersonas];
                                    clone[index] = e.target.value;
                                    setBrandPersonas(clone);
                                }}
                                className="h-9 border-0 shadow-none focus-visible:ring-0"
                            />
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setBrandPersonas(brandPersonas.filter((_, i) => i !== index))}
                                aria-label="Delete persona"
                            >
                                <PrimarySvgIcon src="/delete.svg" />
                            </Button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Input
                        value={newPersona}
                        onChange={(e) => setNewPersona(e.target.value)}
                        placeholder="Add a persona"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") addPersona();
                        }}
                    />
                    <Button variant="outline" size="sm" onClick={addPersona}>
                        Add persona
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/70 pt-4">
                {hideBack ? <div /> : <Button variant="outline" onClick={prevStep}>Back</Button>}
                <Button className="min-w-36" onClick={nextStep} disabled={!brandName || !industry}>{nextLabel}</Button>
            </div>
        </div>
    );
}
