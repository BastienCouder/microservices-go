import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

export function ErrorHubSearchFilter({
  onSearchChange,
  search,
}: {
  onSearchChange: (value: string) => void;
  search: string;
}) {
  return (
    <div className="relative w-full sm:w-[280px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Rechercher"
        className="h-10 rounded-full border-border/80 bg-background pl-9 text-sm sm:h-8"
      />
    </div>
  );
}