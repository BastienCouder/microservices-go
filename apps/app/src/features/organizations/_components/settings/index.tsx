import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionTitle } from "@/components/shared/section-title";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import type { OrganizationSummary } from "../../_lib/shared/types";

type SettingsPanelProps = {
  organization: OrganizationSummary;
  busy: boolean;
  deleteBusy: boolean;
  onSubmit: (name: string) => void;
  onDelete: () => void;
};

export function SettingsPanel({ organization, busy, deleteBusy, onSubmit, onDelete }: SettingsPanelProps) {
  const { t } = useScopedI18n("organizations");
  const [name, setName] = useState(organization.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmationName, setConfirmationName] = useState("");

  useEffect(() => {
    setName(organization.name);
  }, [organization.name]);

  const trimmedName = name.trim();
  const canSave = trimmedName !== "" && trimmedName !== organization.name;

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <SectionTitle showIndicator={false}>{t("settingsTitle")}</SectionTitle>
        </div>
        <form
          className="grid gap-4 p-4 md:max-w-xl"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) onSubmit(trimmedName);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="organization-name">{t("organizationName")}</Label>
            <Input
              id="organization-name"
              value={name}
              disabled={busy || deleteBusy}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <Button type="submit" disabled={busy || deleteBusy || !canSave}>
              <Save data-icon="inline-start" />
              {t("save")}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-destructive/30 bg-card">
        <div className="border-b border-destructive/20 px-4 py-3">
          <SectionTitle showIndicator={false}>{t("sensitiveZoneTitle")}</SectionTitle>
        </div>
        <div className="grid gap-3 p-4 md:max-w-xl">
          <p className="text-sm text-muted-foreground">{t("deleteOrganizationDescription")}</p>
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={(open) => {
              setDeleteOpen(open);
              if (!open) setConfirmationName("");
            }}
            trigger={
              <Button type="button" variant="destructive" className="w-fit" disabled={busy || deleteBusy}>
                <Trash2 data-icon="inline-start" />
                {t("deleteOrganization")}
              </Button>
            }
            title={t("deleteOrganizationTitle")}
            description={t("deleteOrganizationConfirmDescription")}
            confirmLabel={t("delete")}
            loading={deleteBusy}
            confirmDisabled={confirmationName.trim() !== organization.name}
            media={<Trash2 />}
            onConfirm={onDelete}
          >
            <div className="mt-3 grid gap-2 text-left">
              <Label htmlFor="organization-delete-confirmation">
                {t("deleteOrganizationTypeName")}
              </Label>
              <Input
                id="organization-delete-confirmation"
                value={confirmationName}
                disabled={deleteBusy}
                onChange={(event) => setConfirmationName(event.target.value)}
              />
            </div>
          </ConfirmDialog>
        </div>
      </section>
    </div>
  );
}
