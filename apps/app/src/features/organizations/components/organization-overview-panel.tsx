"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MonitoringSectionTitle } from "@/features/monitoring/_components/shared/monitoring-section-title";
import type { OrganizationHierarchy } from "@/shared/models";
import { formatDateTime } from "@/shared/utils";
import type { OrganizationBrandGroup } from "../lib/hierarchy";
import type { OrganizationRole, OrganizationSummary } from "./types";

function formatLabel(value: string): string {
  const normalized = value.trim().replace(/[_-]+/g, " ");
  if (normalized === "") return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getRoleBadgeVariant(role: OrganizationRole | undefined): "default" | "secondary" | "outline" {
  if (role === "owner") return "default";
  if (role === "admin") return "secondary";
  return "outline";
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-10 text-center">
      <div className="flex max-w-md flex-col gap-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card className="border border-border/60">
        <CardHeader className="gap-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </CardContent>
      </Card>
      <Card className="border border-border/60">
        <CardHeader className="gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
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
    return (
      <EmptyState
        title="Aucune organisation sélectionnée"
        description="Choisissez une organisation pour afficher ses projets et sa structure."
      />
    );
  }

  if (loading && !hierarchy) {
    return <LoadingState />;
  }

  if (!selectedOrganization) {
    return (
      <EmptyState
        title="Organisation indisponible"
        description="L’organisation sélectionnée n’est plus disponible."
      />
    );
  }

  const projects = hierarchy?.projects ?? [];

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card className="border border-border/60">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">
                <MonitoringSectionTitle>Résumé rapide</MonitoringSectionTitle>
              </CardTitle>
              <CardDescription className="mt-2 leading-6">
                Les informations essentielles de l’organisation sur un seul écran, sans surcharger la lecture.
              </CardDescription>
            </div>
            <Button size="sm" onClick={onOpenCreateProject}>
              Créer un projet
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Organisation</div>
            <div className="mt-2 text-sm font-medium">{hierarchy?.organization.name || selectedOrganization.name}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Rôle</div>
            <div className="mt-2">
              <Badge variant={getRoleBadgeVariant(selectedOrganization.role)}>{formatLabel(selectedOrganization.role)}</Badge>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Structure</div>
            <div className="mt-2 text-sm font-medium">
              {projects.length} projet{projects.length > 1 ? "s" : ""} · {brandsCount} marque{brandsCount > 1 ? "s" : ""}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/60">
        <CardHeader className="gap-2">
          <CardTitle className="text-base">
            <MonitoringSectionTitle>Projets</MonitoringSectionTitle>
          </CardTitle>
          <CardDescription>Liste courte des projets regroupés par marque.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {projects.length === 0 ? (
            <EmptyState
              title="Aucun projet"
              description="Créez un premier projet pour voir apparaître la structure de l’organisation."
              action={
                <Button size="sm" onClick={onOpenCreateProject}>
                  Créer le premier projet
                </Button>
              }
            />
          ) : (
            brandGroups.map((group) => (
              <div key={group.key} className="rounded-xl border border-border/60 bg-muted/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{group.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {group.description || (group.isUnassigned ? "Projets sans marque associée." : "Aucune description pour cette marque.")}
                    </div>
                  </div>
                  <Badge variant={group.isUnassigned ? "secondary" : "outline"}>
                    {group.projects.length} projet{group.projects.length > 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  {group.projects.map((project) => (
                    <div
                      key={project.id}
                      className="rounded-lg border border-border/60 bg-background px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{project.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Créé le {formatDateTime(project.createdAt)}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{formatLabel(project.status)}</Badge>
                          {project.attributionSource ? (
                            <Badge variant="secondary">{formatLabel(project.attributionSource)}</Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
