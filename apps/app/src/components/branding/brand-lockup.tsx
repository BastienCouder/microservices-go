"use client";

import { useWhiteLabel } from "@/features/white-label/context/white-label-provider";
import { cn } from "@/shared/utils";

type BrandMarkProps = {
  className?: string;
};

type BrandLockupProps = {
  className?: string;
  compact?: boolean;
};

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CW";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function BrandMark({ className }: BrandMarkProps) {
  const { theme } = useWhiteLabel();
  const logoUrl = theme.branding.logoUrl.trim();
  const label = theme.branding.platformName.trim() || "Client Workspace";

  if (logoUrl !== "") {
    return (
      <div className={cn("flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-background", className)}>
        <img src={logoUrl} alt={label} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-black uppercase tracking-[0.14em] text-primary-foreground shadow-[0_18px_40px_rgba(37,99,235,0.18)]",
        className,
      )}
      aria-label={label}
    >
      {getInitials(label)}
    </div>
  );
}

export function BrandLockup({ className, compact = false }: BrandLockupProps) {
  const { theme } = useWhiteLabel();
  const label = theme.branding.platformName.trim() || "Client Workspace";

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <BrandMark className={compact ? "h-9 w-9 rounded-xl" : undefined} />
      <div className="min-w-0 leading-none">
        <div className={cn("truncate font-black tracking-[-0.05em] text-foreground", compact ? "text-lg" : "text-[1.45rem]")}>
          {label}
        </div>
      </div>
    </div>
  );
}
