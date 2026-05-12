import { memo, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiRoutes } from "@/lib/api-config";
import { appQueryKeys } from "@/lib/query-keys";
import {
  loadOrganizationSummaries,
  type OrganizationSummary,
} from "@/features/organizations/_lib/shared/organization-page-api";
import {
  canManageOrganizationPages,
  DEFAULT_ORGANIZATION_VIEW_TAB,
  getOrganizationViewTabsForRoles,
  ORGANIZATION_VIEW_TABS,
} from "@/features/organizations/_lib/shared/constants";
import { buildCreateProjectOnboardingHref } from "@/features/organizations/_lib/shared/organization-page-links";
import { gatewayJSON } from "@/shared/api/gateway";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import type { OrganizationHierarchy } from "@/shared/models";
import { findBySlugOrId } from "@/shared/public-slugs";
import {
  SELECTED_CONTEXT_CHANGE_EVENT,
  buildScopedHref,
  readOrganizationIdFromSearch,
  readProjectIdFromSearch,
  readRouteQueryParam,
  readSelectedOrganizationID,
  readSelectedProjectToken,
  storeSelectedProjectContext,
  storeSelectedOrganizationID,
} from "@/shared/selection";
import { cn } from "@/shared/utils";

import { SidebarLanguageSwitcher } from "./sidebar-language-switcher";
import { SidebarOrganizationSwitcher } from "./sidebar-organization-switcher";
import { SidebarNavItem } from "./sidebar-nav-item";
import { SidebarPromptPlanProgress } from "./sidebar-prompt-plan-progress";
import type { SidebarProjectOption } from "./sidebar-constants";
import {
  findOrganizationIdForProjectToken,
  findProjectIdForToken,
  normalizeOrganizationHierarchy,
  selectPreferredID,
} from "./sidebar-state";

const EMPTY_ORGANIZATIONS: OrganizationSummary[] = [];

type SidebarProps = {
  apiBaseURL?: string;
  className?: string;
  activePath?: string;
  busy?: boolean;
  onLogout?: () => Promise<void>;
};

function getInitials(value: string): string {
  const [first = "", second = ""] = value.trim().split(/\s+/);

  if (!first) return "PR";
  if (!second) return first.slice(0, 2).toUpperCase();

  return `${first[0]}${second[0]}`.toUpperCase();
}

