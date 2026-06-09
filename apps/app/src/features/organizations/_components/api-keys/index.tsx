import { useState } from "react";
import { Copy, Plus, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SectionTitle } from "@/components/shared/section-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import type { OrganizationAPIKey } from "../../_lib/shared/types";

type ApiKeysPanelProps = {
  apiKeys: OrganizationAPIKey[];
  createdAPIKey: OrganizationAPIKey | null;
  createBusy: boolean;
  revokeBusy: boolean;
  onCreateAPIKey: (name: string) => void;
  onRevokeAPIKey: (keyId: string) => void;
  onClearCreatedAPIKey: () => void;
};

function formatDateTime(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

export function ApiKeysPanel({
  apiKeys,
  createdAPIKey,
  createBusy,
  revokeBusy,
  onCreateAPIKey,
  onRevokeAPIKey,
  onClearCreatedAPIKey,
}: ApiKeysPanelProps) {
  const { t } = useScopedI18n("organizations");
  const [name, setName] = useState("");
  const canCreate = name.trim() !== "";
  const visibleAPIKeys =
    createdAPIKey && !apiKeys.some((apiKey) => apiKey.id === createdAPIKey.id)
      ? [createdAPIKey, ...apiKeys]
      : apiKeys;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <SectionTitle showIndicator={false}>{t("apiKeysTitle")}</SectionTitle>
        </div>
        <div className="divide-y divide-border/60">
          {visibleAPIKeys.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">{t("noActiveApiKey")}</div>
          ) : (
            visibleAPIKeys.map((apiKey) => {
              const oneTimeSecret = createdAPIKey?.id === apiKey.id ? createdAPIKey.key : "";

              return (
                <div key={apiKey.id} className="grid gap-3 p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{apiKey.name}</p>
                        <Badge variant="outline">{apiKey.prefix}...</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("createdAt", { date: formatDateTime(apiKey.createdAt) })}
                      </p>
                    </div>
                    <ConfirmDialog
                      trigger={
                        <Button type="button" variant="destructive" size="sm" disabled={revokeBusy}>
                          <Trash2 data-icon="inline-start" />
                          {t("delete")}
                        </Button>
                      }
                      title={t("deleteApiKeyTitle")}
                      description={t("deleteApiKeyDescription")}
                      confirmLabel={t("delete")}
                      loading={revokeBusy}
                      media={<Trash2 />}
                      onConfirm={() => onRevokeAPIKey(apiKey.id)}
                    />
                  </div>

                  {oneTimeSecret ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          {t("generatedKey")}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={onClearCreatedAPIKey}
                          aria-label={t("hideApiKey")}
                        >
                          <X />
                        </Button>
                      </div>
                      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                        <Input readOnly value={oneTimeSecret} className="font-mono text-xs" />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void navigator.clipboard?.writeText(oneTimeSecret)}
                        >
                          <Copy data-icon="inline-start" />
                          {t("copy")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <SectionTitle showIndicator={false}>{t("newKeyTitle")}</SectionTitle>
        </div>
        <form
          className="grid gap-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canCreate) return;
            onCreateAPIKey(name);
            setName("");
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="api-key-name">{t("keyName")}</Label>
            <Input
              id="api-key-name"
              value={name}
              disabled={createBusy}
              placeholder={t("production")}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={createBusy || !canCreate}>
            <Plus data-icon="inline-start" />
            {t("create")}
          </Button>
        </form>
      </section>
    </div>
  );
}
