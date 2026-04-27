"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiRoutes } from "@/lib/api-config";
import { appQueryKeys } from "@/lib/query-keys";
import {
  loadOrganizationSummaries,
  type OrganizationSummary,
} from "@/features/organizations/_lib/shared/organization-page-api";
import { gatewayJSON } from "@/shared/api/gateway";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import type { OrganizationHierarchy } from "@/shared/models";
import { findBySlugOrId } from "@/shared/public-slugs";
import {
  buildScopedHref,
  readOrganizationIdFromSearch,
  readProjectIdFromSearch,
  readSelectedOrganizationID,
  readSelectedProjectID,
  storeSelectedOrganizationID,
  storeSelectedProjectID,
} from "@/shared/selection";
import { cn } from "@/shared/utils";
import { MONITORING_ITEMS, SIDEBAR_LABELS, type SidebarProjectOption } from "./sidebar-constants";
import { SidebarLanguageSwitcher } from "./sidebar-language-switcher";
import { SidebarOrganizationSwitcher } from "./sidebar-organization-switcher";
import { SidebarNavItem } from "./sidebar-nav-item";
import { SidebarPromptPlanProgress } from "./sidebar-prompt-plan-progress";
import { normalizeOrganizationHierarchy, selectPreferredID } from "./sidebar-state";

const EMPTY_ORGANIZATIONS: OrganizationSummary[] = [];

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PR";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function normalizeSidebarProjects(hierarchy: OrganizationHierarchy | null): SidebarProjectOption[] {
  if (!hierarchy) return [];

  return [...hierarchy.projects]
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .map((project) => ({
      id: project.id,
      slug: project.slug,
      name: project.name,
      organizationId: hierarchy.organization.id,
      organizationSlug: hierarchy.organization.slug,
      organizationName: hierarchy.organization.name,
      brandName: project.brandName,
      status: project.status,
      initials: getInitials(project.name),
    }));
}

async function loadSidebarHierarchy(
  apiBaseURL: string,
  organizationId: string,
  signal?: AbortSignal,
): Promise<OrganizationHierarchy | null> {
  const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.hierarchy(organizationId), {
    method: "GET",
    organizationId,
    signal,
  });

  if (!response.ok) {
    throw new Error("Impossible de charger les projets de cette organisation.");
  }

  return normalizeOrganizationHierarchy(response.data, organizationId);
}

