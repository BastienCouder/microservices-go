import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type CopyPromptButtonProps = {
  prompt: string;
};

export function CopyPromptButton({ prompt }: CopyPromptButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-[14px] border-[#eadfd3] bg-[#fffdf9] text-[#3a2418] hover:bg-[#fff3e8]"
      onClick={handleCopy}
    >
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied ? "Copied" : "Copy prompt"}
    </Button>
  );
}
