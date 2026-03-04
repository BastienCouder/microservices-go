"use client";

import { Check, ChevronsUpDown, Plus, Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/shared/utils";
import type { SidebarOrg } from "./sidebar-constants";

type SidebarOrganizationSwitcherProps = {
  collapsed: boolean;
  orgs: SidebarOrg[];
  activeOrg: string;
  setActiveOrg: (orgId: string) => void;
  orgOpen: boolean;
  setOrgOpen: (open: boolean) => void;
};

export function SidebarOrganizationSwitcher({
  collapsed,
  orgs,
  activeOrg,
  setActiveOrg,
  orgOpen,
  setOrgOpen,
}: SidebarOrganizationSwitcherProps) {
  const currentOrg = orgs.find((org) => org.id === activeOrg) || orgs[0];

  return (
    <div className={cn("py-3", collapsed ? "px-2" : "px-3")}>
      <Popover open={orgOpen} onOpenChange={setOrgOpen}>
        <PopoverTrigger asChild>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex h-9 w-full items-center justify-center rounded-md transition-colors hover:bg-muted">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200">
                    <span className="text-[10px] font-semibold text-primary">{currentOrg.initials}</span>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{currentOrg.name}</TooltipContent>
            </Tooltip>
          ) : (
            <button className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200">
                <span className="text-[10px] font-semibold text-primary">{currentOrg.initials}</span>
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-foreground">{currentOrg.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{currentOrg.domain}</div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          )}
        </PopoverTrigger>

        <PopoverContent side="right" align="start" className="w-64 p-1.5">
          <div className="space-y-0.5">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  setActiveOrg(org.id);
                  setOrgOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                  org.id === activeOrg ? "bg-primary/8 text-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200">
                  <span className="text-[9px] font-semibold text-primary">{org.initials}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{org.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{org.domain}</div>
                </div>
                {org.id === activeOrg ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
              </button>
            ))}
          </div>
          <Separator className="my-1.5" />
          <button className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Plus className="h-4 w-4" />
            Add organization
          </button>
          <button className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