function SidebarComponent({
  apiBaseURL = "",
  className,
  activePath,
  busy = false,
  onLogout,
}: {
  apiBaseURL?: string;
  className?: string;
  activePath?: string;
  busy?: boolean;
  onLogout?: () => Promise<void>;
}) {
  const content = useI18nScope("sidebar");
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const currentPath = activePath || pathname;
  const canonicalCurrentPath = currentPath;
  const [collapsed, setCollapsed] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);

  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, null),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadOrganizationSummaries(apiBaseURL, signal),
  });
  const organizations = organizationsQuery.data ?? EMPTY_ORGANIZATIONS;
  const routeOrganizationToken = readOrganizationIdFromSearch(location.search);
  const routeOrganization = useMemo(
    () => findBySlugOrId(organizations, routeOrganizationToken),
    [organizations, routeOrganizationToken],
  );
  const selectedOrganizationId = useMemo(
    () =>
      selectPreferredID({
        candidates: [routeOrganization?.id, readSelectedOrganizationID(), organizations[0]?.id],
        availableIds: organizations.map((organization) => organization.id),
      }),
    [organizations, routeOrganization],
  );

  const hierarchyQuery = useQuery({
    queryKey: appQueryKeys.organizationHierarchy(apiBaseURL, selectedOrganizationId),
    enabled: apiBaseURL.trim() !== "" && selectedOrganizationId !== "",
    queryFn: ({ signal }) => loadSidebarHierarchy(apiBaseURL, selectedOrganizationId, signal),
  });
  const hierarchy = hierarchyQuery.data ?? null;
  const projects = useMemo(() => normalizeSidebarProjects(hierarchy), [hierarchy]);
  const routeProjectToken = readProjectIdFromSearch(location.search);
  const routeProject = useMemo(
    () => findBySlugOrId(projects, routeProjectToken),
    [projects, routeProjectToken],
  );
  const selectedProjectId = useMemo(
    () =>
      selectPreferredID({
        candidates: [routeProject?.id, readSelectedProjectID(), projects[0]?.id],
        availableIds: projects.map((project) => project.id),
      }),
    [projects, routeProject],
  );

  useEffect(() => {
    storeSelectedOrganizationID(selectedOrganizationId);
    storeSelectedProjectID(selectedProjectId);
  }, [selectedOrganizationId, selectedProjectId]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projects[0] || null,
    [projects, selectedProjectId],
  );
  const activeOrganization =
    organizations.find((organization) => organization.id === selectedOrganizationId) || null;
  const projectScopedMonitoringHref = buildScopedHref("/monitoring", {
    project: activeProject?.slug,
  });
  const organizationHref = buildScopedHref("/organizations", {
    org: activeOrganization?.slug,
  });
  const projectScopedItems = useMemo(
    () =>
      MONITORING_ITEMS.map((item) => ({
        ...item,
        href: buildScopedHref(item.href, { project: activeProject?.slug }),
      })),
    [activeProject?.slug],
  );
  const addProjectHref = buildScopedHref("/organizations", {
    org: activeOrganization?.slug || activeProject?.organizationSlug,
    project: activeProject?.slug,
    createProject: "1",
  });
  const perceptionHref = buildScopedHref("/perception", {
    project: activeProject?.slug,
  });
  const isActiveHref = (href: string) => canonicalCurrentPath === href.split("?", 1)[0];

  const handleSelectProject = (projectId: string) => {
    const nextProject = projects.find((project) => project.id === projectId);
    storeSelectedProjectID(projectId);
    navigate(
      buildScopedHref(`${location.pathname}${location.search}`, {
        project: nextProject?.slug,
        org: nextProject?.organizationSlug || activeOrganization?.slug,
        createProject: null,
      }),
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "sticky top-0 flex h-screen flex-col border-r border-border bg-background transition-[width,min-width] duration-200 ease-in-out",
          collapsed ? "w-[60px] min-w-[60px]" : "w-[190px] min-w-[190px]",
          className,
        )}
      >
        <div className={cn("h-12 flex items-center px-3", collapsed ? "justify-center" : "gap-2")}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">logo</span>
          </div>
          {!collapsed ? (
            <span className="line-clamp-1 text-[15px] font-semibold tracking-tight text-foreground">
              {activeProject?.name || content.projects}
            </span>
          ) : null}
        </div>

        <Separator />

        <SidebarOrganizationSwitcher
          collapsed={collapsed}
          projects={projects}
          activeProjectId={activeProject?.id || ""}
          onSelectProject={handleSelectProject}
          addProjectHref={addProjectHref}
          orgOpen={orgOpen}
          setOrgOpen={setOrgOpen}
        />

        <Separator />

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-1">
            <SidebarNavItem
              href={projectScopedMonitoringHref}
              label={content.monitoring}
              active={isActiveHref(projectScopedMonitoringHref)}
              collapsed={collapsed}
              className="font-bold uppercase tracking-wider"
            />
          </div>

          <div className="mb-4 mt-2">
            <div className="relative space-y-1.5">
              {!collapsed ? <div className="absolute bottom-1 left-[11px] top-1 w-[2px] rounded-full bg-border" /> : null}
              {projectScopedItems.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  href={item.href}
                  label={content[item.labelKey] || SIDEBAR_LABELS[item.labelKey]}
                  active={isActiveHref(item.href)}
                  indent={!collapsed}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>

          <div className="mb-1">
            <SidebarNavItem
              href={perceptionHref}
              label={content.perception}
              active={isActiveHref(perceptionHref)}
              collapsed={collapsed}
              className="font-bold uppercase tracking-wider"
            />
            <SidebarNavItem
              href={organizationHref}
              label={content.organisation}
              active={isActiveHref(organizationHref)}
              collapsed={collapsed}
              className="font-bold uppercase tracking-wider"
            />
          </div>
        </nav>

        <div className="border-t border-border p-2">
          <SidebarPromptPlanProgress
            apiBaseURL={apiBaseURL}
            organizationId={selectedOrganizationId}
            projectId={selectedProjectId}
            collapsed={collapsed}
          />
          <div className="mb-1">
            <SidebarLanguageSwitcher collapsed={collapsed} />
          </div>
          <button
            disabled={busy}
            className={cn(
              "mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              collapsed && "justify-center",
              busy && "cursor-not-allowed opacity-60",
            )}
            onClick={() => void onLogout?.()}
            type="button"
          >
            {collapsed ? <span className="text-xs font-semibold uppercase tracking-[0.18em]">L</span> : <span>{content.logout}</span>}
          </button>
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              collapsed && "justify-center",
            )}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" /> 
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                <span>{content.collapse}</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

export const Sidebar = memo(SidebarComponent);
Sidebar.displayName = "Sidebar";
