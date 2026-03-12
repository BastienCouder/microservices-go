"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModelVisual } from "./types";

type PromptModelsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptLabel: string;
  selectedModels: string[];
  availableModels: string[];
  getModelVisual: (model: string) => ModelVisual;
  saving?: boolean;
  onSave: (models: string[]) => void;
};

export function PromptModelsDialog({
  open,
  onOpenChange,
  promptLabel,
  selectedModels,
  availableModels,
  getModelVisual,
  saving = false,
  onSave,
}: PromptModelsDialogProps) {
  const [draftModels, setDraftModels] = useState<string[]>(selectedModels);

  useEffect(() => {
    if (!open) return;
    setDraftModels(selectedModels);
  }, [open, selectedModels]);

  const toggleModel = (model: string) => {
    setDraftModels((current) =>
      current.includes(model)
        ? current.filter((item) => item !== model)
        : [...current, model],
    );
  };

  const selectedModelLabels = draftModels.map((model) => {
    const visual = getModelVisual(model);
    return `${visual.provider} ${visual.name}`.trim();
  });
  const description = selectedModelLabels.length > 0
    ? `AI actives: ${selectedModelLabels.join(", ")}`
    : "Aucune IA active pour ce prompt.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit AI coverage</DialogTitle>
          {promptLabel.trim() ? (
            <p className="line-clamp-2 text-sm font-medium leading-6 text-foreground">
              {promptLabel.trim()}
            </p>
          ) : null}
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto rounded-2xl border border-border/70 p-3 sm:grid-cols-2">
          {availableModels.map((model) => {
            const visual = getModelVisual(model);
            return (
              <label
                key={model}
                className="flex items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={draftModels.includes(model)}
                  disabled={saving}
                  onCheckedChange={() => toggleModel(model)}
                />
                <img
                  src={visual.icon}
                  alt={visual.name}
                  className="h-4 w-4 object-contain"
                  decoding="async"
                />
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {visual.provider}
                  </span>
                  <span className="block truncate leading-5">{visual.name}</span>
                </span>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(draftModels);
            }}
            disabled={draftModels.length === 0 || saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
