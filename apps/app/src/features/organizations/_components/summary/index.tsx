import { KpiCard } from "@/components/shared/kpi-card";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { formatLabel } from "../../_lib/shared/formatters";
import type { OrganizationResources, OrganizationSummary } from "../../_lib/shared/types";

export function OrganizationSummaryPanel({
  organization,
  resources,
}: {
  organization: OrganizationSummary;
  resources: OrganizationResources;
}) {
  const { t } = useScopedI18n("organizations");

  return (
    <div className="hidden md:grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title={t("summaryOrganizationTitle")}
        value={organization.name}
        sub={t("summaryRole", { role: formatLabel(organization.role) })}
        trend={t("summaryActive")}
        trendDir="stable"
        variant="active"
      />
      <KpiCard
        title={t("summaryProjectsTitle")}
        value={String(resources.projects.length)}
        sub={t("summaryProjectsSub")}
        trend={t("summaryMembersTrend", { count: resources.members.length })}
        trendDir="stable"
      />
      <KpiCard
        title={t("summaryMembersTitle")}
        value={String(resources.members.length)}
        sub={t("summaryMembersSub")}
        trend={t("summaryOpenRoles")}
        trendDir="stable"
      />
      <KpiCard
        title={t("summaryInvitationsTitle")}
        value={String(resources.invitations.filter((item) => item.status === "pending").length)}
        sub={t("summaryInvitationsSub")}
        trend={t("summaryTotalInvitations", { count: resources.invitations.length })}
        trendDir="stable"
      />
    </div>
  );
}
