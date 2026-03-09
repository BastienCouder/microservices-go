"use client";

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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AIModel, Persona } from "./types";

type CreatePromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formPrompt: string;
  setFormPrompt: (value: string) => void;
  formPersona: Persona;
  setFormPersona: (value: Persona) => void;
  formModels: AIModel[];
  setFormModels: (value: AIModel[]) => void;
  availablePersonas: Persona[];
  availableModels: AIModel[];
  getModelLabel: (model: string) => string;
  onCreate: () => void;
};

export function CreatePromptDialog({
  open,
  onOpenChange,
  formPrompt,
  setFormPrompt,
  formPersona,
  setFormPersona,
  formModels,
  setFormModels,
  availablePersonas,
  availableModels,
  getModelLabel,
  onCreate,
}: CreatePromptDialogProps) {
  const toggleModel = (model: AIModel) => {
    setFormModels(
      formModels.includes(model)
        ? formModels.filter((item) => item !== model)
        : [...formModels, model],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New prompt</DialogTitle>
          <DialogDescription>
            Create a prompt with an optional persona and choose exactly which AI
            models should appear on it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="prompt-text">Prompt</Label>
            <Textarea
              id="prompt-text"
              value={formPrompt}
              onChange={(event) => setFormPrompt(event.target.value)}
              placeholder="Ex: Best CRM startups for B2B SaaS?"
            />
          </div>

          {availablePersonas.length > 0 ? (
            <div className="space-y-1">
              <Label>Persona</Label>
              <Select
                value={formPersona}
                onValueChange={(value) => setFormPersona(value as Persona)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availablePersonas.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>AI coverage</Label>
            <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-2xl border border-border/70 p-3 sm:grid-cols-2">
              {availableModels.map((model) => (
                <label
                  key={model}
                  className="flex items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={formModels.includes(model)}
                    onCheckedChange={() => toggleModel(model)}
                  />
                  <span>{getModelLabel(model)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={formModels.length === 0}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
