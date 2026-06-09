import { SearchFilterInput } from "@/components/shared/search-filter-input";

export function ErrorHubSearchFilter({
  onSearchChange,
  search,
}: {
  onSearchChange: (value: string) => void;
  search: string;
}) {
  return (
    <SearchFilterInput
      value={search}
      onValueChange={onSearchChange}
      placeholder="Rechercher"
      className="w-full sm:w-[280px]"
    />
  );
}
