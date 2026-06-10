import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  if (loading) {
    return <ToolbarTemplate />;
  }

  return (
    <div className="border-b px-4 py-4 md:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedCount}/{selectionLimit || 0} modeles actifs
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher un modele"
            className="w-full max-w-96"
          />

          {canEdit ? (
            <Button type="button" onClick={onSave} disabled={saveDisabled}>
              {isSavingModels ? "Enregistrement..." : "Enregistrer"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
