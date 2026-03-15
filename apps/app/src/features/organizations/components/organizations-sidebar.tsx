"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrganizationItem } from "./organization-item";
import type { OrganizationSummary } from "./types";

export function OrganizationsSidebar({
  search,
  onSearchChange,
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
  return (
    <Card className="h-full min-h-0 overflow-hidden border-0 shadow-none lg:w-[340px] lg:shrink-0">
      <CardHeader className="space-y-4 px-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Your Organizations</CardTitle>
            <CardDescription>Pick one tenant to manage brands, projects, members and settings.</CardDescription>
          </div>
          <Button size="sm" onClick={onToggleCreateProjectForm} disabled={!selectedOrganizationId}>
            New project
          </Button>
        </div>
        <Input placeholder="Search organization..." value={search} onChange={(event) => onSearchChange(event.target.value)} />
      </CardHeader>

      <CardContent className="space-y-3 overflow-y-auto px-2">
        {showCreateProjectForm ? (
          <div className="space-y-3 rounded-md border p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Create project</p>
              <p className="text-xs text-muted-foreground">
                {selectedOrganization
                  ? `This project will be created inside ${selectedOrganization.name}.`
                  : "Select an organization before creating a project."}
              </p>
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Project name"
                value={draftProjectName}
                onChange={(event) => onDraftProjectNameChange(event.target.value)}
              />
              <Input
                placeholder="https://your-website.com"
                value={draftProjectWebsiteURL}
                onChange={(event) => onDraftProjectWebsiteURLChange(event.target.value)}
              />
              <Input
                placeholder="domain.com"
                value={draftProjectDomain}
                onChange={(event) => onDraftProjectDomainChange(event.target.value)}
              />
              <Input
                placeholder="Brand name"
                value={draftProjectBrandName}
                onChange={(event) => onDraftProjectBrandNameChange(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={onCreateProject} disabled={isCreatingProject || !selectedOrganizationId}>
                {isCreatingProject ? "Creating..." : "Create project"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelCreateProject}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {organizations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No organization found.</p>
        ) : (
          <div className="space-y-2">
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
        )}
      </CardContent>
    </Card>
  );
}
