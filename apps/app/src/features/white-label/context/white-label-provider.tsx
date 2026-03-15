"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

import { appQueryKeys } from "@/lib/query-keys";
import { buildDefaultWhiteLabelSettings, loadProjectDetailsRecord, type ProjectDetailsRecord, type ProjectWhiteLabelSettings } from "@/lib/project-details";
import { readOrganizationIdFromSearch, readProjectIdFromSearch, readSelectedOrganizationID, readSelectedProjectID } from "@/shared/selection";
import {
  resolveWhiteLabelCssVariables,
  resolveWhiteLabelFavicon,
  resolveWhiteLabelTitle,
} from "../lib/theme-tokens";

type WhiteLabelContextValue = {
  organizationId: string;
  projectId: string;
  project: ProjectDetailsRecord | null;
  theme: ProjectWhiteLabelSettings;
  isLoading: boolean;
  resolvedSource: "preview" | "domain" | "project" | "fallback";
  setPreviewTheme: (value: ProjectWhiteLabelSettings) => void;
  clearPreviewTheme: () => void;
};

const WhiteLabelContext = createContext<WhiteLabelContextValue | null>(null);

type WhiteLabelProviderProps = {
  apiBaseURL: string;
  children: ReactNode;
};

function resolveActiveScope(search: string) {
  return {
    organizationId: readOrganizationIdFromSearch(search) || readSelectedOrganizationID(),
    projectId: readProjectIdFromSearch(search) || readSelectedProjectID(),
  };
}

function applyThemeToDocument(theme: ProjectWhiteLabelSettings) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const variables = resolveWhiteLabelCssVariables(theme);
  Object.entries(variables).forEach(([key, value]) => {
    if (value.trim() === "") {
      root.style.removeProperty(key);
      return;
    }
    root.style.setProperty(key, value);
  });

  document.title = resolveWhiteLabelTitle(theme);

  const faviconHref = resolveWhiteLabelFavicon(theme);
  let favicon = document.querySelector<HTMLLinkElement>('link[data-white-label-favicon="true"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.setAttribute("data-white-label-favicon", "true");
    document.head.appendChild(favicon);
  }
  favicon.href = faviconHref;
}

export function WhiteLabelProvider({ apiBaseURL, children }: WhiteLabelProviderProps) {
  const location = useLocation();
  const [{ organizationId, projectId }, setScope] = useState(() => resolveActiveScope(location.search));
  const [previewTheme, setPreviewThemeState] = useState<ProjectWhiteLabelSettings | null>(null);
  const fallbackTheme = useMemo(() => buildDefaultWhiteLabelSettings(), []);

  useEffect(() => {
    setScope(resolveActiveScope(location.search));
  }, [location.search]);

  useEffect(() => {
    setPreviewThemeState(null);
  }, [projectId]);

  const projectQuery = useQuery({
    queryKey: appQueryKeys.projectDetails(apiBaseURL, organizationId, projectId),
    enabled: apiBaseURL.trim() !== "" && organizationId !== "" && projectId !== "",
    queryFn: ({ signal }) => loadProjectDetailsRecord(apiBaseURL, organizationId, projectId, signal),
  });

  const project = projectQuery.data ?? null;
  const projectTheme = project?.whiteLabel ?? buildDefaultWhiteLabelSettings(project ?? undefined);
  const theme = previewTheme ?? projectTheme ?? fallbackTheme;

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const host = typeof window === "undefined" ? "" : window.location.host.trim().toLowerCase();
  const resolvedSource = useMemo<WhiteLabelContextValue["resolvedSource"]>(() => {
    if (previewTheme) return "preview";
    if (!project) return "fallback";
    const customDomain = projectTheme.branding.customDomain.trim().toLowerCase();
    if (customDomain !== "" && customDomain === host) return "domain";
    return "project";
  }, [host, previewTheme, project, projectTheme.branding.customDomain]);

  const value = useMemo<WhiteLabelContextValue>(
    () => ({
      organizationId,
      projectId,
      project,
      theme,
      isLoading: projectQuery.isLoading,
      resolvedSource,
      setPreviewTheme: (nextTheme) => {
        startTransition(() => {
          setPreviewThemeState(nextTheme);
        });
      },
      clearPreviewTheme: () => {
        startTransition(() => {
          setPreviewThemeState(null);
        });
      },
    }),
    [organizationId, projectId, project, projectQuery.isLoading, resolvedSource, theme],
  );

  return <WhiteLabelContext.Provider value={value}>{children}</WhiteLabelContext.Provider>;
}

export function useWhiteLabel(): WhiteLabelContextValue {
  const value = useContext(WhiteLabelContext);
  if (!value) {
    throw new Error("useWhiteLabel must be used within WhiteLabelProvider.");
  }
  return value;
}
