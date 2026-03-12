"use client";

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrganizationSummary } from "./types";

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
        "w-full rounded-md border p-3 text-left transition-colors",
        isActive ? "border-primary bg-primary/5" : "hover:bg-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-1 font-medium">{organization.name}</p>
        <div className="flex gap-1">
          <Badge variant={organization.role === "owner" ? "default" : "secondary"} className="capitalize">
            {organization.role}
          </Badge>
          {simulatedPlan ? <Badge variant="outline">{simulatedPlan}</Badge> : null}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {organization.membersCount} member{organization.membersCount > 1 ? "s" : ""}
      </p>
    </button>
  );
});
