"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  ProjectWhiteLabelBranding,
  ProjectWhiteLabelReporting,
  ProjectWhiteLabelSettings,
} from "@/lib/project-details";
import { WhiteLabelPreviewCard } from "./white-label-preview-card";

type WhiteLabelWorkspaceProps = {
  projectName: string;
  value: ProjectWhiteLabelSettings;
  onChange: (value: ProjectWhiteLabelSettings) => void;
};

const TEMPLATE_OPTIONS = [
  { value: "executive", label: "Executive summary" },
  { value: "performance", label: "Performance digest" },
  { value: "board", label: "Board report" },
] as const;

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
] as const;

const LOCALE_OPTIONS = [
  { value: "fr", label: "Francais" },
  { value: "en", label: "English" },
  { value: "es", label: "Espanol" },
  { value: "de", label: "Deutsch" },
] as const;

function parseRecipients(value: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  value
    .split(/[\n,;]+/)
    .map((item) => item.trim().toLowerCase())
    .forEach((item) => {
      if (item === "" || seen.has(item)) return;
      seen.add(item);
      items.push(item);
    });
  return items;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-3">
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="#3b82f6" />
        <Input
          type="color"
          value={/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-16 shrink-0 p-1"
        />
      </div>
    </div>
  );
}

export function WhiteLabelWorkspace({ projectName, value, onChange }: WhiteLabelWorkspaceProps) {
  const updateBranding = <Key extends keyof ProjectWhiteLabelBranding,>(key: Key, nextValue: ProjectWhiteLabelBranding[Key]) => {
    onChange({
      ...value,
      branding: {
        ...value.branding,
        [key]: nextValue,
      },
    });
  };

  const updateReporting = <Key extends keyof ProjectWhiteLabelReporting,>(key: Key, nextValue: ProjectWhiteLabelReporting[Key]) => {
    onChange({
      ...value,
      reporting: {
        ...value.reporting,
        [key]: nextValue,
      },
    });
  };

  return (
    <Card className="border">
      <CardHeader>
        <CardTitle>White-label workspace</CardTitle>
        <CardDescription>
          Configure project-level branding and report delivery defaults. The live preview updates immediately.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <Tabs defaultValue="branding" className="min-w-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="branding">Branding</TabsTrigger>
              <TabsTrigger value="delivery">Delivery</TabsTrigger>
            </TabsList>

            <TabsContent value="branding" className="mt-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Platform name</label>
                  <Input
                    value={value.branding.platformName}
                    onChange={(event) => updateBranding("platformName", event.target.value)}
                    placeholder="Agency reporting studio"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Custom domain</label>
                  <Input
                    value={value.branding.customDomain}
                    onChange={(event) => updateBranding("customDomain", event.target.value)}
                    placeholder="reports.agence-xyz.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Logo URL</label>
                  <Input
                    value={value.branding.logoUrl}
                    onChange={(event) => updateBranding("logoUrl", event.target.value)}
                    placeholder="https://cdn.example.com/logo.png"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Favicon URL</label>
                  <Input
                    value={value.branding.faviconUrl}
                    onChange={(event) => updateBranding("faviconUrl", event.target.value)}
                    placeholder="https://cdn.example.com/favicon.svg"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <ColorField label="Primary color" value={value.branding.primaryColor} onChange={(next) => updateBranding("primaryColor", next)} />
                <ColorField label="Secondary color" value={value.branding.secondaryColor} onChange={(next) => updateBranding("secondaryColor", next)} />
                <ColorField label="Accent color" value={value.branding.accentColor} onChange={(next) => updateBranding("accentColor", next)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Font stack</label>
                  <Input
                    value={value.branding.fontFamily}
                    onChange={(event) => updateBranding("fontFamily", event.target.value)}
                    placeholder="Manrope, Arial, sans-serif"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email sender name</label>
                  <Input
                    value={value.branding.emailFromName}
                    onChange={(event) => updateBranding("emailFromName", event.target.value)}
                    placeholder="Acme Reports"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Reply-to address</label>
                  <Input
                    value={value.branding.emailReplyTo}
                    onChange={(event) => updateBranding("emailReplyTo", event.target.value)}
                    placeholder="success@agence-xyz.com"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="delivery" className="mt-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Report template</label>
                  <Select value={value.reporting.template} onValueChange={(next) => updateReporting("template", next as ProjectWhiteLabelReporting["template"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Frequency</label>
                  <Select value={value.reporting.frequency} onValueChange={(next) => updateReporting("frequency", next as ProjectWhiteLabelReporting["frequency"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <Select value={value.reporting.locale} onValueChange={(next) => updateReporting("locale", next as ProjectWhiteLabelReporting["locale"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCALE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Timezone</label>
                  <Input
                    value={value.reporting.timezone}
                    onChange={(event) => updateReporting("timezone", event.target.value)}
                    placeholder="Europe/Paris"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Share link TTL (hours)</label>
                  <Input
                    type="number"
                    min={24}
                    max={720}
                    value={String(value.reporting.shareLinkTTLHours)}
                    onChange={(event) => updateReporting("shareLinkTTLHours", Number(event.target.value || 0))}
                  />
                </div>
              </div>

              <div className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Live share access</p>
                    <p className="text-sm text-muted-foreground">
                      Keep a signed live link ready for client-facing report views.
                    </p>
                  </div>
                  <Switch
                    checked={value.reporting.liveShareEnabled}
                    onCheckedChange={(checked) => updateReporting("liveShareEnabled", Boolean(checked))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Recipients</label>
                <Textarea
                  value={value.reporting.recipients.join("\n")}
                  onChange={(event) => updateReporting("recipients", parseRecipients(event.target.value))}
                  placeholder={"client@acme.com\nops@agence-xyz.com"}
                  className="min-h-32"
                />
                <p className="text-xs text-muted-foreground">
                  One email per line or comma-separated. This profile is stored at project level for future automated sends.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="xl:sticky xl:top-20 xl:self-start">
            <WhiteLabelPreviewCard projectName={projectName} value={value} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
