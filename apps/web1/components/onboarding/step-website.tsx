"use client";

import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

type StepWebsiteProps = {
    isDemo?: boolean;
};

export function StepWebsite({ isDemo = false }: StepWebsiteProps) {
    const {
        websiteUrl,
        setWebsiteUrl,
        brandName,
        setBrandName,
        setBrandShortDescription,
        setBrandDescription,
        setIndustry,
        setKeyFeatures,
        setBrandPersonas,
        setCompetitors,
        setSelectedPrompts,
        nextStep,
    } = useOnboarding();

    const handleNext = async () => {
        if (!websiteUrl || (isDemo && !brandName.trim())) return;

        if (!isDemo) {
            const domain = websiteUrl.replace("https://", "").replace("http://", "").replace("www.", "").split(".")[0];
            const formattedName = domain.charAt(0).toUpperCase() + domain.slice(1);

            if (!brandName.trim()) {
                setBrandName(formattedName);
            }

            setBrandShortDescription(`The #1 AI-powered solution for ${domain}`);
            setBrandDescription(
                `${formattedName} helps companies streamline their operations with cutting-edge artificial intelligence. Our platform integrates seamlessly with your existing workflow to boost productivity.`,
            );
            setIndustry("B2B SaaS / Technology");
            setKeyFeatures(["AI Automation", "Real-time Analytics", "Seamless Integration", "Enterprise Security"]);
            setBrandPersonas(["CTO", "Product Manager", "Operations Director"]);
            setCompetitors([
                { name: "Perplexity", website: "https://perplexity.ai", logo: "PX" },
                { name: "HubSpot", website: "https://hubspot.com", logo: "HS" },
            ]);
            setSelectedPrompts([
                { text: `best alternative to ${formattedName}`, language: "en", category: "organic", intent: "commercial" },
                { text: `${formattedName} pricing vs competitors`, language: "en", category: "organic", intent: "informational" },
            ]);
        }

        nextStep();
    };

    return (
        <Card className="h-full w-full bg-white shadow-none rounded-none">
            <CardHeader>
                <CardTitle>
                    {isDemo ? "Let&apos;s start with your brand basics." : "Welcome! Let&apos;s start with your website."}
                </CardTitle>
                <CardDescription>
                    {isDemo
                        ? "Provide your brand name and website to launch the demo flow."
                        : "We&apos;ll scan your homepage to automatically detect your brand details, industry and personas."}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isDemo && (
                    <div className="space-y-2">
                        <Label htmlFor="brandName">Brand name</Label>
                        <Input
                            id="brandName"
                            placeholder="Your brand name"
                            value={brandName}
                            onChange={(e) => setBrandName(e.target.value)}
                            autoFocus
                        />
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="website">Website URL</Label>
                    <div className="flex gap-2">
                        <Input
                            id="website"
                            placeholder="example.com"
                            value={websiteUrl}
                            onChange={(e) => setWebsiteUrl(e.target.value)}
                            autoFocus={!isDemo}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">Enter the root domain (e.g. acme.com)</p>
                </div>
            </CardContent>

            <CardFooter className="flex justify-end">
                <Button onClick={handleNext} disabled={!websiteUrl || (isDemo && !brandName.trim())}>
                    {isDemo ? "Continue" : "Auto-Detect & Continue"}
                </Button>
            </CardFooter>
        </Card>
    );
}
