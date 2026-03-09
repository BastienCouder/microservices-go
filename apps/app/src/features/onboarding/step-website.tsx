import { Globe, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboarding } from "@/hooks/use-onboarding";

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

  const handleNext = () => {
    if (!websiteUrl || (isDemo && !brandName.trim())) {
      return;
    }

    if (!isDemo) {
      const domain = websiteUrl
        .replace("https://", "")
        .replace("http://", "")
        .replace("www.", "")
        .split(".")[0];
      const formattedName =
        domain.charAt(0).toUpperCase() + domain.slice(1);

      if (!brandName.trim()) {
        setBrandName(formattedName);
      }

      setBrandShortDescription(`The #1 AI-powered solution for ${domain}`);
      setBrandDescription(
        `${formattedName} helps companies streamline their operations with cutting-edge artificial intelligence. Our platform integrates seamlessly with your existing workflow to boost productivity.`,
      );
      setIndustry("B2B SaaS / Technology");
      setKeyFeatures([
        "AI Automation",
        "Real-time Analytics",
        "Seamless Integration",
        "Enterprise Security",
      ]);
      setBrandPersonas([
        "CTO",
        "Product Manager",
        "Operations Director",
      ]);
      setCompetitors([
        { name: "Perplexity", website: "https://perplexity.ai", logo: "PX" },
        { name: "HubSpot", website: "https://hubspot.com", logo: "HS" },
      ]);
      setSelectedPrompts([
        {
          text: `best alternative to ${formattedName}`,
          language: "en",
          category: "organic",
          intent: "commercial",
        },
        {
          text: `${formattedName} pricing vs competitors`,
          language: "en",
          category: "organic",
          intent: "informational",
        },
      ]);
    }

    nextStep();
  };

  return (
    <div className="w-full space-y-8 rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/6 px-3 py-1 text-xs font-medium tracking-[0.14em] text-primary uppercase">
            <Sparkles className="size-3.5" />
            Onboarding
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-zinc-950 sm:text-[2rem]">
              {isDemo
                ? "Start with your brand basics"
                : "Start with your website"}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {isDemo
                ? "Provide your brand name and website to launch the demo flow."
                : "We use your root domain to prefill your brand profile, prompts and competitor baseline before the first audit."}
            </p>
          </div>
        </div>
        <div className="hidden rounded-2xl border border-border/70 bg-muted/30 p-3 text-muted-foreground lg:flex">
          <Globe className="size-5" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-5">
          {isDemo ? (
            <div className="space-y-2">
              <Label htmlFor="brandName" className="text-sm font-semibold">
                Brand name
              </Label>
              <Input
                id="brandName"
                placeholder="Your brand name"
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                autoFocus
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="website" className="text-sm font-semibold">
              Website URL
            </Label>
            <Input
              id="website"
              placeholder="example.com"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              autoFocus={!isDemo}
            />
            <p className="text-xs text-muted-foreground">
              Enter the root domain only, for example `acme.com`.
            </p>
          </div>
        </div>

        <aside className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
          <p className="text-sm font-semibold text-foreground">
            What gets prepared
          </p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>Brand summary and positioning draft</li>
            <li>Suggested competitors and prompts</li>
            <li>Starter model selection for first audit</li>
          </ul>
        </aside>
      </div>

      <div className="flex justify-end border-t border-border/70 pt-5">
        <Button
          onClick={handleNext}
          disabled={!websiteUrl || (isDemo && !brandName.trim())}
        >
          {isDemo ? "Continue" : "Auto-detect and continue"}
        </Button>
      </div>
    </div>
  );
}
