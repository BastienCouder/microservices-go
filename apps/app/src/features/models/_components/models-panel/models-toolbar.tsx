import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { ToolbarTemplate } from "./template";

type ModelsToolbarProps = {
  search: string;
  selectedCount: number;
  selectionLimit: number;
  saveDisabled: boolean;
  isSavingModels: boolean;
  loading?: boolean;
  canEdit: boolean;
  onSearchChange: (value: string) => void;
  onSave: () => void;
};

export function ModelsToolbar({
  search,
  selectedCount,
  selectionLimit,
  saveDisabled,
  isSavingModels,
  loading = false,
  canEdit,
  onSearchChange,
  onSave,
}: ModelsToolbarProps) {
  const { t } = useScopedI18n("models");

  if (loading) {
    return <ToolbarTemplate />;
  }

  return (
    <div className="border-b px-4 py-4 md:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-muted-foreground">
          {t("selectedModelsStatus", {
            selected: selectedCount,
            limit: selectionLimit || 0,
          })}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full max-w-96"
          />

          {canEdit ? (
            <Button type="button" onClick={onSave} disabled={saveDisabled}>
              {isSavingModels ? t("saving") : t("save")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
