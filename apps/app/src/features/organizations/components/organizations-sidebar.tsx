"use client";

import { Building2, FolderPlus, Search, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OrganizationItem } from "./organization-item";
import type { OrganizationSummary } from "./types";

function buildInitials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "OR";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function OrganizationsSidebar({
  search,
  onSearchChange,
  organizationsCount,
  selectedOrganization,
  showCreateProjectForm,
  onToggleCreateProjectForm,
  draftProjectName,
  onDraftProjectNameChange,
  draftProjectWebsiteURL,
  onDraftProjectWebsiteURLChange,
  draftProjectDomain,
  onDraftProjectDomainChange,
  draftProjectBrandName,
  onDraftProjectBrandNameChange,
  isCreatingProject,
  onCreateProject,
  onCancelCreateProject,
  organizations,
  selectedOrganizationId,
  onSelectOrganization,
  getSimulatedPlanLabel,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  organizationsCount: number;
  selectedOrganization: OrganizationSummary | null;
  showCreateProjectForm: boolean;
  onToggleCreateProjectForm: () => void;
  draftProjectName: string;
  onDraftProjectNameChange: (value: string) => void;
  draftProjectWebsiteURL: string;
  onDraftProjectWebsiteURLChange: (value: string) => void;
  draftProjectDomain: string;
  onDraftProjectDomainChange: (value: string) => void;
  draftProjectBrandName: string;
  onDraftProjectBrandNameChange: (value: string) => void;
  isCreatingProject: boolean;
  onCreateProject: () => void;
  onCancelCreateProject: () => void;
  organizations: OrganizationSummary[];
  selectedOrganizationId: string;
  onSelectOrganization: (organizationId: string) => void;
  getSimulatedPlanLabel: (organizationId: string) => string | null;
}) {
  const selectedOrganizationName = selectedOrganization?.name ?? "Organization workspace";

  return (
    <Card className="min-h-0 border border-border/60 bg-card/90 lg:w-[360px] lg:shrink-0">
      <CardHeader className="gap-4 border-b border-border/60">
        <div className="flex items-start gap-3">
          <Avatar size="lg" className="border border-border/60 bg-primary/5">
            <AvatarFallback>{buildInitials(selectedOrganizationName)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Organisations</CardTitle>
              <Badge variant="secondary">{organizationsCount} orgs</Badge>
              {selectedOrganization ? <Badge variant="outline">{selectedOrganization.role}</Badge> : null}
            </div>
            <CardDescription>
              Une liste simple pour changer d’organisation et créer un projet rapidement.
            </CardDescription>
          </div>
        </div>

        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Rechercher une organisation"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={showCreateProjectForm ? "secondary" : "default"} onClick={onToggleCreateProjectForm} disabled={!selectedOrganizationId}>
            <FolderPlus data-icon="inline-start" />
            {showCreateProjectForm ? "Formulaire ouvert" : "Nouveau projet"}
          </Button>
          {selectedOrganization ? (
            <Badge variant="outline" className="max-w-full">
              Active : <span className="truncate font-medium">{selectedOrganization.name}</span>
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        {showCreateProjectForm ? (
          <Card size="sm" className="border border-primary/15 bg-primary/5">
            <CardHeader className="gap-3">
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-primary ring-1 ring-border/60">
                  <Sparkles aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1">
                  <CardTitle>Créer un projet</CardTitle>
                  <CardDescription className="text-xs leading-5">
                    Le formulaire reste volontairement court pour garder la page légère.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                {selectedOrganization
                  ? `Le projet sera créé dans ${selectedOrganization.name}.`
                  : "Sélectionnez une organisation avant de créer un projet."}
              </p>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="project-name">Nom du projet</FieldLabel>
                  <Input
                    id="project-name"
                    placeholder="Nom du projet"
                    value={draftProjectName}
                    onChange={(event) => onDraftProjectNameChange(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-website-url">URL du site</FieldLabel>
                  <Input
                    id="project-website-url"
                    placeholder="https://your-website.com"
                    value={draftProjectWebsiteURL}
                    onChange={(event) => onDraftProjectWebsiteURLChange(event.target.value)}
                  />
                  <FieldDescription>Le domaine est prérempli automatiquement quand c’est possible.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-domain">Domaine</FieldLabel>
                  <Input
                    id="project-domain"
                    placeholder="domain.com"
                    value={draftProjectDomain}
                    onChange={(event) => onDraftProjectDomainChange(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-brand-name">Nom de marque</FieldLabel>
                  <Input
                    id="project-brand-name"
                    placeholder="Nom de marque"
                    value={draftProjectBrandName}
                    onChange={(event) => onDraftProjectBrandNameChange(event.target.value)}
                  />
                </Field>
              </FieldGroup>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={onCreateProject} disabled={isCreatingProject || !selectedOrganizationId}>
                  <FolderPlus data-icon="inline-start" />
                  {isCreatingProject ? "Création..." : "Créer le projet"}
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelCreateProject}>
                  Annuler
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Building2 aria-hidden="true" className="size-4" />
            <span>Organisations</span>
          </div>
          <span>{organizations.length} affichée(s)</span>
        </div>

        {organizations.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
            <div className="flex max-w-xs flex-col gap-2">
              <p className="text-sm font-medium">Aucune organisation trouvée.</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Essayez une autre recherche pour retrouver une organisation.
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1 pr-3">
            <div className="flex flex-col gap-2">
              {organizations.map((organization) => (
                <OrganizationItem
                  key={organization.id}
                  organization={organization}
                  isActive={selectedOrganizationId === organization.id}
                  simulatedPlan={getSimulatedPlanLabel(organization.id)}
                  onSelect={onSelectOrganization}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
