import { KpiCard } from "@/components/shared/kpi-card";
import { formatLabel } from "../../_lib/shared/formatters";
import type { OrganizationResources, OrganizationSummary } from "../../_lib/shared/types";

export function OrganizationSummaryPanel({
  organization,
  resources,
}: {
  organization: OrganizationSummary;
  resources: OrganizationResources;
}) {
  return (
    <div className="hidden md:grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Organisation"
        value={organization.name}
        sub={`Role ${formatLabel(organization.role)}`}
        trend="Active"
        trendDir="stable"
        variant="active"
      />
      <KpiCard
        title="Projets"
        value={String(resources.projects.length)}
        sub="Scopes actifs dans cette organisation."
        trend={`${resources.members.length} membres`}
        trendDir="stable"
      />
      <KpiCard
        title="Membres"
        value={String(resources.members.length)}
        sub="Membres rattaches a cette organisation."
        trend="Roles libres"
        trendDir="stable"
      />
      <KpiCard
        title="Invitations"
        value={String(resources.invitations.filter((item) => item.status === "pending").length)}
        sub="Invitations en attente de reponse."
        trend={`${resources.invitations.length} total`}
        trendDir="stable"
      />
    </div>
  );
}
