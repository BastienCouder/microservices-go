"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OrganizationItem } from "./organization-item";
import type { OrganizationSummary, SimulatedPlan } from "./types";

export function OrganizationsSidebar({
  search,
  onSearchChange,
  showCreateWizard,
  onToggleCreateWizard,
  draftName,
  onDraftNameChange,
  draftSlug,
  onDraftSlugChange,
  draftPlan,
  onDraftPlanChange,
  isCreatingOrganization,
  onCreate,
  onCancelCreate,
  organizations,
  selectedOrganizationId,
  onSelectOrganization,
  getSimulatedPlanLabel,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  showCreateWizard: boolean;
  onToggleCreateWizard: () => void;
  draftName: string;
  onDraftNameChange: (value: string) => void;
  draftSlug: string;
  onDraftSlugChange: (value: string) => void;
  draftPlan: SimulatedPlan;
  onDraftPlanChange: (value: SimulatedPlan) => void;
  isCreatingOrganization: boolean;
  onCreate: () => void;
  onCancelCreate: () => void;
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
            <CardDescription>Pick one org to manage team and settings.</CardDescription>
          </div>
          <Button size="sm" onClick={onToggleCreateWizard}>
            New
          </Button>
        </div>
        <Input placeholder="Search organization..." value={search} onChange={(event) => onSearchChange(event.target.value)} />
      </CardHeader>

      <CardContent className="space-y-3 overflow-y-auto px-2">
        {showCreateWizard ? (
          <div className="space-y-3 rounded-md border p-4">
            <p className="text-sm font-semibold">New Organization: Billing Simulation First</p>
            <div className="space-y-2">
              <Input
                placeholder="Organization name"
                value={draftName}
                onChange={(event) => onDraftNameChange(event.target.value)}
              />
              <Input
                placeholder="slug-name"
                value={draftSlug}
                onChange={(event) => onDraftSlugChange(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => onDraftPlanChange("free")}
                className={cn("rounded-md border p-3 text-left text-sm", draftPlan === "free" && "border-primary bg-primary/5")}
              >
                Free
              </button>
              <button
                type="button"
                onClick={() => onDraftPlanChange("pro-monthly")}
                className={cn("rounded-md border p-3 text-left text-sm", draftPlan === "pro-monthly" && "border-primary bg-primary/5")}
              >
                Pro Monthly (simulated)
              </button>
              <button
                type="button"
                onClick={() => onDraftPlanChange("pro-yearly")}
                className={cn("rounded-md border p-3 text-left text-sm", draftPlan === "pro-yearly" && "border-primary bg-primary/5")}
              >
                Pro Yearly (simulated)
              </button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={onCreate} disabled={isCreatingOrganization}>
                {isCreatingOrganization ? "Creating..." : "Complete Billing & Create Org"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelCreate}>
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
