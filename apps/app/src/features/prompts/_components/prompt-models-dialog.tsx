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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit AI coverage</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {promptLabel}
          </DialogDescription>
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
                  alt={visual.label}
                  className="h-4 w-4 object-contain"
                  decoding="async"
                />
                <span>{visual.label}</span>
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