function normalizeSidebarProjects(
  hierarchy: OrganizationHierarchy | null,
): SidebarProjectOption[] {
  if (!hierarchy) return [];

  const { organization, projects } = hierarchy;

  return [...projects]
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .map((project) => ({
      id: project.id,
      slug: project.slug,
      name: project.name,
      organizationId: organization.id,
      organizationSlug: organization.slug,
      organizationName: organization.name,
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
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.organizations.hierarchy(organizationId),
    {
      method: "GET",
      organizationId,
      signal,
    },
  );

  if (!response.ok) {
    throw new Error("Impossible de charger les projets de cette organisation.");
  }

  return normalizeOrganizationHierarchy(response.data, organizationId);
}

async function loadSidebarHierarchies(
  apiBaseURL: string,
  organizations: OrganizationSummary[],
  signal?: AbortSignal,
): Promise<Array<OrganizationHierarchy | null>> {
  return Promise.all(
    organizations.map((organization) =>
      loadSidebarHierarchy(apiBaseURL, organization.id, signal).catch(() => null),
    ),
  );
}

function SidebarComponent({
  apiBaseURL = "",
  className,
  activePath,
  busy = false,
  onLogout,
}: SidebarProps) {
  const content = useI18nScope("sidebar");
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const [settingsSidebarOpen, setSettingsSidebarOpen] = useState(() =>
    ["/organizations", "/account"].includes(location.pathname),
  );
  const [selectedContext, setSelectedContext] = useState(() => ({
    organizationId: readSelectedOrganizationID(),
    projectToken: readSelectedProjectToken(),
  }));

  const currentPath = activePath || location.pathname;
  const apiEnabled = apiBaseURL.trim() !== "";
  const settingsPathActive =
    currentPath === "/organizations" || currentPath === "/account";

  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, null),
    enabled: apiEnabled,
    queryFn: ({ signal }) => loadOrganizationSummaries(apiBaseURL, signal),
  });

  const organizations = organizationsQuery.data ?? EMPTY_ORGANIZATIONS;

  const routeOrganizationToken = readOrganizationIdFromSearch(location.search);
  const storedOrganizationId = selectedContext.organizationId;
  const routeProjectToken = readProjectIdFromSearch(location.search);
  const storedProjectId = selectedContext.projectToken;
  const preferredProjectToken = routeProjectToken || storedProjectId;

  useEffect(() => {
    const syncSelectedContext = () => {
      setSelectedContext({
        organizationId: readSelectedOrganizationID(),
        projectToken: readSelectedProjectToken(),
      });
    };

    window.addEventListener(SELECTED_CONTEXT_CHANGE_EVENT, syncSelectedContext);
    window.addEventListener("storage", syncSelectedContext);

    return () => {
      window.removeEventListener(SELECTED_CONTEXT_CHANGE_EVENT, syncSelectedContext);
      window.removeEventListener("storage", syncSelectedContext);
    };
  }, []);

  useEffect(() => {
    if (settingsPathActive) {
      setSettingsSidebarOpen(true);
    }
  }, [settingsPathActive]);

  const routeOrganization = useMemo(
    () => findBySlugOrId(organizations, routeOrganizationToken),
    [organizations, routeOrganizationToken],
  );

  const shouldResolveProjectOrganization =
    apiEnabled &&
    organizations.length > 0 &&
    preferredProjectToken !== "" &&
    storedOrganizationId === "" &&
    routeOrganizationToken === "";

  const projectOrganizationQuery = useQuery({
    queryKey: [
      "sidebar-project-organization",
      apiBaseURL,
      organizations.map(({ id }) => id).join(","),
      preferredProjectToken,
    ],
    enabled: shouldResolveProjectOrganization,
    queryFn: ({ signal }) => loadSidebarHierarchies(apiBaseURL, organizations, signal),
  });

  const projectOrganizationId = useMemo(
    () =>
      findOrganizationIdForProjectToken(
        projectOrganizationQuery.data ?? [],
        preferredProjectToken,
      ),
    [preferredProjectToken, projectOrganizationQuery.data],
  );

  const selectedOrganizationId = useMemo(
    () =>
      selectPreferredID({
        candidates: [
          routeOrganization?.id,
          projectOrganizationId,
          storedOrganizationId,
          organizations[0]?.id,
        ],
        availableIds: organizations.map(({ id }) => id),
      }),
    [organizations, projectOrganizationId, routeOrganization?.id, storedOrganizationId],
  );

  const hierarchyQuery = useQuery({
    queryKey: appQueryKeys.organizationHierarchy(apiBaseURL, selectedOrganizationId),
    enabled: apiEnabled && selectedOrganizationId !== "",
    queryFn: ({ signal }) =>
      loadSidebarHierarchy(apiBaseURL, selectedOrganizationId, signal),
  });

  const hierarchy = hierarchyQuery.data ?? null;

  const projects = useMemo(() => normalizeSidebarProjects(hierarchy), [hierarchy]);

  const routeProject = useMemo(
    () => findBySlugOrId(projects, routeProjectToken),
    [projects, routeProjectToken],
  );

  const storedProjectIdInCurrentOrganization = useMemo(
    () => findProjectIdForToken(projects, storedProjectId),
    [projects, storedProjectId],
  );

  const selectedProjectId = useMemo(
    () =>
      selectPreferredID({
        candidates: [
          routeProject?.id,
          storedProjectIdInCurrentOrganization,
          preferredProjectToken === "" ? projects[0]?.id : "",
        ],
        availableIds: projects.map(({ id }) => id),
      }),
    [
      preferredProjectToken,
      projects,
      routeProject?.id,
      storedProjectIdInCurrentOrganization,
    ],
  );

  const activeProject = useMemo(
    () =>
      projects.find(({ id }) => id === selectedProjectId) ??
      (preferredProjectToken === "" ? projects[0] ?? null : null),
    [preferredProjectToken, projects, selectedProjectId],
  );

  const activeOrganization = useMemo(
    () => organizations.find(({ id }) => id === selectedOrganizationId) ?? null,
    [organizations, selectedOrganizationId],
  );

  useEffect(() => {
    if (shouldResolveProjectOrganization && !projectOrganizationQuery.data) {
      return;
    }

    if (selectedOrganizationId !== "") {
      storeSelectedOrganizationID(selectedOrganizationId);
    }
  }, [
    projectOrganizationQuery.data,
    selectedOrganizationId,
    shouldResolveProjectOrganization,
  ]);

  const scopedLinks = useMemo(() => {
    const project = activeProject?.slug;
    const org = activeOrganization?.slug ?? activeProject?.organizationSlug;

    return {
      dashboard: buildScopedHref("/monitoring", { project }),
      prompts: buildScopedHref("/prompts", { project, tab: "prompts" }),
      responses: buildScopedHref("/prompts", { project, tab: "responses" }),
      pages: buildScopedHref("/pages", { project }),
      models: buildScopedHref("/models", { project }),
      perception: buildScopedHref("/perception", { project }),
      optimizeActions: buildScopedHref("/optimize/actions", { project }),
      traffic: buildScopedHref("/traffic", { project }),
      organizations: buildScopedHref("/organizations", { org }),
      account: "/account",
      addProject: buildCreateProjectOnboardingHref(selectedOrganizationId),
    };
  }, [
    activeProject?.slug,
    activeProject?.organizationSlug,
    activeOrganization?.slug,
    selectedOrganizationId,
  ]);

  const organizationSettingsLinks = useMemo(() => {
    const org = activeOrganization?.slug ?? activeProject?.organizationSlug;

    return Object.fromEntries(
      ORGANIZATION_VIEW_TABS.map((item) => [
        item.value,
        buildScopedHref("/organizations", {
          org,
          section: item.value === DEFAULT_ORGANIZATION_VIEW_TAB ? null : item.value,
        }),
      ]),
    ) as Record<(typeof ORGANIZATION_VIEW_TABS)[number]["value"], string>;
  }, [activeOrganization?.slug, activeProject?.organizationSlug]);
  const visibleOrganizationViewTabs = useMemo(
    () => getOrganizationViewTabsForRoles([activeOrganization?.role ?? "member"]),
    [activeOrganization?.role],
  );
  const canManageActiveOrganization = canManageOrganizationPages([
    activeOrganization?.role ?? "member",
  ]);

  const activeOrganizationSection =
    readRouteQueryParam(location.search, "section") || DEFAULT_ORGANIZATION_VIEW_TAB;

  const isActiveHref = (href: string) => {
    const hrefPath = href.split("?", 1)[0];
    const hrefParams = new URLSearchParams(href.split("?")[1] || "");

    if (currentPath !== hrefPath) return false;

    // For prompts page, check the tab parameter
    if (hrefPath === "/prompts") {
      const currentTab = readRouteQueryParam(location.search, "tab") || "prompts";
      const hrefTab = hrefParams.get("tab") || "prompts";
      return currentTab === hrefTab;
    }

    return true;
  };

  const handleSelectProject = (projectId: string) => {
    const nextProject = projects.find(({ id }) => id === projectId);

    setSelectedContext({
      organizationId: nextProject?.organizationId ?? selectedOrganizationId,
      projectToken: nextProject?.slug ?? projectId,
    });

    storeSelectedProjectContext({
      organizationId: nextProject?.organizationId,
      projectId,
      projectToken: nextProject?.slug,
    });

    navigate(
      buildScopedHref(location.pathname, {
        project: nextProject?.slug,
        org: null,
        createProject: null,
      }),
    );
  };

  const mainNavItems = [
    {
      group: "monitoring",
      href: scopedLinks.dashboard,
      label: "Dashboard",
    },
    {
      group: "monitoring",
      href: scopedLinks.prompts,
      label: "Prompts",
    },
    {
      group: "monitoring",
      href: scopedLinks.responses,
      label: "Responses",
    },
    {
      group: "monitoring",
      href: scopedLinks.pages,
      label: "Pages",
    },
    {
      group: "main",
      href: scopedLinks.perception,
      label: content.perception || "Perception",
    },
    {
      group: "main",
      href: scopedLinks.optimizeActions,
      label: content.optimizeActions || "Optimisation",
    },
    {
      group: "main",
      href: scopedLinks.traffic,
      label: content.traffic || "Traffic",
    },
        {
      group: "main",
      href: scopedLinks.models,
      label: "Modèles",
    },
    {
      group: "settings",
      href: scopedLinks.organizations,
      label: content.organisation || "Organisations",
      opensSettings: true,
    },
    {
      group: "settings",
      href: scopedLinks.account,
      label: content.account || "Compte",
      opensSettings: true,
    },
  ] as const;

  const showSettingsSidebar = settingsSidebarOpen && settingsPathActive;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "sticky top-0 flex h-screen flex-col border-r border-border bg-background transition-[width,min-width] duration-200 ease-in-out",
          collapsed ? "w-[60px] min-w-[60px]" : "w-[190px] min-w-[190px]",
          className,
        )}
      >
        <SidebarOrganizationSwitcher
          collapsed={collapsed}
          projects={projects}
          activeProjectId={activeProject?.id ?? ""}
          onSelectProject={handleSelectProject}
          addProjectHref={scopedLinks.addProject}
          canAddProject={canManageActiveOrganization}
          orgOpen={orgOpen}
          setOrgOpen={setOrgOpen}
        />

        <Separator />

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {showSettingsSidebar ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setSettingsSidebarOpen(false)}
                className={cn(
                  "cursor-pointer flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center",
                )}
              >
                <ArrowLeft className="h-4 w-4" />
                {!collapsed && <span>Retour</span>}
              </button>

              <section className="space-y-1.5">
                {!collapsed && (
                  <div className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Organisation
                  </div>
                )}

                <div className="relative space-y-1.5">
                  {!collapsed && (
                    <div className="absolute bottom-1 left-[11px] top-1 w-[2px] rounded-full bg-border" />
                  )}

                  {visibleOrganizationViewTabs.map((item) => {
                    const active =
                      currentPath === "/organizations" &&
                      activeOrganizationSection === item.value;

                    return (
                      <SidebarNavItem
                        key={item.value}
                        href={organizationSettingsLinks[item.value]}
                        label={item.label}
                        active={active}
                        indent={!collapsed}   // 👈 important
                        collapsed={collapsed}
                      />
                    );
                  })}
                </div>
              </section>

              <section className="space-y-1.5">
                {!collapsed && (
                  <div className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Compte
                  </div>
                )}

                <div className="relative space-y-1.5">
                  {!collapsed && (
                    <div className="absolute bottom-1 left-[11px] top-1 w-[2px] rounded-full bg-border" />
                  )}

                  <SidebarNavItem
                    href="/account"
                    label="Compte"
                    active={currentPath === "/account"}
                    indent={!collapsed}
                    collapsed={collapsed}
                  />
                </div>
              </section>
            </div>
          ) : (
            <div className="space-y-3">
              <section className="space-y-1.5">
                {!collapsed && (
                  <div className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Monitoring
                  </div>
                )}

                <div className="relative space-y-1.5">
                  {!collapsed && (
                    <div className="absolute bottom-1 left-[11px] top-1 w-[2px] rounded-full bg-border" />
                  )}

                  {mainNavItems
                    .filter((item) => item.group === "monitoring")
                    .map((item) => (
                      <SidebarNavItem
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        active={isActiveHref(item.href)}
                        indent={!collapsed}
                        collapsed={collapsed}
                      />
                    ))}
                </div>
              </section>

              <section className="space-y-2 pb-2">
                {mainNavItems
                  .filter((item) => item.group === "main")
                  .map((item) => (
                    <SidebarNavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      active={isActiveHref(item.href)}
                      collapsed={collapsed}
                    />
                  ))}
              </section>

              <section className="space-y-1.5">
                {!collapsed && (
                  <div className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Settings
                  </div>
                )}

                <div className="relative space-y-1.5">
                  {!collapsed && (
                    <div className="absolute bottom-1 left-[11px] top-1 w-[2px] rounded-full bg-border" />
                  )}

                  {mainNavItems
                    .filter((item) => item.group === "settings")
                    .map((item) => (
                      <SidebarNavItem
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        active={isActiveHref(item.href)}
                        indent={!collapsed}
                        collapsed={collapsed}
                        onClick={() => {
                          if (item.opensSettings) {
                            setSettingsSidebarOpen(true);
                          }
                        }}
                      />
                    ))}
                </div>
              </section>
            </div>
          )}
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
            {collapsed ? (
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                L
              </span>
            ) : (
              <span>{content.logout || "Déconnexion"}</span>
            )}
          </button>

          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              collapsed && "justify-center",
            )}
            type="button"
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                <span>{content.collapse || "Réduire"}</span>
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
