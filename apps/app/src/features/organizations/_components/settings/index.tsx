import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionTitle } from "@/components/shared/section-title";
import type { OrganizationSummary } from "../../_lib/shared/types";

type SettingsPanelProps = {
  organization: OrganizationSummary;
  busy: boolean;
  onSubmit: (name: string) => void;
};

export function SettingsPanel({ organization, busy, onSubmit }: SettingsPanelProps) {
  const [name, setName] = useState(organization.name);

  useEffect(() => {
    setName(organization.name);
  }, [organization.name]);

  const trimmedName = name.trim();
  const canSave = trimmedName !== "" && trimmedName !== organization.name;

  return (
    <section className="rounded-lg border border-border/60 bg-card">
      <div className="border-b border-border/60 px-4 py-3">
        <SectionTitle showIndicator={false}>Parametres</SectionTitle>
      </div>
      <form
        className="grid gap-4 p-4 md:max-w-xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) onSubmit(trimmedName);
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="organization-name">Nom de l'organisation</Label>
          <Input
            id="organization-name"
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <Button type="submit" disabled={busy || !canSave}>
            <Save data-icon="inline-start" />
            Enregistrer
          </Button>
        </div>
      </form>
    </section>
  );
}
