"use client";

import { Check, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrganizationSummary } from "./types";

function buildInitials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "OR";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export const OrganizationItem = memo(function OrganizationItem({
  organization,
  isActive,
  simulatedPlan,
  onSelect,
}: {
  organization: OrganizationSummary;
  isActive: boolean;
  simulatedPlan: string | null;
  onSelect: (organizationId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(organization.id)}
      className={cn(
        "w-full cursor-pointer rounded-xl border p-3 text-left transition-[border-color,background-color,transform] duration-200",
        isActive
          ? "border-primary/30 bg-primary/8"
          : "border-border/60 bg-background hover:border-primary/20 hover:bg-muted/40",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="border border-border/60 bg-primary/5">
          <AvatarFallback>{buildInitials(organization.name)}</AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="truncate font-medium">{organization.name}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users aria-hidden="true" className="size-3.5" />
                  {organization.membersCount} member{organization.membersCount > 1 ? "s" : ""}
                </span>
                {simulatedPlan ? (
                  <>
                    <span className="size-1 rounded-full bg-border" />
                    <span>{simulatedPlan}</span>
                  </>
                ) : null}
              </div>
            </div>

            {isActive ? (
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check aria-hidden="true" className="size-3.5" />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1">
            <Badge variant={organization.role === "owner" ? "default" : organization.role === "admin" ? "secondary" : "outline"} className="capitalize">
              {organization.role}
            </Badge>
            <Badge variant="outline">Org {organization.id}</Badge>
          </div>
        </div>
      </div>
    </button>
  );
});
