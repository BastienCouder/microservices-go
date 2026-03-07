"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  formModel: AIModel;
  setFormModel: (value: AIModel) => void;
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
  formModel,
  setFormModel,
  availablePersonas,
  availableModels,
  getModelLabel,
  onCreate,
}: CreatePromptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New prompt</DialogTitle>
          <DialogDescription>Create a prompt with an optional persona and a default AI model.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="prompt-text">Prompt</Label>
            <Textarea
              id="prompt-text"
              value={formPrompt}
              onChange={(event) => setFormPrompt(event.target.value)}
              placeholder="Ex: Best CRM startups for B2B SaaS?"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {availablePersonas.length > 0 ? (
            <div className="space-y-1">
              <Label>Persona</Label>
              <Select value={formPersona} onValueChange={(value) => setFormPersona(value as Persona)}>
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
            <div className="space-y-1">
              <Label>AI</Label>
              <Select value={formModel} onValueChange={(value) => setFormModel(value as AIModel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((item) => (
                    <SelectItem key={item} value={item}>
                      {getModelLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreate}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
