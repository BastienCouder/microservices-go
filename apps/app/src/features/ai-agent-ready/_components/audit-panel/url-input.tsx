import { Globe2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/shared/utils";

type UrlInputProps = {
  value: string;
  error: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function UrlInput({ value, error, disabled, onChange }: UrlInputProps) {
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor="agent-ready-url" className="sr-only">
        Website URL
      </label>
      <div className="relative">
        <Globe2
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#866d5d]"
          aria-hidden="true"
        />
        <Input
          id="agent-ready-url"
          value={value}
          disabled={disabled}
          inputMode="url"
          autoComplete="url"
          placeholder="https://example.com"
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? "agent-ready-url-error" : undefined}
          className={cn(
            "h-14 rounded-[14px] border-[#eadfd3] bg-[#fffdf9] pl-12 text-base text-[#3a2418] shadow-none",
            "placeholder:text-[#866d5d]/65 focus-visible:border-[#f26a21] focus-visible:ring-[#f26a21]/20",
            error && "border-[#df4c4c] focus-visible:border-[#df4c4c]",
          )}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error ? (
        <p id="agent-ready-url-error" className="mt-2 text-sm font-medium text-[#a83333]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
