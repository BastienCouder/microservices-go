"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { normalizeOrganizationHierarchy } from "@/features/organizations/lib/hierarchy";
import { WhiteLabelWorkspace } from "@/features/settings/components/white-label-workspace";
import { PageHeader } from "@/features/shared/view/page-header";
import { useWhiteLabel } from "@/features/white-label/context/white-label-provider";
import { apiRoutes } from "@/lib/api-config";
import { buildDefaultWhiteLabelSettings, loadProjectDetailsRecord, serializeWhiteLabelSettings } from "@/lib/project-details";
import { appQueryKeys } from "@/lib/query-keys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDateTime } from "@/shared/utils";

type SettingsTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

function formatLabel(value: string): string {
  const normalized = value.trim().replace(/[_-]+/g, " ");
  if (normalized === "") return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

async function loadOrganizationHierarchy(
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
    throw new Error(response.error || "Impossible de charger les projets de l organisation.");
  }

  return normalizeOrganizationHierarchy(response.data, organizationId);
}

export function SettingsTemplate({ apiBaseURL, routeSearch }: SettingsTemplateProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectId: themedProjectId, setPreviewTheme, clearPreviewTheme } = useWhiteLabel();

  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    readOrganizationIdFromSearch(routeSearch) || readSelectedOrganizationID(),
  );
  const [selectedProjectId, setSelectedProjectId] = useState(
    readProjectIdFromSearch(routeSearch) || readSelectedProjectID(),
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [domain, setDomain] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [attributionSource, setAttributionSource] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [whiteLabel, setWhiteLabel] = useState(() => buildDefaultWhiteLabelSettings());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const nextOrganizationId = readOrganizationIdFromSearch(routeSearch) || readSelectedOrganizationID() || "";
    setSelectedOrganizationId((current) => (current === nextOrganizationId ? current : nextOrganizationId));
    if (nextOrganizationId !== "") {
      storeSelectedOrganizationID(nextOrganizationId);
    }
  }, [routeSearch]);

  const hierarchyQuery = useQuery({
    queryKey: appQueryKeys.organizationHierarchy(apiBaseURL, selectedOrganizationId),
    enabled: apiBaseURL.trim() !== "" && selectedOrganizationId !== "",
    queryFn: ({ signal }) => loadOrganizationHierarchy(apiBaseURL, selectedOrganizationId, signal),
  });
  const hierarchy = hierarchyQuery.data ?? null;

  useEffect(() => {
    const routeProjectId = readProjectIdFromSearch(routeSearch);
    const storedProjectId = readSelectedProjectID();
    const projects = hierarchy?.projects ?? [];
    const availableProjectIds = new Set(projects.map((project) => project.id));

    const nextProjectId =
      (routeProjectId && availableProjectIds.has(routeProjectId) ? routeProjectId : "") ||
      (selectedProjectId && availableProjectIds.has(selectedProjectId) ? selectedProjectId : "") ||
      (storedProjectId && availableProjectIds.has(storedProjectId) ? storedProjectId : "") ||
      projects[0]?.id ||
      "";

    setSelectedProjectId((current) => (current === nextProjectId ? current : nextProjectId));
    storeSelectedProjectID(nextProjectId);
  }, [hierarchy?.projects, routeSearch, selectedProjectId]);

  const projectQuery = useQuery({
    queryKey: appQueryKeys.projectDetails(apiBaseURL, selectedOrganizationId, selectedProjectId),
    enabled: apiBaseURL.trim() !== "" && selectedOrganizationId !== "" && selectedProjectId !== "",
    queryFn: ({ signal }) => loadProjectDetailsRecord(apiBaseURL, selectedOrganizationId, selectedProjectId, signal),
  });
  const project = projectQuery.data ?? null;

  useEffect(() => {
    if (!project) {
      return;
    }

    setName(project.name);
    setBrandName(project.brandName);
    setDomain(project.domain);
    setWebsiteUrl(project.websiteUrl);
    setIndustry(project.industry);
    setAttributionSource(project.attributionSource);
    setBrandDescription(project.brandDescription);
    setWhiteLabel(project.whiteLabel);
  }, [project]);

  useEffect(() => {
    if (!project || project.id !== themedProjectId) {
      return;
    }

    setPreviewTheme(whiteLabel);
    return () => {
      clearPreviewTheme();
    };
  }, [clearPreviewTheme, project, setPreviewTheme, themedProjectId, whiteLabel]);

  useEffect(() => {
    if (hierarchyQuery.error instanceof Error) {
      setError(hierarchyQuery.error.message);
      return;
    }
    if (projectQuery.error instanceof Error) {
      setError(projectQuery.error.message);
      return;
    }
    setError(null);
  }, [hierarchyQuery.error, projectQuery.error]);

  const isDirty = useMemo(() => {
    if (!project) return false;
    return (
      name.trim() !== project.name ||
      brandName.trim() !== project.brandName ||
      domain.trim() !== project.domain ||
      websiteUrl.trim() !== project.websiteUrl ||
      industry.trim() !== project.industry ||
      attributionSource.trim() !== project.attributionSource ||
      brandDescription.trim() !== project.brandDescription ||
      serializeWhiteLabelSettings(whiteLabel) !== serializeWhiteLabelSettings(project.whiteLabel)
    );
  }, [attributionSource, brandDescription, brandName, domain, industry, name, project, websiteUrl, whiteLabel]);

  const handleSave = async () => {
    if (!project || selectedOrganizationId === "") return;

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.get(encodeURIComponent(project.id)), {
        method: "PATCH",
        organizationId: selectedOrganizationId,
        body: JSON.stringify({
          name,
          brandName,
          domain,
          websiteUrl,
          industry,
          attributionSource,
          brandDescription,
          whiteLabel,
        }),
      });

      if (!response.ok) {
        throw new Error(response.error || "Impossible de sauvegarder ce projet.");
      }

      setMessage("Project settings saved.");
      await queryClient.invalidateQueries({
        queryKey: appQueryKeys.projectDetails(apiBaseURL, selectedOrganizationId, project.id),
      });
      await queryClient.invalidateQueries({
        queryKey: appQueryKeys.organizationHierarchy(apiBaseURL, selectedOrganizationId),
      });
      await queryClient.invalidateQueries({
        queryKey: appQueryKeys.organizationResources(apiBaseURL, selectedOrganizationId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de sauvegarder ce projet.");
    } finally {
      setIsSaving(false);
    }
  };

  const openOrganizationsPage = () => {
    navigate(buildScopedHref("/organizations", { org: selectedOrganizationId, projectId: selectedProjectId }));
  };

  const openCreateProject = () => {
    navigate(buildScopedHref("/organizations", { org: selectedOrganizationId, createProject: "1", projectId: selectedProjectId }));
  };

  const activeOrganizationName = hierarchy?.organization.name || "Organization";
  const meta = project ? (
    <>
      <Badge variant="outline">{formatLabel(project.status)}</Badge>
      <Badge variant="outline">{activeOrganizationName}</Badge>
    </>
  ) : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title={project?.name || "Project settings"}
        baseline="Edit the operational project, not the organization shell."
        meta={meta}
        actions={
          <>
            <Button type="button" variant="outline" onClick={openOrganizationsPage}>
              Open organization
            </Button>
            <Button type="button" onClick={openCreateProject}>
              Add project
            </Button>
          </>
        }
        actionsVariant="classic"
      />

      {error ? (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {message ? (
        <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_340px]">
        <div className="min-h-0 space-y-4">
          <Card className="min-h-0 border">
            <CardHeader>
              <CardTitle>Project configuration</CardTitle>
              <CardDescription>
                Update the name, routing and brand context used across monitoring, prompts and perception.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedOrganizationId ? (
                <p className="text-sm text-muted-foreground">
                  Select an organization first to load project settings.
                </p>
              ) : hierarchyQuery.isLoading && !hierarchy ? (
                <p className="text-sm text-muted-foreground">Loading organization projects...</p>
              ) : !selectedProjectId ? (
                <div className="rounded-xl border border-dashed px-4 py-8 text-center">
                  <p className="text-sm font-medium">No project selected.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This organization has no project yet, or none is currently selected.
                  </p>
                  <Button className="mt-4" onClick={openCreateProject}>
                    Create project
                  </Button>
                </div>
              ) : projectQuery.isLoading && !project ? (
                <p className="text-sm text-muted-foreground">Loading project settings...</p>
              ) : !project ? (
                <p className="text-sm text-muted-foreground">Project not found for the current organization.</p>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Project name</label>
                      <Input value={name} onChange={(event) => setName(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Brand name</label>
                      <Input value={brandName} onChange={(event) => setBrandName(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Domain</label>
                      <Input value={domain} onChange={(event) => setDomain(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Website URL</label>
                      <Input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Attribution source</label>
                      <Input value={attributionSource} onChange={(event) => setAttributionSource(event.target.value)} placeholder="ga4, stripe..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Industry</label>
                      <Input value={industry} onChange={(event) => setIndustry(event.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Brand description</label>
                    <Textarea
                      value={brandDescription}
                      onChange={(event) => setBrandDescription(event.target.value)}
                      placeholder="Short positioning summary used by downstream analyses."
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {project ? (
            <WhiteLabelWorkspace
              projectName={name.trim() || project.name}
              value={whiteLabel}
              onChange={setWhiteLabel}
            />
          ) : null}

          {project ? (
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!project) return;
                  setName(project.name);
                  setBrandName(project.brandName);
                  setDomain(project.domain);
                  setWebsiteUrl(project.websiteUrl);
                  setIndustry(project.industry);
                  setAttributionSource(project.attributionSource);
                  setBrandDescription(project.brandDescription);
                  setWhiteLabel(project.whiteLabel);
                }}
                disabled={!isDirty || isSaving}
              >
                Reset
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={!isDirty || isSaving}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          ) : null}
        </div>

        <Card className="border">
          <CardHeader>
            <CardTitle>Project metadata</CardTitle>
            <CardDescription>
              Current selection and lifecycle data for the project shell used throughout the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Organization</p>
              <p className="mt-1 font-medium text-foreground">{activeOrganizationName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Project ID</p>
              <p className="mt-1 font-medium text-foreground">{project?.id || "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</p>
              <p className="mt-1 font-medium text-foreground">{formatLabel(project?.status || "")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Created</p>
              <p className="mt-1 font-medium text-foreground">{formatDateTime(project?.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Updated</p>
              <p className="mt-1 font-medium text-foreground">{formatDateTime(project?.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
