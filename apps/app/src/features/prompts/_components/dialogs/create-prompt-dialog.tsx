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
import { FloatingPanelHeader } from "@/components/ui/floating-panel-header";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AIModel, Persona } from "../../_lib/types";

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
  const { t } = useScopedI18n("prompts-workspace");
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
          <DialogTitle>{t("createPromptDialogTitle")}</DialogTitle>
          <DialogDescription>{t("createPromptDialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="prompt-text">{t("createPromptDialogPromptLabel")}</Label>
            <Textarea
              id="prompt-text"
              value={formPrompt}
              onChange={(event) => setFormPrompt(event.target.value)}
              placeholder={t("createPromptDialogPromptPlaceholder")}
            />
          </div>

          {availablePersonas.length > 0 ? (
            <div className="space-y-1">
              <Label>{t("createPromptDialogPersonaLabel")}</Label>
              <Select
                value={formPersona}
                onValueChange={(value) => setFormPersona(value as Persona)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="p-0">
                  <FloatingPanelHeader
                    title={t("createPromptDialogPersonaLabel")}
                    className="px-3.5 pt-3.5"
                  />
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
            <Label>{t("createPromptDialogCoverageLabel")}</Label>
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
            {t("createPromptDialogCancel")}
          </Button>
          <Button onClick={onCreate} disabled={formModels.length === 0}>
            {t("createPromptDialogCreate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
