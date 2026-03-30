"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { normalizeOrganizationHierarchy } from "@/features/organizations/lib/hierarchy";
import { apiRoutes } from "@/lib/api-config";
import { appQueryKeys } from "@/lib/query-keys";
import { gatewayJSON } from "@/shared/api/gateway";
import type { OrganizationHierarchy } from "@/shared/models";
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
import { MONITORING_ITEMS, ORGANIZATION_ITEMS, SIDEBAR_LABELS, type SidebarProjectOption } from "./sidebar-constants";
import { SidebarOrganizationSwitcher } from "./sidebar-organization-switcher";
import { SidebarNavItem } from "./sidebar-nav-item";

type SidebarMembership = {
  organizationId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getIDString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function normalizeMemberships(value: unknown): SidebarMembership[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      organizationId: getIDString(item.organizationId ?? item.id),
    }))
    .filter((item) => item.organizationId !== "");
}

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
      name: project.name,
      organizationId: hierarchy.organization.id,
      organizationName: hierarchy.organization.name,
      brandName: project.brandName,
      status: project.status,
      initials: getInitials(project.name),
    }));
}

async function loadSidebarMemberships(apiBaseURL: string, signal?: AbortSignal): Promise<SidebarMembership[]> {
  const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.me(), {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    if (response.status === 401) {
      return [];
    }
    throw new Error("Impossible de charger les organisations du user.");
  }

  return normalizeMemberships(response.data);
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
  const pathname = useLocation().pathname;
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = activePath || pathname;
  const canonicalCurrentPath = currentPath;
  const [collapsed, setCollapsed] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    readOrganizationIdFromSearch(location.search) || readSelectedOrganizationID(),
  );
  const [selectedProjectId, setSelectedProjectId] = useState(
    readProjectIdFromSearch(location.search) || readSelectedProjectID(),
  );
  const [orgOpen, setOrgOpen] = useState(false);

  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, null),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadSidebarMemberships(apiBaseURL, signal),
  });
  const memberships = organizationsQuery.data ?? [];

  useEffect(() => {
    const routeOrganizationId = readOrganizationIdFromSearch(location.search);
    const storedOrganizationId = readSelectedOrganizationID();
    const availableIds = new Set(memberships.map((membership) => membership.organizationId));

    const nextOrganizationId =
      (routeOrganizationId && availableIds.has(routeOrganizationId) ? routeOrganizationId : "") ||
      (selectedOrganizationId && availableIds.has(selectedOrganizationId) ? selectedOrganizationId : "") ||
      (storedOrganizationId && availableIds.has(storedOrganizationId) ? storedOrganizationId : "") ||
      memberships[0]?.organizationId ||
      "";

    setSelectedOrganizationId((current) => (current === nextOrganizationId ? current : nextOrganizationId));
    if (nextOrganizationId !== "") {
      storeSelectedOrganizationID(nextOrganizationId);
    }
  }, [location.search, memberships, selectedOrganizationId]);

  const hierarchyQuery = useQuery({
    queryKey: appQueryKeys.organizationHierarchy(apiBaseURL, selectedOrganizationId),
    enabled: apiBaseURL.trim() !== "" && selectedOrganizationId !== "",
    queryFn: ({ signal }) => loadSidebarHierarchy(apiBaseURL, selectedOrganizationId, signal),
  });
  const hierarchy = hierarchyQuery.data ?? null;
  const projects = useMemo(() => normalizeSidebarProjects(hierarchy), [hierarchy]);

  useEffect(() => {
    const routeProjectId = readProjectIdFromSearch(location.search);
    const storedProjectId = readSelectedProjectID();
    const availableProjectIds = new Set(projects.map((project) => project.id));

    const nextProjectId =
      (routeProjectId && availableProjectIds.has(routeProjectId) ? routeProjectId : "") ||
      (selectedProjectId && availableProjectIds.has(selectedProjectId) ? selectedProjectId : "") ||
      (storedProjectId && availableProjectIds.has(storedProjectId) ? storedProjectId : "") ||
      projects[0]?.id ||
      "";

    setSelectedProjectId((current) => (current === nextProjectId ? current : nextProjectId));
    storeSelectedProjectID(nextProjectId);
  }, [location.search, projects, selectedProjectId]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projects[0] || null,
    [projects, selectedProjectId],
  );
  const activeOrganizationName = hierarchy?.organization.name || activeProject?.organizationName || "";
  const projectScopedMonitoringHref = buildScopedHref("/monitoring", {
    projectId: activeProject?.id,
  });
  const projectScopedItems = useMemo(
    () =>
      MONITORING_ITEMS.map((item) => ({
        ...item,
        href: buildScopedHref(item.href, { projectId: activeProject?.id }),
      })),
    [activeProject?.id],
  );
  const organizationScopedItems = useMemo(
    () =>
      ORGANIZATION_ITEMS.map((item) => ({
        ...item,
        href: buildScopedHref(item.href, {
          org: selectedOrganizationId,
          projectId: item.href === "/settings" ? activeProject?.id : activeProject?.id,
        }),
      })),
    [activeProject?.id, selectedOrganizationId],
  );
  const addProjectHref = buildScopedHref("/organizations", {
    org: selectedOrganizationId,
    projectId: activeProject?.id,
    createProject: "1",
  });
  const perceptionHref = buildScopedHref("/perception", {
    projectId: activeProject?.id,
  });
  const optimizeActionsHref = buildScopedHref("/optimize/actions", {
    projectId: activeProject?.id,
  });
  const contentOptimizerHref = buildScopedHref("/optimize/content-optimizer", {
    projectId: activeProject?.id,
  });
  const impactHref = buildScopedHref("/impact", {
    projectId: activeProject?.id,
  });
  const projectSettingsHref = buildScopedHref("/settings", {
    org: selectedOrganizationId,
    projectId: activeProject?.id,
  });
  const organizationsHref = buildScopedHref("/organizations", {
    org: selectedOrganizationId,
    projectId: activeProject?.id,
  });
  const isActiveHref = (href: string) => canonicalCurrentPath === href.split("?", 1)[0];

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    storeSelectedProjectID(projectId);
    navigate(
      buildScopedHref(`${location.pathname}${location.search}`, {
        projectId,
        org: selectedOrganizationId,
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
              {activeProject?.name || activeOrganizationName || "projects"}
            </span>
          ) : null}
        </div>

        <Separator />

        <SidebarOrganizationSwitcher
          collapsed={collapsed}
          projects={projects}
          activeProjectId={activeProject?.id || ""}
          activeOrganizationName={activeOrganizationName}
          onSelectProject={handleSelectProject}
          addProjectHref={addProjectHref}
          settingsHref={projectSettingsHref}
          organizationsHref={organizationsHref}
          orgOpen={orgOpen}
          setOrgOpen={setOrgOpen}
        />

        <Separator />

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-1">
            <SidebarNavItem
              href={projectScopedMonitoringHref}
              label={"monitoring"}
              active={isActiveHref(projectScopedMonitoringHref)}
              collapsed={collapsed}
              className="font-bold uppercase tracking-wider text-[11px]"
            />
          </div>

          <div className="mb-1 mt-2">
            <div className="relative space-y-0.5">
              {!collapsed ? <div className="absolute bottom-1 left-[11px] top-1 w-[2px] rounded-full bg-border" /> : null}
              {projectScopedItems.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  href={item.href}
                  label={SIDEBAR_LABELS[item.labelKey]}
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
              label={"perception"}
              active={isActiveHref(perceptionHref)}
              collapsed={collapsed}
                  className="font-bold uppercase tracking-wider text-[11px]"
            />
          </div>
          {/* <div className="mb-1">
            <SidebarNavItem
              href={optimizeActionsHref}
              label={"optimize actions"}
              active={isActiveHref(optimizeActionsHref)}
              collapsed={collapsed}
                  className="font-bold uppercase tracking-wider text-[11px]"
            />
          </div> */}
          {/* <div className="mb-1">
            <SidebarNavItem
              href={contentOptimizerHref}
              label="Content Optimizer"
              active={isActiveHref(contentOptimizerHref)}
              collapsed={collapsed}
                  className="font-bold uppercase tracking-wider text-[11px]"
            />
          </div> */}
          {/* <div className="mb-1">
            <SidebarNavItem
              href={impactHref}
              label={"impact"}
              active={isActiveHref(impactHref)}
              collapsed={collapsed}
                  className="font-bold uppercase tracking-wider text-[11px]"
            />
          </div> */}

          <div className="mb-1 mt-4">
            <div className="relative mt-1 space-y-0.5">
              {!collapsed ? <div className="absolute bottom-1 left-[11px] top-1 w-[2px] rounded-full bg-border" /> : null}
              {organizationScopedItems.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  href={item.href}
                  label={SIDEBAR_LABELS[item.labelKey]}
                  active={isActiveHref(item.href)}
                  indent={!collapsed}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        </nav>

        <div className="border-t border-border p-2">
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
            {collapsed ? <span className="text-xs font-semibold uppercase tracking-[0.18em]">L</span> : <span>logout</span>}
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
                <span>{"collapse"}</span>
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
