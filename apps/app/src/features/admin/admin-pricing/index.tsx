"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";
import {
  loadOrganizationSummaries,
} from "@/features/organizations/_lib/shared/organization-page-api";
import { appQueryKeys } from "@/lib/query-keys";
import { findPrimaryAdminOrganization } from "@/shared/admin-routing";
import { invalidateQueryKeys } from "@/shared/api/query-refresh";
import {
  loadBillingPlanSettings,
  syncStripePricingCatalog,
  updateBillingPlanSettings,
  type BillingPlanCode,
  type BillingPlanSettings,
} from "@/shared/billing";
import { getBillingPlanLabel } from "@/shared/billing-plan";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { cn } from "@/shared/utils";

type AdminPricingPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

type PlanDraft = {
  monthlyPrice: string;
  yearlyPrice: string;
  monthlyQuota: string;
  modelSelectionLimit: string;
  monthlyModelChangeLimit: string;
  maxProjects: string;
  allowAiBriefs: boolean;
};

type NewPlanDraft = PlanDraft & {
  plan: string;
};

const CORE_PLAN_ORDER = ["starter", "growth", "pro"] as const;
const HIDDEN_ADMIN_PLANS = new Set(["developer"]);
const EMPTY_PLANS: BillingPlanSettings[] = [];

function normalizePlanCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .split(/\s+/)
    .filter(Boolean)
    .join("-");
}

function sortBillingPlans(plans: string[]) {
  const uniquePlans = Array.from(
    new Set(
      plans
        .map(normalizePlanCode)
        .filter((plan) => plan && !HIDDEN_ADMIN_PLANS.has(plan)),
    ),
  );
  uniquePlans.sort((left, right) => {
    const leftIndex = CORE_PLAN_ORDER.indexOf(left as (typeof CORE_PLAN_ORDER)[number]);
    const rightIndex = CORE_PLAN_ORDER.indexOf(right as (typeof CORE_PLAN_ORDER)[number]);
    const leftRank = leftIndex === -1 ? 100 : leftIndex;
    const rightRank = rightIndex === -1 ? 100 : rightIndex;
    if (leftRank === rightRank) return left.localeCompare(right);
    return leftRank - rightRank;
  });
  return uniquePlans;
}

function centsToEuroString(cents: number) {
  return String(Math.max(0, cents) / 100).replace(/\.00$/, "");
}

function euroStringToCents(value: string, fallback: number) {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") return fallback;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : fallback;
}

function toPositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toNonNegativeInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatPrice(cents: number) {
  return `${Math.round(cents / 100)}€`;
}

function emptyPlanSettings(plan: BillingPlanCode): BillingPlanSettings {
  return {
    plan,
    monthlyPriceCents: 0,
    yearlyPriceCents: 0,
    monthlyQuota: 1,
    modelSelectionLimit: 0,
    monthlyModelChangeLimit: 0,
    maxProjects: 0,
    allowAiBriefs: false,
    isMostChosen: false,
  };
}

function blankPlanDraft(): PlanDraft {
  return {
    monthlyPrice: "",
    yearlyPrice: "",
    monthlyQuota: "1",
    modelSelectionLimit: "0",
    monthlyModelChangeLimit: "0",
    maxProjects: "0",
    allowAiBriefs: false,
  };
}

function blankNewPlanDraft(): NewPlanDraft {
  return {
    plan: "",
    ...blankPlanDraft(),
  };
}

function planDraftFromSettings(settings: BillingPlanSettings): PlanDraft {
  return {
    monthlyPrice: centsToEuroString(settings.monthlyPriceCents),
    yearlyPrice: centsToEuroString(settings.yearlyPriceCents),
    monthlyQuota: String(Math.max(1, settings.monthlyQuota || 1)),
    modelSelectionLimit: String(Math.max(0, settings.modelSelectionLimit)),
    monthlyModelChangeLimit: String(Math.max(0, settings.monthlyModelChangeLimit)),
    maxProjects: String(Math.max(0, settings.maxProjects)),
    allowAiBriefs: settings.allowAiBriefs,
  };
}

