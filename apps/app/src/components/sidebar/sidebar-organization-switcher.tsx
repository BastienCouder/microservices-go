"use client";

import { Check, ChevronsUpDown, FolderPlus, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/shared/utils";
import type { SidebarProjectOption } from "./sidebar-constants";

type SidebarOrganizationSwitcherProps = {
  collapsed: boolean;
  projects: SidebarProjectOption[];
  activeProjectId: string;
  activeOrganizationName: string;
  onSelectProject: (projectId: string) => void;
  addProjectHref: string;
  settingsHref: string;
  organizationsHref: string;
  orgOpen: boolean;
  setOrgOpen: (open: boolean) => void;
};

function getSubtitle(project: SidebarProjectOption | undefined, organizationName: string): string {
  if (!project) {
    return organizationName || "No project available";
  }
  if (project.brandName.trim() !== "") {
    return `${project.brandName} · ${project.organizationName || organizationName}`;
  }
  return project.organizationName || organizationName || "No organization selected";
}

export function SidebarOrganizationSwitcher({
  collapsed,
  projects,
  activeProjectId,
  activeOrganizationName,
  onSelectProject,
  addProjectHref,
  settingsHref,
  organizationsHref,
  orgOpen,
  setOrgOpen,
}: SidebarOrganizationSwitcherProps) {
  const currentProject = projects.find((project) => project.id === activeProjectId) || projects[0];
  const title = currentProject?.name || "Projects";
  const subtitle = getSubtitle(currentProject, activeOrganizationName);

  return (
    <div className={cn("py-3", collapsed ? "px-2" : "px-3")}>
      <Popover open={orgOpen} onOpenChange={setOrgOpen}>
        <PopoverTrigger asChild>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex h-9 w-full items-center justify-center rounded-md transition-colors hover:bg-muted">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200">
                    <span className="text-[10px] font-semibold text-primary">{currentProject?.initials || "PR"}</span>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{title}</TooltipContent>
            </Tooltip>
          ) : (
            <button className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200">
                <span className="text-[10px] font-semibold text-primary">{currentProject?.initials || "PR"}</span>
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-foreground">{title}</div>
                <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          )}
        </PopoverTrigger>

        <PopoverContent side="right" align="start" className="w-64 p-1.5">
          {projects.length > 0 ? (
            <div className="space-y-0.5">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    onSelectProject(project.id);
                    setOrgOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                    project.id === activeProjectId ? "bg-primary/8 text-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200">
                    <span className="text-[9px] font-semibold text-primary">{project.initials}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{project.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{getSubtitle(project, activeOrganizationName)}</div>
                  </div>
                  {project.id === activeProjectId ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="px-2.5 py-2 text-sm text-muted-foreground">
              No projects in this organization yet.
            </p>
          )}
          <Separator className="my-1.5" />
          <Link
            to={addProjectHref}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <FolderPlus className="h-4 w-4" />
            Add project
          </Link>
          <Link
            to={settingsHref}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            Project settings
          </Link>
          <Link
            to={organizationsHref}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Manage organization
          </Link>
        </PopoverContent>
      </Popover>
    </div>
  );
}
