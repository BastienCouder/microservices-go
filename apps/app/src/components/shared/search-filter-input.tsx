import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { cn } from "@/shared/utils";

type SearchFilterInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  inputClassName?: string;
};

export function SearchFilterInput({
  value,
  onValueChange,
  onSubmit,
  placeholder,
  className,
  disabled = false,
  inputClassName,
}: SearchFilterInputProps) {
  const { t } = useScopedI18n("shared-ui");

  return (
    <label className={cn("relative block min-w-0", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSubmit?.();
          }
        }}
        placeholder={placeholder ?? t("search")}
        className={cn("pl-9", inputClassName)}
      />
    </label>
  );
}
