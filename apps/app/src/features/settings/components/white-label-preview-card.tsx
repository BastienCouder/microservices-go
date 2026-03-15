"use client";

import { Badge } from "@/components/ui/badge";
import type { ProjectWhiteLabelSettings } from "@/lib/project-details";
import { resolvePreviewShareLink, resolveWhiteLabelColors } from "@/features/white-label/lib/theme-tokens";

type WhiteLabelPreviewCardProps = {
  projectName: string;
  value: ProjectWhiteLabelSettings;
};

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CW";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function WhiteLabelPreviewCard({ projectName, value }: WhiteLabelPreviewCardProps) {
  const { primary, secondary, accent } = resolveWhiteLabelColors(value);
  const platformName = value.branding.platformName.trim() || "Client Workspace";
  const shareLink = resolvePreviewShareLink(
    value,
    projectName,
    typeof window === "undefined" ? "" : window.location.host,
  );

  return (
    <div className="overflow-hidden rounded-[28px] border border-border/70 bg-background shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div
        className="border-b border-white/45 px-5 py-5 text-white"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`,
          fontFamily: value.branding.fontFamily.trim() || undefined,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {value.branding.logoUrl.trim() ? (
                <div className="h-11 w-11 overflow-hidden rounded-2xl bg-white/12 ring-1 ring-white/25">
                  <img src={value.branding.logoUrl} alt={platformName} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/18 text-sm font-black uppercase tracking-[0.14em] ring-1 ring-white/30">
                  {getInitials(platformName)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white/80">Live preview</p>
                <h3 className="truncate text-xl font-black tracking-[-0.04em] text-white">{platformName}</h3>
              </div>
            </div>
            <p className="mt-4 max-w-[24rem] text-sm text-white/78">
              Dashboard, emails and shared reports will inherit this identity without exposing the supplier brand.
            </p>
          </div>

          <Badge className="rounded-full border-white/25 bg-white/10 text-white hover:bg-white/10">
            {value.reporting.frequency}
          </Badge>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div
          className="rounded-[24px] border border-border/60 p-4"
          style={{
            background: `linear-gradient(180deg, ${secondary} 0%, rgba(255,255,255,0.96) 82%)`,
            fontFamily: value.branding.fontFamily.trim() || undefined,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Client report</p>
              <p className="mt-2 text-lg font-black tracking-[-0.04em] text-foreground">{projectName || "Executive monitoring"}</p>
            </div>
            <div className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: primary, color: "white" }}>
              {value.reporting.template}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              { label: "Visibility", value: "71%" },
              { label: "Sentiment", value: "+18 pts" },
              { label: "Competitors", value: "5 tracked" },
              { label: "Recipients", value: String(value.reporting.recipients.length || 1) },
            ].map((item) => (
              <div key={item.label} className="rounded-[20px] bg-white/86 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-lg font-black tracking-[-0.03em] text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Email branding</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{value.branding.emailFromName || platformName}</p>
              <p className="text-xs text-muted-foreground">{value.branding.emailReplyTo || "reply-to not configured"}</p>
            </div>
            <div className="rounded-full border px-3 py-1 text-xs font-medium">
              {value.reporting.locale.toUpperCase()} · {value.reporting.timezone}
            </div>
          </div>

          <div className="mt-4 rounded-[18px] border border-border/60 bg-background/90 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Live share link</p>
            <p className="mt-1 truncate text-sm font-medium text-foreground">{shareLink}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
