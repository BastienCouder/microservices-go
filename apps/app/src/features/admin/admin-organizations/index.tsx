"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Save, Search, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { appQueryKeys } from "@/lib/query-keys";
import { apiRoutes } from "@/lib/api-config";
import {
  loadOrganizationSummaries,
  type OrganizationMember,
  type OrganizationProject,
  type OrganizationSummary,
} from "@/features/organizations/_lib/shared/organization-page-api";
import {
  normalizeHierarchyProjects,
  normalizeResourcesMembers,
} from "@/features/organizations/_lib/shared/api-normalizers";
import {
  loadBillingEntitlements,
  loadBillingPlanSettings,
  updateBillingSubscription,
  type BillingEntitlements,
  type BillingPlanCode,
} from "@/shared/billing";
import { gatewayJSON } from "@/shared/api/gateway";
import { getBillingPlanLabel } from "@/shared/billing-plan";
import { invalidateQueryKeys } from "@/shared/api/query-refresh";

type AdminOrganizationsPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

type OrganizationQuotaRow = {
  organization: OrganizationSummary;
  entitlements: BillingEntitlements;
  projects: OrganizationProject[];
  members: OrganizationMember[];
};

type Draft = {
  plan: BillingPlanCode;
  monthlyQuota: string;
};

const DEFAULT_ADMIN_PLANS: BillingPlanCode[] = ["starter", "growth", "pro"];
const DEFAULT_PLAN: BillingPlanCode = "starter";
const EMPTY_ROWS: OrganizationQuotaRow[] = [];
const PLAN_FILTER_ALL = "all";

function sortBillingPlans(plans: BillingPlanCode[]) {
  const priority = new Map(DEFAULT_ADMIN_PLANS.map((plan, index) => [plan, index]));
  return Array.from(new Set(plans.filter(Boolean))).sort((left, right) => {
    const leftRank = priority.get(left) ?? 100;
    const rightRank = priority.get(right) ?? 100;
    if (leftRank === rightRank) return left.localeCompare(right);
    return leftRank - rightRank;
  });
}

function canManageUsage(organization: OrganizationSummary) {
  return (
    organization.role === "admin" ||
    organization.role === "owner" ||
    organization.role === "super_admin"
  );
}

function draftFromEntitlements(entitlements: BillingEntitlements): Draft {
  return {
    plan: entitlements.plan ?? DEFAULT_PLAN,
    monthlyQuota: String(Math.max(1, entitlements.monthlyQuota || 1)),
  };
}

function toPositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function seatCountForOrganization(
  organizationId: string,
  rows: OrganizationQuotaRow[],
) {
  return Math.max(
    1,
    rows.find((row) => row.organization.id === organizationId)?.entitlements.seats ?? 1,
  );
}

function normalizeDraft(draft: Draft) {
  return {
    plan: draft.plan,
    monthlyQuota: toPositiveInteger(draft.monthlyQuota, 1),
  };
}

async function loadAdminOrganizationRow(
  apiBaseURL: string,
  organization: OrganizationSummary,
  signal?: AbortSignal,
): Promise<OrganizationQuotaRow> {
  const [entitlements, hierarchyResponse, membersResponse] = await Promise.all([
    loadBillingEntitlements(apiBaseURL, organization.id, { signal }),
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.hierarchy(organization.id), {
      method: "GET",
      organizationId: organization.id,
      signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.members(organization.id), {
      method: "GET",
      organizationId: organization.id,
      signal,
    }),
  ]);

  return {
    organization,
    entitlements,
    projects: hierarchyResponse.ok
      ? normalizeHierarchyProjects(hierarchyResponse.data)
      : [],
    members: membersResponse.ok ? normalizeResourcesMembers(membersResponse.data) : [],
  };
}

