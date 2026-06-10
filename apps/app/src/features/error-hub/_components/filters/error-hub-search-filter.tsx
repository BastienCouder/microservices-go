import { SearchFilterInput } from "@/components/shared/search-filter-input";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

export function ErrorHubSearchFilter({
  onSearchChange,
  search,
}: {
  onSearchChange: (value: string) => void;
  search: string;
}) {
  const { t } = useScopedI18n("error-hub");

  return (
    <SearchFilterInput
      value={search}
      onValueChange={onSearchChange}
      placeholder={t("searchPlaceholder")}
      className="w-full sm:w-[280px]"
    />
  );
}
