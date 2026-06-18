"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { ModelCard } from "@/components/shared/model-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectModelMeta } from "@/lib/project-models";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

export type AIBriefModelSettings = {
  briefModelId?: string;
  briefProvider?: string;
  briefProviderModelId?: string;
};

export type SaveAIBriefModelSettingsInput = {
  briefModelId: string;
  briefProvider: string;
  briefProviderModelId: string;
};

type ErrorHubAIBriefModelDialogProps = {
  models: ProjectModelMeta[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AIBriefModelSettings | null;
  saving: boolean;
  onSave?: (input: SaveAIBriefModelSettingsInput) => Promise<void>;
};

function sortModels(models: ProjectModelMeta[]) {
  return [...models].sort((left, right) => {
    const groupDiff = left.groupName.localeCompare(right.groupName);
    if (groupDiff !== 0) return groupDiff;
    return left.displayName.localeCompare(right.displayName);
  });
}

export function ErrorHubAIBriefModelDialog({
  models,
  onOpenChange,
  onSave,
  open,
  saving,
  settings,
}: ErrorHubAIBriefModelDialogProps) {
  const { t } = useScopedI18n("error-hub");
  const [selectedModelId, setSelectedModelId] = useState("");
  const sortedModels = useMemo(() => sortModels(models), [models]);
  const selectedModel = sortedModels.find((model) => model.id === selectedModelId);

  useEffect(() => {
    if (open) {
      setSelectedModelId(settings?.briefModelId ?? sortedModels[0]?.id ?? "");
    }
  }, [open, settings?.briefModelId, sortedModels]);

  const handleSave = async () => {
    if (!selectedModel || !onSave || saving) return;
    await onSave({
      briefModelId: selectedModel.id,
      briefProvider: selectedModel.provider || "openrouter",
      briefProviderModelId: selectedModel.providerModelId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {t("aiBriefModelDialogTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("aiBriefModelDialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          {sortedModels.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
              {t("aiBriefModelDialogEmpty")}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedModels.map((model) => (
                <ModelCard
                  key={model.id}
                  name={model.displayName}
                  description={model.description}
                  icon={model.iconPath}
                  selected={selectedModelId === model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  modelGroup={model.groupName}
                  metaLabel={t(
                    model.creditCost === 1
                      ? "aiBriefModelCredit"
                      : "aiBriefModelCredits",
                    { count: model.creditCost },
                  )}
                  size="medium"
                  variant="models"
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!selectedModel || !onSave || saving}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? t("savingAiBriefModel") : t("saveAiBriefModel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
