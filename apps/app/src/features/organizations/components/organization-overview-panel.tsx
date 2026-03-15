"use client";

import { Building2, FolderKanban, Layers3, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrganizationHierarchy } from "@/shared/models";
import { formatDateTime } from "@/shared/utils";
import type { OrganizationBrandGroup } from "../lib/hierarchy";
import type { OrganizationRole, OrganizationSummary } from "./types";

function formatLabel(value: string): string {
  const normalized = value.trim().replace(/[_-]+/g, " ");
  if (normalized === "") return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getStatusClassName(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (normalized === "paused") return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  if (normalized === "draft") return "border-slate-500/30 bg-slate-500/10 text-slate-700";
  return "border-border bg-muted text-foreground";
}

function getRoleClassName(role: OrganizationRole | undefined): string {
  if (role === "owner") return "border-primary/30 bg-primary/10 text-primary";
  if (role === "admin") return "border-sky-500/30 bg-sky-500/10 text-sky-700";
  return "border-border bg-muted text-foreground";
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Building2;
}) {
  return (
    <Card size="sm" className="border">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="mt-1 text-2xl">{value}</CardTitle>
          </div>
          <div className="rounded-full border bg-muted/60 p-2 text-muted-foreground">
            <Icon className="size-4" aria-hidden="true" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2 text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}

export function OrganizationOverviewPanel({
  selectedOrganizationId,
  selectedOrganization,
  hierarchy,
  brandGroups,
  brandsCount,
  onOpenCreateProject,
  loading,
}: {
  selectedOrganizationId: string;
  selectedOrganization: OrganizationSummary | null;
  hierarchy: OrganizationHierarchy | null;
  brandGroups: OrganizationBrandGroup[];
  brandsCount: number;
  onOpenCreateProject: () => void;
  loading: boolean;
}) {
  if (!selectedOrganizationId) {
    return <p className="text-sm text-muted-foreground">No organization selected.</p>;
  }

  if (loading && !hierarchy) {
    return <p className="text-sm text-muted-foreground">Loading organization hierarchy...</p>;
  }

  if (!selectedOrganization) {
    return <p className="text-sm text-muted-foreground">The selected organization is no longer available.</p>;
  }

  const projects = hierarchy?.projects ?? [];
  const organizationName = hierarchy?.organization.name || selectedOrganization.name;

  return (
    <div className="space-y-4 pb-1">
      <Card className="border">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{organizationName}</CardTitle>
                <Badge variant="outline" className={getRoleClassName(selectedOrganization.role)}>
                  {formatLabel(selectedOrganization.role)}
                </Badge>
                <Badge variant="outline">Tenant scope: org</Badge>
              </div>
              <CardDescription className="max-w-3xl">
                Billing and data isolation happen at the organization level. Projects remain the work units and are grouped by
                brand inside this tenant.
              </CardDescription>
            </div>
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Organization ID: <span className="font-medium text-foreground">{selectedOrganization.id}</span>
            </div>
          </div>
          <div className="flex justify-start">
            <Button size="sm" onClick={onOpenCreateProject}>
              Add project
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tenant"
          value={selectedOrganization.name}
          hint="Org is the billing and security boundary."
          icon={Building2}
        />
        <StatCard
          label="Your role"
          value={formatLabel(selectedOrganization.role)}
          hint="Roles can differ from one organization to another."
          icon={ShieldCheck}
        />
        <StatCard
          label="Projects"
          value={String(projects.length)}
          hint="Projects are the operational units used across the app."
          icon={FolderKanban}
        />
        <StatCard
          label="Brands"
          value={String(brandsCount)}
          hint="Each brand groups one or more projects in the same tenant."
          icon={Layers3}
        />
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle>Brands and projects</CardTitle>
          <CardDescription>
            Members belong to the organization, while project work stays partitioned inside the selected org only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center">
              <p className="text-sm font-medium">No projects found for this organization.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create projects under this org to expose brand, attribution and workspace data here.
              </p>
              <Button size="sm" className="mt-4" onClick={onOpenCreateProject}>
                Create first project
              </Button>
            </div>
          ) : (
            brandGroups.map((group) => (
              <section key={group.key} className="rounded-xl border bg-muted/10 p-4">
                <div className="flex flex-col gap-2 border-b pb-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-medium">{group.name}</h3>
                      <Badge variant={group.isUnassigned ? "secondary" : "outline"}>
                        {group.projects.length} project{group.projects.length > 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {group.description || (group.isUnassigned ? "Projects without an attached brand yet." : "No brand description provided.")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {group.projects.map((project) => (
                    <article key={project.id} className="rounded-xl border bg-background p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground">Project ID: {project.id}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className={getStatusClassName(project.status)}>
                            {formatLabel(project.status)}
                          </Badge>
                          {project.attributionSource ? (
                            <Badge variant="secondary">{formatLabel(project.attributionSource)}</Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em]">Brand</p>
                          <p className="mt-1 text-foreground">{project.brandName || "No brand"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em]">Created</p>
                          <p className="mt-1 text-foreground">{formatDateTime(project.createdAt)}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
