import { memo, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LogOut } from "lucide-react";

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
import {
  buildCreateProjectOnboardingHref,
  prepareCreateProjectOnboardingContext,
} from "@/features/organizations/_lib/shared/organization-page-links";
import { gatewayJSON } from "@/shared/api/gateway";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import type { OrganizationHierarchy } from "@/shared/models";
import { loadProjectContextHierarchies } from "@/shared/project-context";
import { findBySlugIdOrPublicId, findBySlugOrId } from "@/shared/public-slugs";
import {
  SELECTED_CONTEXT_CHANGE_EVENT,
  buildScopedHref,
  readOrganizationIdFromSearch,
  readProjectTokenFromSearch,
  readRouteQueryParam,
  readSelectedOrganizationID,
  readSelectedProjectID,
  storeSelectedProjectContext,
  storeSelectedOrganizationContext,
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
import { Button } from "../ui/button";

const EMPTY_ORGANIZATIONS: OrganizationSummary[] = [];
const SETTINGS_PATHS = ["/organizations", "/account"];

const routePreloaders: Record<string, () => Promise<unknown>> = {
  "/monitoring": () => import("@/features/monitoring/index"),
  "/prompts": () => import("@/features/prompts/index"),
  "/pages": () => import("@/features/pages/index"),
  "/traffic": () => import("@/features/traffic/index"),
  "/models": () => import("@/features/models/index"),
  "/perception": () => import("@/features/perception"),
  "/perception/responses": () => import("@/features/perception/responses"),
  "/content-optimizer": () => import("@/features/content-optimizer/index"),
  "/error-hub": () => import("@/features/error-hub/index"),
  "/brands": () => import("@/features/brands/index"),
  "/brand-canon": () => import("@/features/brands/brand-canon/index"),
  "/organizations": () => import("@/features/organizations/index"),
  "/account": () => import("@/features/account/index"),
};

const preloadedRoutePaths = new Set<string>();

function preloadRouteFromHref(href: string) {
  const [path] = href.split("?");
  const preload = routePreloaders[path];

  if (!preload || preloadedRoutePaths.has(path)) return;

  preloadedRoutePaths.add(path);
  void preload().catch(() => {
    preloadedRoutePaths.delete(path);
  });
}

type SidebarProps = {
  apiBaseURL?: string;
  className?: string;
  activePath?: string;
  busy?: boolean;
  userId?: string | number | null;
  onLogout?: () => Promise<void>;
};

type NavItem = {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
  onPreload?: () => void;
};

type NavSectionProps = {
  title?: string;
  items: NavItem[];
  collapsed: boolean;
  indent?: boolean;
};

const initials = (value: string) => {
  const [a = "", b = ""] = value.trim().split(/\s+/);
  return (!a ? "PR" : b ? `${a[0]}${b[0]}` : a.slice(0, 2)).toUpperCase();
};

const normalizeProjects = (
  hierarchy: OrganizationHierarchy | null,
): SidebarProjectOption[] =>
  hierarchy
    ? [...hierarchy.projects]
        .sort((a, b) => a.name.localeCompare(b.name, "en"))
        .map((project) => ({
          id: project.id,
          slug: project.slug,
          name: project.name,
          organizationId: hierarchy.organization.id,
          organizationSlug: hierarchy.organization.slug,
          organizationName: hierarchy.organization.name,
          brandName: project.brandName,
          status: project.status,
          initials: initials(project.name),
        }))
    : [];

async function loadHierarchy(
  apiBaseURL: string,
  organizationRef: string,
  signal?: AbortSignal,
) {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.organizations.hierarchy(organizationRef),
    { method: "GET", organizationId: organizationRef, signal },
  );

  if (!response.ok) {
    throw new Error("Impossible de charger les projets de cette organisation.");
  }

  return normalizeOrganizationHierarchy(response.data, organizationRef);
}