function normalizePlanDraft(
  plan: BillingPlanCode,
  settings: BillingPlanSettings,
  draft: PlanDraft,
): BillingPlanSettings {
  return {
    ...settings,
    plan,
    monthlyPriceCents: euroStringToCents(draft.monthlyPrice, settings.monthlyPriceCents),
    yearlyPriceCents: euroStringToCents(draft.yearlyPrice, settings.yearlyPriceCents),
    monthlyQuota: toPositiveInteger(draft.monthlyQuota, settings.monthlyQuota || 1),
    modelSelectionLimit: toNonNegativeInteger(draft.modelSelectionLimit),
    monthlyModelChangeLimit: toNonNegativeInteger(draft.monthlyModelChangeLimit),
    maxProjects: toNonNegativeInteger(draft.maxProjects),
    allowAiBriefs: draft.allowAiBriefs === true,
  };
}

export function AdminPricingPage({ apiBaseURL }: AdminPricingPageProps) {
  const { t } = useScopedI18n("admin-pricing");
  const queryClient = useQueryClient();
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanDraft>>({});
  const [newPlanDraft, setNewPlanDraft] = useState<NewPlanDraft>(blankNewPlanDraft);

  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, null, "admin"),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) =>
      loadOrganizationSummaries(apiBaseURL, signal, { adminScope: true }),
  });

  const adminOrganization = useMemo(
    () => findPrimaryAdminOrganization(organizationsQuery.data ?? []),
    [organizationsQuery.data],
  );
  const organizationId = adminOrganization?.id ?? "";
  const plansQueryKey = appQueryKeys.billingPlans(apiBaseURL, organizationId);

  const plansQuery = useQuery({
    queryKey: plansQueryKey,
    enabled: apiBaseURL.trim() !== "" && organizationId !== "",
    queryFn: ({ signal }) =>
      loadBillingPlanSettings(apiBaseURL, organizationId, { signal }),
  });

  const plans = plansQuery.data ?? EMPTY_PLANS;
  const visiblePlanIds = useMemo(
    () => sortBillingPlans(plans.map((plan) => plan.plan)),
    [plans],
  );
  const plansByID = useMemo(
    () => new Map(plans.map((plan) => [plan.plan, plan])),
    [plans],
  );

  useEffect(() => {
    if (plans.length === 0) return;
    setPlanDrafts((current) => {
      const next = { ...current };
      for (const plan of plans) {
        if (HIDDEN_ADMIN_PLANS.has(plan.plan)) continue;
        next[plan.plan] = current[plan.plan] ?? planDraftFromSettings(plan);
      }
      return next;
    });
  }, [plans]);

  const updatePlanMutation = useMutation({
    mutationFn: async ({
      plan,
      settings,
    }: {
      plan: BillingPlanCode;
      settings: BillingPlanSettings;
    }) => {
      if (!organizationId) throw new Error("Organisation admin introuvable.");
      const updatedSettings = await updateBillingPlanSettings(apiBaseURL, {
        organizationId,
        ...settings,
      });
      return { plan, settings: updatedSettings };
    },
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        plansQueryKey,
        ["billing", "quota", apiBaseURL],
        ["prompt-quota", apiBaseURL],
      ]);
      pushSuccessToast(t("planUpdated"));
    },
    onError: (error) => {
      pushErrorToast(error, t("planUpdateError"));
    },
  });

  const syncStripeMutation = useMutation({
    mutationFn: async (plan: BillingPlanCode) => {
      if (!organizationId) throw new Error("Organisation admin introuvable.");
      return syncStripePricingCatalog(apiBaseURL, organizationId, plan);
    },
    onSuccess: (result, plan) => {
      pushSuccessToast(
        t("stripeSyncSuccess", {
          plan: getBillingPlanLabel(plan),
          productsCreated: result.productsCreated,
          productsUpdated: result.productsUpdated,
          pricesCreated: result.pricesCreated,
          pricesReused: result.pricesReused,
        }),
      );
    },
    onError: (error) => {
      pushErrorToast(error, t("stripeSyncError"));
    },
  });

  const setMostChosenMutation = useMutation({
    mutationFn: async (settings: BillingPlanSettings) => {
      if (!organizationId) throw new Error("Organisation admin introuvable.");
      return updateBillingPlanSettings(apiBaseURL, {
        organizationId,
        ...settings,
        isMostChosen: true,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: plansQueryKey });
      pushSuccessToast(t("mostChosenUpdated"));
    },
    onError: (error) => {
      pushErrorToast(error, t("mostChosenUpdateError"));
    },
  });

  const updatePlanDraft = (plan: BillingPlanCode, patch: Partial<PlanDraft>) => {
    const settings = plansByID.get(plan) ?? emptyPlanSettings(plan);
    setPlanDrafts((current) => ({
      ...current,
      [plan]: {
        ...(current[plan] ?? planDraftFromSettings(settings)),
        ...patch,
      },
    }));
  };

  const updateNewPlanDraft = (patch: Partial<NewPlanDraft>) => {
    setNewPlanDraft((current) => ({ ...current, ...patch }));
  };

  const savePlan = (
    event: FormEvent<HTMLFormElement>,
    plan: BillingPlanCode,
    settings: BillingPlanSettings,
  ) => {
    event.preventDefault();
    updatePlanMutation.mutate({
      plan,
      settings: normalizePlanDraft(
        plan,
        settings,
        planDrafts[plan] ?? planDraftFromSettings(settings),
      ),
    });
  };

  const saveNewPlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const plan = normalizePlanCode(newPlanDraft.plan);
    if (!plan) {
      pushErrorToast(new Error(t("invalidPlanErrorTitle")), t("invalidPlanErrorDescription"));
      return;
    }
    if (HIDDEN_ADMIN_PLANS.has(plan)) {
      pushErrorToast(
        new Error(t("reservedPlanErrorTitle")),
        t("reservedPlanErrorDescription"),
      );
      return;
    }
    if (plansByID.has(plan)) {
      pushErrorToast(
        new Error(t("existingPlanErrorTitle")),
        t("existingPlanErrorDescription"),
      );
      return;
    }

    const settings = normalizePlanDraft(
      plan,
      emptyPlanSettings(plan),
      newPlanDraft,
    );

    updatePlanMutation.mutate(
      { plan, settings },
      {
        onSuccess: () => {
          setNewPlanDraft(blankNewPlanDraft());
        },
      },
    );
  };

  const markMostChosen = (plan: BillingPlanCode, settings: BillingPlanSettings) => {
    setMostChosenMutation.mutate({
      ...(planDrafts[plan]
        ? normalizePlanDraft(plan, settings, planDrafts[plan]!)
        : settings),
      plan,
      isMostChosen: true,
    });
  };

  const isLoading = organizationsQuery.isLoading || plansQuery.isLoading;
  const isFetching = organizationsQuery.isFetching || plansQuery.isFetching;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto p-2 md:p-4">
      <PageHeader
        title={t("pageTitle")}
        baseline={t("pageBaseline")}
        actionsVariant="classic"
        className="mb-2 md:mb-3"
        meta={<Badge variant="outline">{t("plansCount", { count: visiblePlanIds.length })}</Badge>}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => void plansQuery.refetch()}
            disabled={isFetching || !organizationId}
            className="h-10 min-w-0 px-3 sm:h-auto sm:min-w-fit sm:px-4.5"
          >
            {isFetching ? t("refreshing") : t("refresh")}
          </Button>
        }
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-md rounded-tr-none bg-background">
        <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 md:px-6">
          {isLoading ? (
            <AdminPricingLoading />
          ) : !organizationId ? (
            <EmptyState label={t("noManageableOrganization")} />
          ) : (
            <div className="flex h-full min-h-0 flex-col gap-3">
              <div className="grid min-h-0 gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                <NewPlanCard
                  draft={newPlanDraft}
                  pending={updatePlanMutation.isPending && !plansByID.has(updatePlanMutation.variables?.plan ?? "")}
                  onUpdate={updateNewPlanDraft}
                  onSave={saveNewPlan}
                />
                {visiblePlanIds.map((plan, index) => {
                  const settings = plansByID.get(plan) ?? emptyPlanSettings(plan);
                  return (
                    <PlanCard
                      key={plan}
                      index={index}
                      plan={plan}
                      settings={settings}
                      planDraft={planDrafts[plan] ?? planDraftFromSettings(settings)}
                      pending={
                        updatePlanMutation.isPending &&
                        updatePlanMutation.variables?.plan === plan
                      }
                      stripePending={
                        syncStripeMutation.isPending &&
                        syncStripeMutation.variables === plan
                      }
                      stripeDisabled={
                        syncStripeMutation.isPending || updatePlanMutation.isPending
                      }
                      mostChosenPending={
                        setMostChosenMutation.isPending &&
                        setMostChosenMutation.variables?.plan === plan
                      }
                      onUpdatePlanDraft={updatePlanDraft}
                      onSave={savePlan}
                      onSyncStripe={(targetPlan) => syncStripeMutation.mutate(targetPlan)}
                      onMarkMostChosen={markMostChosen}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewPlanCard({
  draft,
  pending,
  onUpdate,
  onSave,
}: {
  draft: NewPlanDraft;
  pending: boolean;
  onUpdate: (patch: Partial<NewPlanDraft>) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useScopedI18n("admin-pricing");

  return (
    <form
      onSubmit={onSave}
      className="relative rounded-lg border border-dashed border-border/70 bg-card/60 p-3"
    >
      <div className="mb-3">
        <p className="font-mono text-xs text-muted-foreground">{t("newLabel")}</p>
        <h3 className="truncate text-lg font-semibold text-primary">
          {t("newPlanTitle")}
        </h3>
      </div>

      <div className="mb-3 border-b border-foreground/10 pb-3">
        <Field
          id="new-plan-code"
          label={t("planCodeLabel")}
          value={draft.plan}
          helper={t("planCodeExample")}
          onChange={(plan) => onUpdate({ plan })}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field
          id="new-plan-monthly-price"
          label={t("monthlyPriceLabel")}
          value={draft.monthlyPrice}
          type="number"
          min={0}
          step="0.01"
          onChange={(monthlyPrice) => onUpdate({ monthlyPrice })}
        />
        <Field
          id="new-plan-yearly-price"
          label={t("yearlyMonthlyPriceLabel")}
          value={draft.yearlyPrice}
          type="number"
          min={0}
          step="0.01"
          onChange={(yearlyPrice) => onUpdate({ yearlyPrice })}
        />
        <Field
          id="new-plan-monthly-quota"
          label={t("monthlyCreditsLabel")}
          value={draft.monthlyQuota}
          type="number"
          min={1}
          step="1"
          onChange={(monthlyQuota) => onUpdate({ monthlyQuota })}
        />
        <Field
          id="new-plan-model-selection-limit"
          label={t("simultaneousModelsLabel")}
          value={draft.modelSelectionLimit}
          type="number"
          min={0}
          step="1"
          helper={t("unlimitedHint")}
          onChange={(modelSelectionLimit) => onUpdate({ modelSelectionLimit })}
        />
        <Field
          id="new-plan-monthly-model-change-limit"
          label={t("monthlyChangesLabel")}
          value={draft.monthlyModelChangeLimit}
          type="number"
          min={0}
          step="1"
          helper={t("unlimitedHint")}
          onChange={(monthlyModelChangeLimit) =>
            onUpdate({ monthlyModelChangeLimit })
          }
        />
        <Field
          id="new-plan-max-projects"
          label={t("maxProjectsLabel")}
          value={draft.maxProjects}
          type="number"
          min={0}
          step="1"
          helper={t("unlimitedHint")}
          onChange={(maxProjects) => onUpdate({ maxProjects })}
        />
      </div>

      <div className="mt-3">
        <PlanFeatureToggle
          id="new-plan-allow-ai-briefs"
          label={t("aiBriefLabel")}
          checked={draft.allowAiBriefs}
          onCheckedChange={(allowAiBriefs) => onUpdate({ allowAiBriefs })}
        />
      </div>

      <div className="mt-3">
        <Button type="submit" disabled={pending} size="sm" className="w-full">
          {pending ? t("creating") : t("createPlan")}
        </Button>
      </div>
    </form>
  );
}

function PlanCard({
  index,
  plan,
  settings,
  planDraft,
  pending,
  stripePending,
  stripeDisabled,
  mostChosenPending,
  onUpdatePlanDraft,
  onSave,
  onSyncStripe,
  onMarkMostChosen,
}: {
  index: number;
  plan: BillingPlanCode;
  settings: BillingPlanSettings;
  planDraft: PlanDraft;
  pending: boolean;
  stripePending: boolean;
  stripeDisabled: boolean;
  mostChosenPending: boolean;
  onUpdatePlanDraft: (plan: BillingPlanCode, patch: Partial<PlanDraft>) => void;
  onSave: (
    event: FormEvent<HTMLFormElement>,
    plan: BillingPlanCode,
    settings: BillingPlanSettings,
  ) => void;
  onSyncStripe: (plan: BillingPlanCode) => void;
  onMarkMostChosen: (plan: BillingPlanCode, settings: BillingPlanSettings) => void;
}) {
  const { t } = useScopedI18n("admin-pricing");

  return (
    <form
      onSubmit={(event) => onSave(event, plan, settings)}
      className={cn(
        "relative rounded-lg border border-border/70 bg-card p-3",
        settings.isMostChosen && "border-primary bg-primary/[0.03]",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </p>
          <h3 className="truncate text-lg font-semibold text-primary">
            {getBillingPlanLabel(plan)}
          </h3>
        </div>
        {settings.isMostChosen ? (
          <Badge className="shrink-0">{t("mostChosen")}</Badge>
        ) : null}
      </div>

      <div className="mb-3 flex items-baseline justify-between border-b border-foreground/10 pb-3">
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {formatPrice(settings.monthlyPriceCents)}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("creditsPerMonth", { count: settings.monthlyQuota })}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field
          id={`${plan}-monthly-price`}
          label={t("monthlyPriceLabel")}
          value={planDraft.monthlyPrice}
          type="number"
          min={0}
          step="0.01"
          onChange={(monthlyPrice) => onUpdatePlanDraft(plan, { monthlyPrice })}
        />
        <Field
          id={`${plan}-yearly-price`}
          label={t("yearlyMonthlyPriceLabel")}
          value={planDraft.yearlyPrice}
          type="number"
          min={0}
          step="0.01"
          onChange={(yearlyPrice) => onUpdatePlanDraft(plan, { yearlyPrice })}
        />
        <Field
          id={`${plan}-monthly-quota`}
          label={t("monthlyCreditsLabel")}
          value={planDraft.monthlyQuota}
          type="number"
          min={1}
          step="1"
          onChange={(monthlyQuota) => onUpdatePlanDraft(plan, { monthlyQuota })}
        />
        <Field
          id={`${plan}-model-selection-limit`}
          label={t("simultaneousModelsLabel")}
          value={planDraft.modelSelectionLimit}
          type="number"
          min={0}
          step="1"
          helper={t("unlimitedHint")}
          onChange={(modelSelectionLimit) =>
            onUpdatePlanDraft(plan, { modelSelectionLimit })
          }
        />
        <Field
          id={`${plan}-monthly-model-change-limit`}
          label={t("monthlyChangesLabel")}
          value={planDraft.monthlyModelChangeLimit}
          type="number"
          min={0}
          step="1"
          helper={t("unlimitedHint")}
          onChange={(monthlyModelChangeLimit) =>
            onUpdatePlanDraft(plan, { monthlyModelChangeLimit })
          }
        />
        <Field
          id={`${plan}-max-projects`}
          label={t("maxProjectsLabel")}
          value={planDraft.maxProjects}
          type="number"
          min={0}
          step="1"
          helper={t("unlimitedHint")}
          onChange={(maxProjects) => onUpdatePlanDraft(plan, { maxProjects })}
        />
      </div>

      <div className="mt-3">
        <PlanFeatureToggle
          id={`${plan}-allow-ai-briefs`}
          label={t("aiBriefLabel")}
          checked={planDraft.allowAiBriefs}
          onCheckedChange={(allowAiBriefs) =>
            onUpdatePlanDraft(plan, { allowAiBriefs })
          }
        />
      </div>

      <div className="mt-3 grid gap-2">
        <Button type="submit" disabled={pending} size="sm" className="w-full">
          {pending ? t("saving") : t("savePlan")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={settings.isMostChosen || mostChosenPending}
          className="w-full"
          onClick={() => onMarkMostChosen(plan, settings)}
        >
          {settings.isMostChosen
            ? t("badgeActive")
            : mostChosenPending
              ? t("badgeUpdating")
              : t("setBadge")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={stripePending || stripeDisabled}
          className="w-full"
          onClick={() => onSyncStripe(plan)}
        >
          {stripePending ? t("stripeSending") : t("pushPlan")}
        </Button>
      </div>
    </form>
  );
}

function PlanFeatureToggle({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  helper,
  ...inputProps
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "min" | "step"
>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        {...inputProps}
      />
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function AdminPricingLoading() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border/70 bg-card p-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-4 h-10 w-40" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((__, fieldIndex) => (
              <div key={fieldIndex} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-border/70 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
