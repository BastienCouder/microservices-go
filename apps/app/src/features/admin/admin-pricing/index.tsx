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
  type OrganizationSummary,
} from "@/features/organizations/_lib/shared/organization-page-api";
import { appQueryKeys } from "@/lib/query-keys";
import { invalidateQueryKeys } from "@/shared/api/query-refresh";
import {
  loadBillingPlanSettings,
  syncStripePricingCatalog,
  updateBillingPlanSettings,
  type BillingPlanCode,
  type BillingPlanSettings,
} from "@/shared/billing";
import { getBillingPlanLabel } from "@/shared/billing-plan";
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

function canManageUsage(organization: OrganizationSummary) {
  return (
    organization.role === "admin" ||
    organization.role === "owner" ||
    organization.role === "super_admin"
  );
}

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

function formatCredits(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
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
  const queryClient = useQueryClient();
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanDraft>>({});
  const [newPlanDraft, setNewPlanDraft] = useState<NewPlanDraft>(blankNewPlanDraft);

  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, null),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadOrganizationSummaries(apiBaseURL, signal),
  });

  const adminOrganization = useMemo(
    () => (organizationsQuery.data ?? []).find(canManageUsage) ?? null,
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
      pushSuccessToast("Plan mis à jour.");
    },
    onError: (error) => {
      pushErrorToast(error, "Impossible de mettre à jour ce plan.");
    },
  });

  const syncStripeMutation = useMutation({
    mutationFn: async (plan: BillingPlanCode) => {
      if (!organizationId) throw new Error("Organisation admin introuvable.");
      return syncStripePricingCatalog(apiBaseURL, organizationId, plan);
    },
    onSuccess: (result, plan) => {
      pushSuccessToast(
        `${getBillingPlanLabel(plan)} poussé vers Stripe : ${result.productsCreated} produit créé, ${result.productsUpdated} mis à jour, ${result.pricesCreated} prix créés, ${result.pricesReused} réutilisés.`,
      );
    },
    onError: (error) => {
      pushErrorToast(error, "Impossible de pousser le pricing vers Stripe.");
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
      pushSuccessToast("Badge Le plus choisi mis à jour.");
    },
    onError: (error) => {
      pushErrorToast(error, "Impossible de mettre à jour le badge.");
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
      pushErrorToast(new Error("Plan invalide."), "Le code du plan est requis.");
      return;
    }
    if (HIDDEN_ADMIN_PLANS.has(plan)) {
      pushErrorToast(
        new Error("Plan réservé."),
        "Ce code plan est réservé et ne doit pas être exposé dans l'admin pricing.",
      );
      return;
    }
    if (plansByID.has(plan)) {
      pushErrorToast(
        new Error("Plan déjà existant."),
        "Ce code plan existe déjà. Modifie sa carte existante.",
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
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden md:p-4">
      <PageHeader
        title="Tarification admin"
        baseline="Gérez les prix, crédits et limites des plans fixes."
        actionsVariant="classic"
        className="mb-2 md:mb-3"
        meta={<Badge variant="outline">{visiblePlanIds.length} plans</Badge>}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => void plansQuery.refetch()}
            disabled={isFetching || !organizationId}
            className="h-10 min-w-0 px-3 sm:h-auto sm:min-w-fit sm:px-4.5"
          >
            {isFetching ? "Actualisation..." : "Actualiser"}
          </Button>
        }
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-tr-none bg-background md:rounded-md">
        <div className="min-h-0 flex-1 overflow-hidden px-3 py-3 md:px-4">
          {isLoading ? (
            <AdminPricingLoading />
          ) : !organizationId ? (
            <EmptyState label="Aucune organisation administrable trouvee pour ce compte." />
          ) : (
            <div className="grid h-full min-h-0 gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
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
  return (
    <form
      onSubmit={onSave}
      className="relative rounded-lg border border-dashed border-border/70 bg-card/60 p-3"
    >
      <div className="mb-3">
        <p className="font-mono text-xs text-muted-foreground">NEW</p>
        <h3 className="truncate text-lg font-semibold text-primary">
          Nouveau plan
        </h3>
      </div>

      <div className="mb-3 border-b border-foreground/10 pb-3">
        <Field
          id="new-plan-code"
          label="Code plan"
          value={draft.plan}
          helper="Exemple: agency-plus"
          onChange={(plan) => onUpdate({ plan })}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field
          id="new-plan-monthly-price"
          label="Prix mensuel (€)"
          value={draft.monthlyPrice}
          type="number"
          min={0}
          step="0.01"
          onChange={(monthlyPrice) => onUpdate({ monthlyPrice })}
        />
        <Field
          id="new-plan-yearly-price"
          label="Prix annuel / mois (€)"
          value={draft.yearlyPrice}
          type="number"
          min={0}
          step="0.01"
          onChange={(yearlyPrice) => onUpdate({ yearlyPrice })}
        />
        <Field
          id="new-plan-monthly-quota"
          label="Crédits inclus / mois"
          value={draft.monthlyQuota}
          type="number"
          min={1}
          step="1"
          onChange={(monthlyQuota) => onUpdate({ monthlyQuota })}
        />
        <Field
          id="new-plan-model-selection-limit"
          label="Modèles simultanés"
          value={draft.modelSelectionLimit}
          type="number"
          min={0}
          step="1"
          helper="0 = illimité"
          onChange={(modelSelectionLimit) => onUpdate({ modelSelectionLimit })}
        />
        <Field
          id="new-plan-monthly-model-change-limit"
          label="Changements / mois"
          value={draft.monthlyModelChangeLimit}
          type="number"
          min={0}
          step="1"
          helper="0 = illimité"
          onChange={(monthlyModelChangeLimit) =>
            onUpdate({ monthlyModelChangeLimit })
          }
        />
        <Field
          id="new-plan-max-projects"
          label="Projets maximum"
          value={draft.maxProjects}
          type="number"
          min={0}
          step="1"
          helper="0 = illimité"
          onChange={(maxProjects) => onUpdate({ maxProjects })}
        />
      </div>

      <div className="mt-3">
        <PlanFeatureToggle
          id="new-plan-allow-ai-briefs"
          label="Brief IA"
          checked={draft.allowAiBriefs}
          onCheckedChange={(allowAiBriefs) => onUpdate({ allowAiBriefs })}
        />
      </div>

      <div className="mt-3">
        <Button type="submit" disabled={pending} size="sm" className="w-full">
          {pending ? "Création..." : "Créer ce plan"}
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
          <Badge className="shrink-0">Le plus choisi</Badge>
        ) : null}
      </div>

      <div className="mb-3 flex items-baseline justify-between border-b border-foreground/10 pb-3">
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {formatPrice(settings.monthlyPriceCents)}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatCredits(settings.monthlyQuota)} crédits/mois
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field
          id={`${plan}-monthly-price`}
          label="Prix mensuel (€)"
          value={planDraft.monthlyPrice}
          type="number"
          min={0}
          step="0.01"
          onChange={(monthlyPrice) => onUpdatePlanDraft(plan, { monthlyPrice })}
        />
        <Field
          id={`${plan}-yearly-price`}
          label="Prix annuel / mois (€)"
          value={planDraft.yearlyPrice}
          type="number"
          min={0}
          step="0.01"
          onChange={(yearlyPrice) => onUpdatePlanDraft(plan, { yearlyPrice })}
        />
        <Field
          id={`${plan}-monthly-quota`}
          label="Crédits inclus / mois"
          value={planDraft.monthlyQuota}
          type="number"
          min={1}
          step="1"
          onChange={(monthlyQuota) => onUpdatePlanDraft(plan, { monthlyQuota })}
        />
        <Field
          id={`${plan}-model-selection-limit`}
          label="Modèles simultanés"
          value={planDraft.modelSelectionLimit}
          type="number"
          min={0}
          step="1"
          helper="0 = illimité"
          onChange={(modelSelectionLimit) =>
            onUpdatePlanDraft(plan, { modelSelectionLimit })
          }
        />
        <Field
          id={`${plan}-monthly-model-change-limit`}
          label="Changements / mois"
          value={planDraft.monthlyModelChangeLimit}
          type="number"
          min={0}
          step="1"
          helper="0 = illimité"
          onChange={(monthlyModelChangeLimit) =>
            onUpdatePlanDraft(plan, { monthlyModelChangeLimit })
          }
        />
        <Field
          id={`${plan}-max-projects`}
          label="Projets maximum"
          value={planDraft.maxProjects}
          type="number"
          min={0}
          step="1"
          helper="0 = illimité"
          onChange={(maxProjects) => onUpdatePlanDraft(plan, { maxProjects })}
        />
      </div>

      <div className="mt-3">
        <PlanFeatureToggle
          id={`${plan}-allow-ai-briefs`}
          label="Brief IA"
          checked={planDraft.allowAiBriefs}
          onCheckedChange={(allowAiBriefs) =>
            onUpdatePlanDraft(plan, { allowAiBriefs })
          }
        />
      </div>

      <div className="mt-3 grid gap-2">
        <Button type="submit" disabled={pending} size="sm" className="w-full">
          {pending ? "Sauvegarde..." : "Sauvegarder ce plan"}
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
            ? "Badge actif"
            : mostChosenPending
              ? "Mise à jour..."
              : "Mettre le badge"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={stripePending || stripeDisabled}
          className="w-full"
          onClick={() => onSyncStripe(plan)}
        >
          {stripePending ? "Envoi Stripe..." : "Pousser ce plan"}
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
