import { Loader2, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import { UrlInput } from "./url-input";

type ScanHeroProps = {
  url: string;
  urlError: string;
  canScan: boolean;
  isScanning: boolean;
  onURLChange: (value: string) => void;
  onScan: () => void;
};

export function ScanHero({
  url,
  urlError,
  canScan,
  isScanning,
  onURLChange,
  onScan,
}: ScanHeroProps) {
  return (
    <section className="rounded-[24px] border border-[#eadfd3] bg-[#fffaf5] p-5 shadow-[0_18px_50px_rgba(58,36,24,0.06)] md:p-7">
      <div className="flex max-w-3xl flex-col gap-4">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#eadfd3] bg-[#fffdf9] px-3 py-1.5 text-sm font-semibold text-[#866d5d]">
          <Sparkles className="size-4 text-[#f26a21]" aria-hidden="true" />
          AI Agent Ready audit
        </span>
        <div className="space-y-3">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight text-[#3a2418] md:text-4xl">
            Analyze if your content is agent-ready
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[#866d5d]">
            Scan your public content surface for discoverability, Markdown access,
            crawler policy, and concrete fixes agents can understand.
          </p>
        </div>
      </div>

      <form
        className="mt-7 flex flex-col gap-3 md:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          onScan();
        }}
      >
        <UrlInput
          value={url}
          error={urlError}
          disabled={isScanning}
          onChange={onURLChange}
        />
        <Button
          type="submit"
          disabled={!canScan}
          className="h-14 rounded-[14px] bg-[#f26a21] px-6 text-base font-bold text-white shadow-[0_12px_28px_rgba(242,106,33,0.24)] ring-[#f26a21]/20 hover:bg-[#dd5d19] md:min-w-[150px]"
        >
          {isScanning ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ShieldCheck className="size-4" aria-hidden="true" />
          )}
          {isScanning ? "Scanning" : "Scan"}
        </Button>
      </form>

      <p className="mt-4 text-sm font-medium text-[#866d5d]">
        Uses read-only HTTP checks. No authentication or page changes required.
      </p>
    </section>
  );
}
