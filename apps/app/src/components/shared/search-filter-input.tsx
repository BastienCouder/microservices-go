import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/shared/utils";

type SearchFilterInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
};

export function SearchFilterInput({
  value,
  onValueChange,
  onSubmit,
  placeholder = "Rechercher",
  className,
}: SearchFilterInputProps) {
  return (
    <label className={cn("relative block min-w-0", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSubmit?.();
          }
        }}
        placeholder={placeholder}
        className="pl-9"
      />
    </label>
  );
}