export function AdminOrganizationsPage({
  apiBaseURL,
}: AdminOrganizationsPageProps) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>(PLAN_FILTER_ALL);

  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, null),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadOrganizationSummaries(apiBaseURL, signal),
  });

  const manageableOrganizations = useMemo(
    () => (organizationsQuery.data ?? []).filter(canManageUsage),
    [organizationsQuery.data],
  );
  const quotaQueryKey = useMemo(
    () => [
      "admin-organizations-quotas",
      apiBaseURL,
      manageableOrganizations.map((organization) => organization.id).join(","),
    ],
    [apiBaseURL, manageableOrganizations],
  );
  const planOptionsQuery = useQuery({
    queryKey: appQueryKeys.billingPlans(
      apiBaseURL,
      manageableOrganizations[0]?.id ?? "",
    ),
    enabled:
      apiBaseURL.trim() !== "" && (manageableOrganizations[0]?.id ?? "") !== "",
    queryFn: ({ signal }) =>
      loadBillingPlanSettings(apiBaseURL, manageableOrganizations[0]!.id, {
        signal,
      }),
  });

  const quotasQuery = useQuery({
    queryKey: quotaQueryKey,
    enabled: apiBaseURL.trim() !== "" && manageableOrganizations.length > 0,
    queryFn: async ({ signal }) => {
      const rows = await Promise.all(
        manageableOrganizations.map((organization) =>
          loadAdminOrganizationRow(apiBaseURL, organization, signal),
        ),
      );
      return rows;
    },
  });

  const rows = quotasQuery.data ?? EMPTY_ROWS;
  const availablePlans = useMemo(
    () =>
      sortBillingPlans([
        ...DEFAULT_ADMIN_PLANS,
        ...(planOptionsQuery.data ?? []).map((plan) => plan.plan),
        ...rows.map((row) => row.entitlements.plan ?? DEFAULT_PLAN),
      ]),
    [planOptionsQuery.data, rows],
  );
  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter((row) => {
      const plan = row.entitlements.plan ?? DEFAULT_PLAN;
      const matchesPlan = planFilter === PLAN_FILTER_ALL || plan === planFilter;
      const matchesSearch =
        normalizedSearch === "" ||
        row.organization.name.toLowerCase().includes(normalizedSearch) ||
        row.organization.id.includes(normalizedSearch) ||
        row.organization.role.toLowerCase().includes(normalizedSearch) ||
        row.projects.some((project) =>
          project.name.toLowerCase().includes(normalizedSearch),
        ) ||
        row.members.some((member) =>
          [member.email, member.firstName, member.lastName, member.userId]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch),
        );
      return matchesPlan && matchesSearch;
    });
  }, [planFilter, rows, search]);

  useEffect(() => {
    if (rows.length === 0) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const row of rows) {
        if (!next[row.organization.id]) {
          next[row.organization.id] = draftFromEntitlements(row.entitlements);
        }
      }
      return next;
    });
  }, [rows]);

  const updateMutation = useMutation({
    mutationFn: ({
      organizationId,
      draft,
    }: {
      organizationId: string;
      draft: Draft;
    }) =>
      updateBillingSubscription(apiBaseURL, {
        organizationId,
        plan: normalizeDraft(draft).plan,
        monthlyQuota: normalizeDraft(draft).monthlyQuota,
        seats: seatCountForOrganization(organizationId, rows),
      }),
    onMutate: async (variables) => {
      const normalized = normalizeDraft(variables.draft);
      await queryClient.cancelQueries({ queryKey: quotaQueryKey });
      const previousRows =
        queryClient.getQueryData<OrganizationQuotaRow[]>(quotaQueryKey);

      queryClient.setQueryData<OrganizationQuotaRow[]>(
        quotaQueryKey,
        (current) =>
          (current ?? rows).map((row) =>
            row.organization.id === variables.organizationId
              ? {
                  ...row,
                  entitlements: {
                    ...row.entitlements,
                    plan: normalized.plan,
                    monthlyQuota: normalized.monthlyQuota,
                  },
                }
              : row,
          ),
      );
      setDrafts((current) => ({
        ...current,
        [variables.organizationId]: {
          plan: normalized.plan,
          monthlyQuota: String(normalized.monthlyQuota),
        },
      }));

      return { previousRows };
    },
    onSuccess: async (_, variables) => {
      await invalidateQueryKeys(queryClient, [
        appQueryKeys.billingQuota(apiBaseURL, variables.organizationId),
        ["prompt-quota", apiBaseURL, variables.organizationId],
      ]);
      pushSuccessToast("Quota de crédits mis a jour.");
    },
    onError: (error, _variables, context) => {
      if (context?.previousRows) {
        queryClient.setQueryData(quotaQueryKey, context.previousRows);
      }
      pushErrorToast(error, "Impossible de mettre a jour ce quota.");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: quotaQueryKey });
    },
  });

  const updateDraft = (organizationId: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [organizationId]: {
        ...(current[organizationId] ?? {
          plan: DEFAULT_PLAN,
          monthlyQuota: "1",
        }),
        ...patch,
      },
    }));
  };

  const saveQuota = (
    event: FormEvent<HTMLFormElement>,
    row: OrganizationQuotaRow,
  ) => {
    event.preventDefault();
    updateMutation.mutate({
      organizationId: row.organization.id,
      draft: drafts[row.organization.id] ?? draftFromEntitlements(row.entitlements),
    });
  };

  const isLoading = organizationsQuery.isLoading || quotasQuery.isLoading;
  const isFetching = organizationsQuery.isFetching || quotasQuery.isFetching;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden md:p-4">
      <PageHeader
        title="Admin organisations"
        baseline="Gerez les plans et le nombre de crédits mensuels autorises par organisation."
        actionsVariant="classic"
        className="mb-3 md:mb-4"
        meta={
          <>
            <Badge variant="default">
              {manageableOrganizations.length} organisations
            </Badge>
            <Badge variant="outline">Quotas crédits</Badge>
          </>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => void quotasQuery.refetch()}
            disabled={isFetching || manageableOrganizations.length === 0}
            className="h-10 min-w-0 px-3 sm:h-auto sm:min-w-fit sm:px-4.5"
          >
            <RefreshCw data-icon="inline-start" />
            {isFetching ? "Actualisation..." : "Actualiser"}
          </Button>
        }
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-tr-none bg-background md:rounded-md">
        <div className="border-b px-3 pb-3 md:px-4 md:pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4">
            <div className="min-w-0 flex-1">
              <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_180px]">
                <div className="relative min-w-0">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher une organisation"
                    className="h-10 pl-9"
                  />
                </div>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PLAN_FILTER_ALL}>Tous les plans</SelectItem>
                    {availablePlans.map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {getBillingPlanLabel(plan)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b py-2 md:px-4 md:py-3">
          <div className="flex min-h-10 justify-between gap-3 lg:flex-row lg:items-center">
            <div className="flex shrink-0 items-center">
              {isLoading ? (
                <Skeleton className="hidden h-9 w-36 rounded-full md:flex" />
              ) : (
                <Badge
                  variant="outline"
                  className="hidden h-9 w-fit shrink-0 justify-center px-3 text-sm md:inline-flex"
                >
                  {filteredRows.length} orgs affichees
                </Badge>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-1 px-3 text-xs text-muted-foreground md:px-0 lg:text-right">
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                Quotas crédits
              </span>
              <span>Les changements se repercutent sur l'usage de crédits sans refresh.</span>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-4">
          {isLoading ? (
            <AdminOrganizationsLoading />
          ) : manageableOrganizations.length === 0 ? (
            <EmptyState label="Aucune organisation administrable trouvee pour ce compte." />
          ) : rows.length === 0 ? (
            <EmptyState label="Aucun quota charge pour le moment." />
          ) : filteredRows.length === 0 ? (
            <EmptyState label="Aucune organisation ne correspond a ces filtres." />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border border-border/70 md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organisation</TableHead>
                      <TableHead className="min-w-[220px]">Projets</TableHead>
                      <TableHead className="min-w-[240px]">Utilisateurs</TableHead>
                      <TableHead className="w-[180px]">Plan</TableHead>
                      <TableHead className="w-[260px]">Quota crédits</TableHead>
                      <TableHead className="w-[140px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <AdminOrganizationTableRow
                        key={row.organization.id}
                        row={row}
                        draft={
                          drafts[row.organization.id] ??
                          draftFromEntitlements(row.entitlements)
                        }
                        pending={
                          updateMutation.isPending &&
                          updateMutation.variables?.organizationId ===
                            row.organization.id
                        }
                        onUpdateDraft={updateDraft}
                        onSave={saveQuota}
                        planOptions={availablePlans}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 md:hidden">
                {filteredRows.map((row) => (
                  <AdminOrganizationMobileCard
                    key={row.organization.id}
                    row={row}
                    draft={
                      drafts[row.organization.id] ??
                      draftFromEntitlements(row.entitlements)
                    }
                    pending={
                      updateMutation.isPending &&
                      updateMutation.variables?.organizationId ===
                        row.organization.id
                    }
                    onUpdateDraft={updateDraft}
                    onSave={saveQuota}
                    planOptions={availablePlans}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function quotaProgressValue(entitlements: BillingEntitlements) {
  const quota = Math.max(1, entitlements.monthlyQuota || 1);
  return Math.min(100, Math.round((quota / 1000) * 100));
}

function AdminOrganizationTableRow({
  row,
  draft,
  pending,
  onUpdateDraft,
  onSave,
  planOptions,
}: {
  row: OrganizationQuotaRow;
  draft: Draft;
  pending: boolean;
  onUpdateDraft: (organizationId: string, patch: Partial<Draft>) => void;
  onSave: (event: FormEvent<HTMLFormElement>, row: OrganizationQuotaRow) => void;
  planOptions: BillingPlanCode[];
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="min-w-[220px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">
              {row.organization.name}
            </span>
            <Badge variant="outline">{row.organization.role}</Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            ID org {row.organization.id} ·{" "}
            {row.entitlements.subscriptionStatus || "defaut"}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <ProjectsSummary projects={row.projects} />
      </TableCell>
      <TableCell>
        <MembersSummary members={row.members} />
      </TableCell>
      <TableCell>
        <PlanSelect
          value={draft.plan}
          planOptions={planOptions}
          onValueChange={(plan) =>
            onUpdateDraft(row.organization.id, { plan })
          }
        />
      </TableCell>
      <TableCell>
        <QuotaInput
          value={draft.monthlyQuota}
          entitlements={row.entitlements}
          onChange={(monthlyQuota) =>
            onUpdateDraft(row.organization.id, { monthlyQuota })
          }
        />
      </TableCell>
      <TableCell className="text-right">
        <form onSubmit={(event) => onSave(event, row)}>
          <SaveButton pending={pending} />
        </form>
      </TableCell>
    </TableRow>
  );
}

function AdminOrganizationMobileCard({
  row,
  draft,
  pending,
  onUpdateDraft,
  onSave,
  planOptions,
}: {
  row: OrganizationQuotaRow;
  draft: Draft;
  pending: boolean;
  onUpdateDraft: (organizationId: string, patch: Partial<Draft>) => void;
  onSave: (event: FormEvent<HTMLFormElement>, row: OrganizationQuotaRow) => void;
  planOptions: BillingPlanCode[];
}) {
  return (
    <form
      onSubmit={(event) => onSave(event, row)}
      className="rounded-xl border border-border/70 bg-card p-4"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-foreground">{row.organization.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            ID org {row.organization.id}
          </div>
        </div>
        <Badge variant="outline">{row.organization.role}</Badge>
      </div>
      <div className="space-y-3">
        <div className="grid gap-3">
          <MobileSummaryBlock title="Projets">
            <ProjectsSummary projects={row.projects} />
          </MobileSummaryBlock>
          <MobileSummaryBlock title="Utilisateurs">
            <MembersSummary members={row.members} />
          </MobileSummaryBlock>
        </div>
        <PlanSelect
          value={draft.plan}
          planOptions={planOptions}
          onValueChange={(plan) => onUpdateDraft(row.organization.id, { plan })}
        />
        <QuotaInput
          value={draft.monthlyQuota}
          entitlements={row.entitlements}
          onChange={(monthlyQuota) =>
            onUpdateDraft(row.organization.id, { monthlyQuota })
          }
        />
        <SaveButton pending={pending} className="w-full" />
      </div>
    </form>
  );
}

function ProjectsSummary({ projects }: { projects: OrganizationProject[] }) {
  if (projects.length === 0) {
    return <span className="text-sm text-muted-foreground">Aucun projet</span>;
  }

  const visibleProjects = projects.slice(0, 3);
  const remaining = projects.length - visibleProjects.length;

  return (
    <div className="flex max-w-[320px] flex-wrap gap-1.5">
      {visibleProjects.map((project) => (
        <Badge key={project.id} variant="secondary" className="max-w-[160px] truncate">
          {project.name}
        </Badge>
      ))}
      {remaining > 0 ? (
        <Badge variant="outline">+{remaining}</Badge>
      ) : null}
    </div>
  );
}

function MembersSummary({ members }: { members: OrganizationMember[] }) {
  if (members.length === 0) {
    return <span className="text-sm text-muted-foreground">Aucun utilisateur</span>;
  }

  const visibleMembers = members.slice(0, 3);
  const remaining = members.length - visibleMembers.length;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {visibleMembers.map((member) => (
          <Badge
            key={member.userId}
            variant="outline"
            className="max-w-[190px] truncate"
          >
            {member.email || `User ${member.userId}`}
          </Badge>
        ))}
        {remaining > 0 ? <Badge variant="outline">+{remaining}</Badge> : null}
      </div>
      <div className="text-xs text-muted-foreground">
        {members.length} utilisateur{members.length > 1 ? "s" : ""}
      </div>
    </div>
  );
}

function MobileSummaryBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/60 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function PlanSelect({
  value,
  planOptions,
  onValueChange,
}: {
  value: BillingPlanCode;
  planOptions: BillingPlanCode[];
  onValueChange: (plan: BillingPlanCode) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-10 w-full">
        <SelectValue placeholder="Plan" />
      </SelectTrigger>
      <SelectContent>
        {planOptions.map((plan) => (
          <SelectItem key={plan} value={plan}>
            {getBillingPlanLabel(plan)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function QuotaInput({
  value,
  entitlements,
  onChange,
}: {
  value: string;
  entitlements: BillingEntitlements;
  onChange: (value: string) => void;
}) {
  const normalizedValue = toPositiveInteger(value, entitlements.monthlyQuota || 1);
  const isDirty = normalizedValue !== entitlements.monthlyQuota;

  return (
    <div className="min-w-[220px] space-y-2">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="numeric"
        min={1}
        type="number"
        className="h-10"
      />
      <div className="flex items-center gap-2">
        <Progress
          value={quotaProgressValue(entitlements)}
          className="h-1.5 flex-1 bg-muted"
        />
        <span className="shrink-0 text-xs text-muted-foreground">
          {isDirty ? `nouveau ${normalizedValue}` : `enregistre ${entitlements.monthlyQuota}`}
        </span>
      </div>
    </div>
  );
}

function SaveButton({
  pending,
  className,
}: {
  pending: boolean;
  className?: string;
}) {
  return (
    <Button type="submit" disabled={pending} className={className}>
      <Save data-icon="inline-start" />
      {pending ? "Sauvegarde..." : "Sauvegarder"}
    </Button>
  );
}

function AdminOrganizationsLoading() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border/70 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_220px_240px_160px_260px_120px] md:items-center">
            <div className="space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
      {label}
    </div>
  );
}