function NavSection({ title, items, collapsed, indent }: NavSectionProps) {
  return (
    <section className={indent ? "space-y-1.5" : "space-y-2 pb-2"}>
      {title && !collapsed && (
        <div className="px-2 pb-1 text-xs font-bold uppercase tracking-[0.04em] text-white/55">
          {title}
        </div>
      )}

      <div className={indent ? "relative space-y-1.5" : "space-y-1.5"}>
        {indent && !collapsed && (
          <div className="absolute bottom-1 left-[11px] top-1 w-[2px] rounded-full bg-white/22" />
        )}

        {items.map((item) => (
          <div
            key={item.href}
            onPointerEnter={item.onPreload}
            onFocusCapture={item.onPreload}
          >
            <SidebarNavItem
              href={item.href}
              label={item.label}
              active={item.active}
              indent={indent && !collapsed}
              collapsed={collapsed}
              onClick={item.onClick}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function SidebarComponent({
  apiBaseURL = "",
  className,
  activePath,
  busy = false,
  userId = null,
  onLogout,
}: SidebarProps) {
  const content = useI18nScope("sidebar");
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() =>
    SETTINGS_PATHS.includes(location.pathname),
  );
  const [stored, setStored] = useState(() => ({
    organizationId: readSelectedOrganizationID(),
    projectId: readSelectedProjectID(),
  }));

  const apiEnabled = !!apiBaseURL.trim();
  const currentPath = activePath || location.pathname;
  const isSettingsPath = SETTINGS_PATHS.includes(currentPath);
  const showSettings = settingsOpen && isSettingsPath;

  const routeOrgToken = readOrganizationIdFromSearch(location.search);
  const routeProjectToken = readProjectTokenFromSearch(location.search);
  const preferredProjectToken = routeProjectToken || stored.projectId;

  useEffect(() => {
    const sync = () =>
      setStored({
        organizationId: readSelectedOrganizationID(),
        projectId: readSelectedProjectID(),
      });

    window.addEventListener(SELECTED_CONTEXT_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(SELECTED_CONTEXT_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const { data: organizations = EMPTY_ORGANIZATIONS } = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, userId),
    enabled: apiEnabled,
    queryFn: ({ signal }) => loadOrganizationSummaries(apiBaseURL, signal),
  });

  const routeOrg = findBySlugIdOrPublicId(organizations, routeOrgToken);
  const storedOrg = findBySlugIdOrPublicId(organizations, stored.organizationId);
  const organizationIds = useMemo(
    () => organizations.map(({ id }) => id),
    [organizations],
  );
  const organizationIdsKey = useMemo(
    () => [...organizationIds].sort().join(","),
    [organizationIds],
  );

  const shouldResolveOrg =
    apiEnabled &&
    !!organizations.length &&
    !!preferredProjectToken &&
    !routeOrgToken;

  const projectContextQuery = useQuery({
    queryKey: appQueryKeys.projectContextHierarchies(apiBaseURL, organizationIdsKey),
    enabled: shouldResolveOrg,
    queryFn: ({ signal }) =>
      loadProjectContextHierarchies(apiBaseURL, organizations, signal),
  });

  const projectOrgId = findOrganizationIdForProjectToken(
    projectContextQuery.data ?? [],
    preferredProjectToken,
    stored.organizationId,
  );

  const selectedOrgId = selectPreferredID({
    candidates: [
      routeOrg?.id,
      projectOrgId,
      storedOrg?.id,
      organizations[0]?.id,
    ],
    availableIds: organizationIds,
  });
  const activeOrg =
    organizations.find(({ id }) => id === selectedOrgId) ?? null;
  const selectedOrgRef = activeOrg?.publicId || selectedOrgId;

  const { data: hierarchy = null } = useQuery({
    queryKey: appQueryKeys.organizationHierarchy(apiBaseURL, selectedOrgRef),
    enabled: apiEnabled && !!selectedOrgRef,
    queryFn: ({ signal }) => loadHierarchy(apiBaseURL, selectedOrgRef, signal),
  });

  const projects = useMemo(() => normalizeProjects(hierarchy), [hierarchy]);
  const routeProject = findBySlugOrId(projects, routeProjectToken);
  const storedProjectId = findProjectIdForToken(projects, stored.projectId);

  const selectedProjectId = selectPreferredID({
    candidates: [
      routeProject?.id,
      storedProjectId,
      preferredProjectToken ? "" : projects[0]?.id,
    ],
    availableIds: projects.map(({ id }) => id),
  });

  const activeProject =
    projects.find(({ id }) => id === selectedProjectId) ??
    (!preferredProjectToken ? projects[0] ?? null : null);

  useEffect(() => {
    if ((!shouldResolveOrg || projectContextQuery.data) && selectedOrgId) {
      const selectedOrganization = organizations.find(({ id }) => id === selectedOrgId);
      if (selectedOrganization) {
        storeSelectedOrganizationContext({
          organizationId: selectedOrganization.id,
          publicId: selectedOrganization.publicId,
        });
      } else {
        storeSelectedOrganizationID(selectedOrgId);
      }
    }
  }, [organizations, shouldResolveOrg, projectContextQuery.data, selectedOrgId]);

  const links = useMemo(() => {
    const project = activeProject?.slug;

    return {
      dashboard: buildScopedHref("/monitoring", { project }),
      prompts: buildScopedHref("/prompts", { project, tab: "prompts" }),
      responses: buildScopedHref("/prompts", { project, tab: "responses" }),
      // pages: buildScopedHref("/pages", { project }),
      perception: buildScopedHref("/perception", { project }),
      traffic: buildScopedHref("/traffic", { project }),
      models: buildScopedHref("/models", { project }),
      brands: buildScopedHref("/brands", { project }),
      contentOptimizer: buildScopedHref("/content-optimizer", { project }),
      errorHub: buildScopedHref("/error-hub", { project }),
      organizations: buildScopedHref("/organizations", { project }),
      account: buildScopedHref("/account", { project }),
      addProject: buildCreateProjectOnboardingHref(),
    };
  }, [activeProject]);

  const isActiveHref = (href: string) => {
    const [path, search = ""] = href.split("?");
    if (currentPath !== path) return false;
    if (path !== "/prompts") return true;

    return (
      (readRouteQueryParam(location.search, "tab") || "prompts") ===
      (new URLSearchParams(search).get("tab") || "prompts")
    );
  };

  const item = (
    href: string,
    label: string,
    onClick?: () => void,
    active = isActiveHref(href),
  ): NavItem => ({
    href,
    label,
    active,
    onClick,
    onPreload: () => preloadRouteFromHref(href),
  });

  const startCreateProjectOnboarding = () => {
    prepareCreateProjectOnboardingContext(selectedOrgId);
  };

  const selectProject = (projectId: string) => {
    const project = projects.find(({ id }) => id === projectId);

    setStored({
      organizationId: project?.organizationId ?? selectedOrgId,
      projectId,
    });

    storeSelectedProjectContext({
      organizationId: project?.organizationId,
      organizationPublicId: activeOrg?.publicId || project?.organizationId,
      projectId,
    });

    navigate(
      buildScopedHref(location.pathname, {
        project: project?.slug,
        createProject: null,
      }),
    );
  };

  const activeSection =
    readRouteQueryParam(location.search, "section") ||
    DEFAULT_ORGANIZATION_VIEW_TAB;

  const organizationLinks = Object.fromEntries(
    ORGANIZATION_VIEW_TABS.map(({ value }) => [
      value,
      buildScopedHref("/organizations", {
        project: activeProject?.slug,
        section: value === DEFAULT_ORGANIZATION_VIEW_TAB ? null : value,
      }),
    ]),
  ) as Record<(typeof ORGANIZATION_VIEW_TABS)[number]["value"], string>;

  const canManageOrg = canManageOrganizationPages([
    activeOrg?.role ?? "member",
  ]);

  const orgTabs = getOrganizationViewTabsForRoles([
    activeOrg?.role ?? "member",
  ]);

  const mainSections = [
    {
      title: content.monitoring,
      indent: true,
      items: [
        item(links.dashboard, content.dashboard),
        item(links.prompts, content.prompts),
        item(links.responses, content.responses),
        // item(links.pages, content.pages),
      ],
    },
    {
      items: [item(links.perception, content.perception)],
    },
    {
      title: content.optimizeActions,
      indent: true,
      items: [
        item(links.contentOptimizer, content.contentOptimizer),
        item(links.errorHub, content.errorHub),
      ],
    },
    {
      items: [item(links.traffic, content.traffic)],
    },
    {
      title: content.projectSettings,
      indent: true,
      items: [
        item(links.brands, content.brands),
        item(links.models, content.models),
      ],
    },
    {
      title: content.settings,
      indent: true,
      items: [
        item(links.organizations, content.organizations, () =>
          setSettingsOpen(true),
        ),
        item(links.account, content.account, () => setSettingsOpen(true)),
      ],
    },
  ];

  const settingsSections = [
    {
      title: content.organizations,
      items: orgTabs
        .filter(({ value }) => value !== "apiKeys")
        .map(({ value, label }) =>
          item(
            organizationLinks[value],
            content[
              `organizationTab${value[0]?.toUpperCase()}${value.slice(1)}`
            ] || label,
            undefined,
            currentPath === "/organizations" && activeSection === value,
          ),
        ),
    },
    {
      title: content.account,
      items: [
        item(links.account, content.account, undefined, currentPath === "/account"),
      ],
    },
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "sticky top-0 flex h-screen flex-col border-r border-border bg-primary transition-[width,min-width] duration-200 ease-in-out",
          collapsed ? "w-[60px] min-w-[60px]" : "w-[220px] min-w-[220px]",
          className,
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className={cn(
              "flex h-14 shrink-0 items-center border-b border-border/40 px-3",
              collapsed ? "justify-center" : "justify-between",
            )}
          >
            {/* <div className="flex h-8 w-8">
              <img src="/logo_icon_white.svg" alt="Logo" />
            </div> */}

            {!collapsed && (
              <span className="ml-2 truncate text-sm font-semibold text-background">
                <img src="/logo_white.svg" alt="Logo" className="h-10" />
              </span>
            )}
          </div>

          <div className="shrink-0 border-b border-border/40 px-3 py-4">
            <SidebarOrganizationSwitcher
              collapsed={collapsed}
              projects={projects}
              activeProjectId={activeProject?.id ?? ""}
              onSelectProject={selectProject}
              addProjectHref={links.addProject}
              onAddProject={startCreateProjectOnboarding}
              canAddProject={canManageOrg}
              orgOpen={orgOpen}
              setOrgOpen={setOrgOpen}
            />
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-6">
            {showSettings ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-background transition-colors hover:bg-background/90 hover:text-primary",
                    collapsed && "justify-center",
                  )}
                  aria-label={content.back}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {!collapsed && <span>{content.back}</span>}
                </button>

                {settingsSections.map((section) => (
                  <NavSection key={section.title} {...section} collapsed={collapsed} indent />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {mainSections.map((section, index) => (
                  <NavSection
                    key={section.title ?? index}
                    {...section}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            )}
          </nav>
        </div>

        <div className="shrink-0 border-t border-background/40 p-2">
          <SidebarPromptPlanProgress
            apiBaseURL={apiBaseURL}
            organizationId={selectedOrgRef}
            projectId={selectedProjectId}
            collapsed={collapsed}
          />

          <div className="mb-1">
            <SidebarLanguageSwitcher collapsed={collapsed} />
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={onLogout}
            disabled={busy}
            className={cn(
              "w-full rounded-md bg-background/10 px-2 py-1.5 text-sm text-background/80 hover:bg-background/20 hover:text-background",
              collapsed ? "justify-center" : "justify-between",
            )}
          >
            <span className={cn("flex items-center gap-2", collapsed && "justify-center")}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>{content.logout}</span>}
            </span>
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

export const Sidebar = memo(SidebarComponent);
Sidebar.displayName = "Sidebar";
