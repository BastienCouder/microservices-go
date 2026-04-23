"use client";

import { memo, useCallback, useState } from "react";
import { Eye, EyeOff, KeyRound, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { LLMProviderCredentialStatus } from "../_lib/model-access";

type ProviderApiKeysPanelTexts = {
  empty: string;
  configured: string;
  missing: string;
  connect: string;
  manage: string;
  delete: string;
  fieldLabel: string;
  fieldHint?: string;
  placeholder: string;
  save: string;
  saving: string;
};

type ProviderApiKeysPanelProps = {
  requirements: LLMProviderCredentialStatus[];
  drafts: Record<string, string>;
  pendingProvider: string | null;
  texts: ProviderApiKeysPanelTexts;
  className?: string;
  disabled?: boolean;
  onDraftChange: (provider: string, value: string) => void;
  onSave: (provider: string) => void;
  onDelete: (provider: string) => void;
};

const PROVIDER_ICON_PATHS: Record<string, string> = {
  anthropic: "/models/anthropic.svg",
  copilot: "/models/copilot.svg",
  deepseek: "/models/deepseek.svg",
  google: "/models/google.svg",
  groq: "/models/groq.svg",
  mistral: "/models/mistral.svg",
  meta: "/models/meta.svg",
  openai: "/models/openai.svg",
  openrouter: "/models/openrouter.svg",
  perplexity: "/models/perplexity.svg",
  qwen: "/models/qwen.svg",
  "qwen-color": "/models/qwen.svg",
  grok: "/models/xai.svg",
  xai: "/models/xai.svg",
  zai: "/models/zai.svg",
};

type ProviderApiKeyCardProps = {
  requirement: LLMProviderCredentialStatus;
  draft: string;
  isSaving: boolean;
  isEditing: boolean;
  isProviderKeyVisible: boolean;
  disabled: boolean;
  texts: ProviderApiKeysPanelTexts;
  onToggleEditing: (provider: string) => void;
  onToggleVisibility: (provider: string) => void;
  onDraftChange: (provider: string, value: string) => void;
  onSave: (provider: string) => void;
  onDelete: (provider: string) => void;
};

const ProviderApiKeyCard = memo(function ProviderApiKeyCard({
  requirement,
  draft,
  isSaving,
  isEditing,
  isProviderKeyVisible,
  disabled,
  texts,
  onToggleEditing,
  onToggleVisibility,
  onDraftChange,
  onSave,
  onDelete,
}: ProviderApiKeyCardProps) {
  const canSave = draft.trim() !== "" && !disabled && !isSaving;
  const iconPath = PROVIDER_ICON_PATHS[requirement.provider];

  return (
    <div
      className={cn(
        "group flex h-full min-h-[200px] flex-col rounded-2xl border bg-card p-4 transition-all duration-200 hover:shadow-sm",
        requirement.hasApiKey
          ? "border-primary/20 bg-primary/[0.02]"
          : "border-border hover:border-border/80",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border p-2">
          {iconPath ? (
            <img
              src={iconPath}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-contain"
            />
          ) : (
            <KeyRound aria-hidden="true" />
          )}
        </div>
        <div
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            requirement.hasApiKey
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              requirement.hasApiKey ? "bg-primary" : "bg-muted-foreground/60",
            )}
          />
          {requirement.hasApiKey ? texts.configured : texts.missing}
        </div>
      </div>

      <div className="mb-4 flex-1">
        <h3 className="mb-1.5 truncate text-base font-semibold text-foreground">
          {requirement.label}
        </h3>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <Button
          type="button"
          variant={requirement.hasApiKey ? "outline" : "default"}
          className="w-full"
          disabled={disabled}
          onClick={() => onToggleEditing(requirement.provider)}
        >
          {requirement.hasApiKey ? (
            <Settings2 data-icon="inline-start" />
          ) : (
            <Plus data-icon="inline-start" />
          )}
          {requirement.hasApiKey ? texts.manage : texts.connect}
        </Button>

        {isEditing ? (
          <Field className="mt-2 gap-2 border-t pt-4">
            <FieldLabel htmlFor={`llm-key-${requirement.provider}`}>
              {texts.fieldLabel}
            </FieldLabel>
            {texts.fieldHint ? (
              <FieldDescription>{texts.fieldHint}</FieldDescription>
            ) : null}
            <div className="relative">
              <Input
                id={`llm-key-${requirement.provider}`}
                type={isProviderKeyVisible ? "text" : "password"}
                autoComplete="off"
                value={draft}
                placeholder={texts.placeholder}
                disabled={disabled || isSaving}
                className="pr-10"
                onChange={(event) =>
                  onDraftChange(requirement.provider, event.target.value)
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 size-8"
                disabled={disabled || isSaving}
                aria-label={
                  isProviderKeyVisible ? "Masquer la cle API" : "Afficher la cle API"
                }
                onClick={() => onToggleVisibility(requirement.provider)}
              >
                {isProviderKeyVisible ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
              </Button>
            </div>
            <div className="flex w-full flex-col items-center justify-end gap-2">
              {requirement.hasApiKey ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={disabled || isSaving}
                  className="w-full"
                  onClick={() => onDelete(requirement.provider)}
                >
                  {texts.delete}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={!canSave}
                onClick={() => onSave(requirement.provider)}
              >
                {isSaving ? texts.saving : texts.save}
              </Button>
            </div>
          </Field>
        ) : null}
      </div>
    </div>
  );
});

export function ProviderApiKeysPanel({
  requirements,
  drafts,
  pendingProvider,
  texts,
  className,
  disabled = false,
  onDraftChange,
  onSave,
  onDelete,
}: ProviderApiKeysPanelProps) {
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [visibleProviders, setVisibleProviders] = useState<
    Record<string, boolean>
  >({});

  const isProviderKeyVisible = useCallback(
    (provider: string) => visibleProviders[provider] === true,
    [visibleProviders],
  );
  const toggleProviderKeyVisibility = useCallback((provider: string) => {
    setVisibleProviders((current) => ({
      ...current,
      [provider]: !current[provider],
    }));
  }, []);
  const toggleEditingProvider = useCallback((provider: string) => {
    setEditingProvider((current) => (current === provider ? null : provider));
  }, []);
  const handleSave = useCallback((provider: string) => {
    setEditingProvider(null);
    onSave(provider);
  }, [onSave]);
  const handleDelete = useCallback((provider: string) => {
    setEditingProvider(null);
    onDelete(provider);
  }, [onDelete]);

  return (
    <section className={cn(className)}>
      {requirements.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-border/70 px-3 py-3 text-sm text-muted-foreground">
          {texts.empty}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {requirements.map((requirement) => {
            const draft = drafts[requirement.provider] ?? "";
            const isSaving = pendingProvider === requirement.provider;
            const isEditing = editingProvider === requirement.provider;

            return (
              <ProviderApiKeyCard
                key={requirement.provider}
                requirement={requirement}
                draft={draft}
                isSaving={isSaving}
                isEditing={isEditing}
                isProviderKeyVisible={isProviderKeyVisible(requirement.provider)}
                disabled={disabled}
                texts={texts}
                onToggleEditing={toggleEditingProvider}
                onToggleVisibility={toggleProviderKeyVisibility}
                onDraftChange={onDraftChange}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
