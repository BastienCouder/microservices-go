"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { cn } from "@/shared/utils";
import type { SidebarProjectOption } from "./sidebar-constants";
import { Button } from "../ui/button";

type SidebarOrganizationSwitcherProps = {
  collapsed: boolean;
  projects: SidebarProjectOption[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  addProjectHref: string;
  onAddProject?: () => void;
  canAddProject?: boolean;
  orgOpen: boolean;
  setOrgOpen: (open: boolean) => void;
};

function getSubtitle(
  project: SidebarProjectOption | undefined,
  content: Record<string, string>,
): string {
  if (!project) {
    return content.noProjectAvailable;
  }
  if (project.brandName.trim() !== "") {
    return project.brandName;
  }
  return "";
}

export function SidebarOrganizationSwitcher({
  collapsed,
  projects,
  activeProjectId,
  onSelectProject,
  addProjectHref,
  onAddProject,
  canAddProject = true,
  orgOpen,
  setOrgOpen,
}: SidebarOrganizationSwitcherProps) {
  const content = useI18nScope("sidebar");
  const currentProject = projects.find((project) => project.id === activeProjectId) || projects[0];
  const title = currentProject?.name || content.projects;
  const subtitle = getSubtitle(currentProject, content);

  return (
      <Popover open={orgOpen} onOpenChange={setOrgOpen}>
        <PopoverTrigger asChild className="bg-background/10 hover:bg-background/20">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex h-9 w-full items-center justify-center rounded-md transition-colors hover:bg-muted">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200">
                    <span className="text-[10px] font-semibold text-background">{currentProject?.initials || "PR"}</span>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{title}</TooltipContent>
            </Tooltip>
          ) : (
            <button className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200">
                <span className="text-[10px] font-semibold text-primary">{currentProject?.initials || "PR"}</span>
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-background">{title}</div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-background" />
            </button>
          )}
        </PopoverTrigger>

        <PopoverContent side="right" align="start" className="w-64 p-1.5">
          {canAddProject ? (
            <Button asChild>
              <Link to={addProjectHref} onClick={onAddProject}>
                {content.addProject}
              </Link>
            </Button>
          ) : null}
          {projects.length > 0 ? (
            <div className="space-y-0.5">
              {projects.map((project) => {
                const projectSubtitle = getSubtitle(project, content);

                return (
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
                      {projectSubtitle ? <div className="truncate text-[11px] text-muted-foreground">{projectSubtitle}</div> : null}
                    </div>
                    {project.id === activeProjectId ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-2.5 py-2 text-sm text-muted-foreground">
              {content.noProjectsInOrganization}
            </p>
          )}
        </PopoverContent>
      </Popover>
  );
}
