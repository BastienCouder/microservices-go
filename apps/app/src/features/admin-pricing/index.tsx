"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Code, RefreshCw, Save, Terminal, Zap } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";
import { appQueryKeys } from "@/lib/query-keys";
import {
  loadOrganizationSummaries,
  type OrganizationSummary,
} from "@/features/organizations/_lib/shared/organization-page-api";
import {
  loadBillingPlanSettings,
  loadBillingPricingTiers,
  updateBillingPlanSettings,
  updateBillingPricingTier,
  type BillingPlanSettings,
  type BillingPricingTier,
} from "@/shared/billing";
import { getBillingPlanLabel, type SimulatedPlan } from "@/shared/billing-plan";
import { cn } from "@/shared/utils";

type AdminPricingPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

type PriceKey =
  | "developerPriceCents"
  | "starterPriceCents"
  | "growthPriceCents"
  | "proPriceCents";

type TierDraft = {
  promptVolume: string;
  label: string;
  developer: string;
  starter: string;
  growth: string;
  pro: string;
};

type PlanLimitDraft = {
  monthlyQuota: string;
  modelSelectionLimit: string;
  monthlyModelChangeLimit: string;
};

const PLAN_ORDER = ["developer", "starter", "growth", "pro"] as const satisfies SimulatedPlan[];
type ConfigurablePlan = (typeof PLAN_ORDER)[number];
const EMPTY_PLANS: BillingPlanSettings[] = [];
const EMPTY_TIERS: BillingPricingTier[] = [];
const PRICE_KEYS: Record<ConfigurablePlan, PriceKey> = {
  developer: "developerPriceCents",
  starter: "starterPriceCents",
  growth: "growthPriceCents",
  pro: "proPriceCents",
};

function canManageUsage(organization: OrganizationSummary) {
  return (
    organization.role === "admin" ||
    organization.role === "owner" ||
    organization.role === "super_admin"
  );
}

function centsToEuroString(cents: number | null) {
  if (cents === null) return "";
  return String(Math.max(0, cents) / 100).replace(/\.00$/, "");
}

function euroStringToNullableCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function toPositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toNonNegativeInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatPrompts(value: number) {
  if (value >= 5000) return "5k+";
  if (value >= 1000) return `${value / 1000}k`;
  return String(value);
}

function formatPrice(cents: number | null) {
  if (cents === null) return "Sur devis";
  return `${Math.round(cents / 100)}€`;
}

function tierDraftFromTier(tier: BillingPricingTier): TierDraft {
  return {
    promptVolume: String(tier.promptVolume),
    label: tier.label,
    developer: centsToEuroString(tier.developerPriceCents),
    starter: centsToEuroString(tier.starterPriceCents),
    growth: centsToEuroString(tier.growthPriceCents),
    pro: centsToEuroString(tier.proPriceCents),
  };
}

function planLimitDraftFromSettings(settings: BillingPlanSettings): PlanLimitDraft {
  return {
    monthlyQuota: String(Math.max(1, settings.monthlyQuota || 1)),
    modelSelectionLimit: String(Math.max(0, settings.modelSelectionLimit)),
    monthlyModelChangeLimit: String(Math.max(0, settings.monthlyModelChangeLimit)),
  };
}

function normalizeTierDraft(draft: TierDraft): BillingPricingTier {
  const promptVolume = toPositiveInteger(draft.promptVolume, 1);
  return {
    promptVolume,
    label: draft.label.trim() || formatPrompts(promptVolume),
    developerPriceCents: euroStringToNullableCents(draft.developer),
    starterPriceCents: euroStringToNullableCents(draft.starter),
    growthPriceCents: euroStringToNullableCents(draft.growth),
    proPriceCents: euroStringToNullableCents(draft.pro),
  };
}

function normalizePlanLimitDraft(
  plan: ConfigurablePlan,
  settings: BillingPlanSettings,
  draft: PlanLimitDraft,
): BillingPlanSettings {
  return {
    ...settings,
    plan,
    monthlyQuota: toPositiveInteger(draft.monthlyQuota, settings.monthlyQuota || 1),
    modelSelectionLimit: toNonNegativeInteger(draft.modelSelectionLimit),
    monthlyModelChangeLimit: toNonNegativeInteger(draft.monthlyModelChangeLimit),
  };
}

function iconForPlan(plan: ConfigurablePlan) {
  switch (plan) {
    case "developer":
      return <Terminal className="size-4" />;
    case "starter":
      return <Code className="size-4" />;
    case "growth":
      return <Zap className="size-4" />;
    default:
      return <Building2 className="size-4" />;
  }
}

export function AdminPricingPage({ apiBaseURL }: AdminPricingPageProps) {
  const queryClient = useQueryClient();
  const [volumeIndex, setVolumeIndex] = useState(2);
  const [tierDrafts, setTierDrafts] = useState<Record<number, TierDraft>>({});
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanLimitDraft>>({});

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
  const tiersQueryKey = appQueryKeys.billingPricingTiers(apiBaseURL, organizationId);

  const plansQuery = useQuery({
    queryKey: plansQueryKey,
    enabled: apiBaseURL.trim() !== "" && organizationId !== "",
    queryFn: ({ signal }) =>
      loadBillingPlanSettings(apiBaseURL, organizationId, { signal }),
  });
  const tiersQuery = useQuery({
    queryKey: tiersQueryKey,
    enabled: apiBaseURL.trim() !== "" && organizationId !== "",
    queryFn: ({ signal }) =>
      loadBillingPricingTiers(apiBaseURL, organizationId, { signal }),
  });

  const plans = plansQuery.data ?? EMPTY_PLANS;
  const tiers = tiersQuery.data ?? EMPTY_TIERS;
  const selectedTier = tiers[Math.min(volumeIndex, Math.max(0, tiers.length - 1))];
  const selectedTierDraft = selectedTier
    ? tierDrafts[selectedTier.promptVolume] ?? tierDraftFromTier(selectedTier)
    : null;
  const normalizedSelectedTier = selectedTierDraft
    ? normalizeTierDraft(selectedTierDraft)
    : null;

  const plansByID = useMemo(
    () => new Map(plans.map((plan) => [plan.plan, plan])),
    [plans],
  );

  useEffect(() => {
    if (organizationsQuery.error instanceof Error) {
      pushErrorToast(
        organizationsQuery.error,
        "Impossible de charger les organisations.",
      );
    }
  }, [organizationsQuery.error]);

  useEffect(() => {
    const error = plansQuery.error || tiersQuery.error;
    if (error instanceof Error) {
      pushErrorToast(error, "Impossible de charger le pricing.");
    }
  }, [plansQuery.error, tiersQuery.error]);

  useEffect(() => {
    if (tiers.length === 0) return;
    setTierDrafts((current) => {
      const next = { ...current };
      for (const tier of tiers) {
        if (!next[tier.promptVolume]) {
          next[tier.promptVolume] = tierDraftFromTier(tier);
        }
      }
      return next;
    });
  }, [tiers]);

  useEffect(() => {
    if (plans.length === 0) return;
    setPlanDrafts((current) => {
      const next = { ...current };
      for (const plan of plans) {
        if (!next[plan.plan]) {
          next[plan.plan] = planLimitDraftFromSettings(plan);
        }
      }
      return next;
    });
  }, [plans]);

  const updateTierMutation = useMutation({
    mutationFn: async (tier: BillingPricingTier) => {
      if (!organizationId) throw new Error("Organisation admin introuvable.");
      return updateBillingPricingTier(apiBaseURL, {
        organizationId,
        ...tier,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tiersQueryKey });
      pushSuccessToast("Palier pricing mis a jour.");
    },
    onError: (error) => {
      pushErrorToast(error, "Impossible de mettre a jour ce palier.");
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({
      plan,
      settings,
      tier,
    }: {
      plan: ConfigurablePlan;
      settings: BillingPlanSettings;
      tier: BillingPricingTier;
    }) => {
      if (!organizationId) throw new Error("Organisation admin introuvable.");
      const [updatedSettings] = await Promise.all([
        updateBillingPlanSettings(apiBaseURL, {
          organizationId,
          ...settings,
        }),
        updateBillingPricingTier(apiBaseURL, {
          organizationId,
          ...tier,
        }),
      ]);
      return { plan, settings: updatedSettings, tier };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: plansQueryKey }),
        queryClient.invalidateQueries({ queryKey: tiersQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["billing", "quota", apiBaseURL] }),
        queryClient.invalidateQueries({ queryKey: ["prompt-quota", apiBaseURL] }),
      ]);
      pushSuccessToast("Plan et prix du palier mis a jour.");
    },
    onError: (error) => {
      pushErrorToast(error, "Impossible de mettre a jour ce plan.");
    },
  });

  const updateTierDraft = (patch: Partial<TierDraft>) => {
    if (!selectedTier) return;
    setTierDrafts((current) => ({
      ...current,
      [selectedTier.promptVolume]: {
        ...(current[selectedTier.promptVolume] ?? tierDraftFromTier(selectedTier)),
        ...patch,
      },
    }));
  };

  const updatePlanDraft = (plan: ConfigurablePlan, patch: Partial<PlanLimitDraft>) => {
    const settings = plansByID.get(plan);
    setPlanDrafts((current) => ({
      ...current,
      [plan]: {
        ...(current[plan] ??
          (settings
            ? planLimitDraftFromSettings(settings)
            : {
                monthlyQuota: "1",
                modelSelectionLimit: "0",
                monthlyModelChangeLimit: "0",
              })),
        ...patch,
      },
    }));
  };

  const saveTier = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!normalizedSelectedTier) return;
    updateTierMutation.mutate(normalizedSelectedTier);
  };

  const savePlan = (
    event: FormEvent<HTMLFormElement>,
    plan: ConfigurablePlan,
    settings: BillingPlanSettings,
  ) => {
    event.preventDefault();
    if (!normalizedSelectedTier) return;
    updatePlanMutation.mutate({
      plan,
      tier: normalizedSelectedTier,
      settings: normalizePlanLimitDraft(
        plan,
        settings,
        planDrafts[plan] ?? planLimitDraftFromSettings(settings),
      ),
    });
  };

  const isLoading =
    organizationsQuery.isLoading || plansQuery.isLoading || tiersQuery.isLoading;
  const isFetching =
    organizationsQuery.isFetching || plansQuery.isFetching || tiersQuery.isFetching;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden md:p-4">
      <PageHeader
        title="Admin prices"
        baseline="La meme grille que la page marketing : volume, prix et droits par plan."
        actionsVariant="classic"
        className="mb-3 md:mb-4"
        meta={
          <>
            <Badge variant="default">{tiers.length} paliers</Badge>
            <Badge variant="outline">Developer inclus</Badge>
          </>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void plansQuery.refetch();
              void tiersQuery.refetch();
            }}
            disabled={isFetching || !organizationId}
            className="h-10 min-w-0 px-3 sm:h-auto sm:min-w-fit sm:px-4.5"
          >
            <RefreshCw data-icon="inline-start" />
            {isFetching ? "Actualisation..." : "Actualiser"}
          </Button>
        }
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-tr-none bg-background md:rounded-md">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-4">
          {isLoading ? (
            <AdminPricingLoading />
          ) : !organizationId ? (
            <EmptyState label="Aucune organisation administrable trouvee pour ce compte." />
          ) : !selectedTier || !selectedTierDraft || !normalizedSelectedTier ? (
            <EmptyState label="Aucun palier pricing charge pour le moment." />
          ) : (
            <div className="space-y-4">
              <form
                onSubmit={saveTier}
                className="rounded-2xl border border-border/70 bg-card p-5 lg:p-6"
              >
                <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                      Volume mensuel
                    </p>
                    <div className="flex items-end gap-3">
                      <span className="text-4xl font-semibold tracking-tight text-primary lg:text-5xl">
                        {formatPrompts(normalizedSelectedTier.promptVolume)}
                      </span>
                      <span className="pb-1 text-muted-foreground">
                        prompts suivis
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[140px_140px_auto]">
                    <Field
                      id="pricing-tier-label"
                      label="Label"
                      value={selectedTierDraft.label}
                      onChange={(label) => updateTierDraft({ label })}
                    />
                    <Field
                      id="pricing-tier-volume"
                      label="Prompts"
                      value={selectedTierDraft.promptVolume}
                      type="number"
                      min={1}
                      step="1"
                      onChange={(promptVolume) => updateTierDraft({ promptVolume })}
                    />
                    <div className="flex items-end">
                      <Button
                        type="submit"
                        disabled={updateTierMutation.isPending}
                        className="w-full"
                      >
                        <Save data-icon="inline-start" />
                        {updateTierMutation.isPending ? "Sauvegarde..." : "Sauver palier"}
                      </Button>
                    </div>
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max={Math.max(0, tiers.length - 1)}
                  step="1"
                  value={volumeIndex}
                  onChange={(event) =>
                    setVolumeIndex(Number.parseInt(event.target.value, 10))
                  }
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-foreground/10 accent-foreground"
                />

                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {tiers.map((tier, index) => {
                    const active = index === volumeIndex;
                    return (
                      <Button
                        key={tier.promptVolume}
                        type="button"
                        onClick={() => setVolumeIndex(index)}
                        className={cn(
                          "rounded-full border px-3 py-3 text-center transition-all",
                          active
                            ? "border-primary bg-primary text-background"
                            : "border-foreground/10 bg-transparent text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-primary",
                        )}
                      >
                        <div className="text-sm font-medium">{tier.label}</div>
                        <div className="mt-1 text-[10px] font-mono uppercase">
                          prompts
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </form>

              <div className="grid gap-px overflow-hidden rounded-2xl border border-border/70 md:grid-cols-2 xl:grid-cols-4">
                {PLAN_ORDER.map((plan, index) => {
                  const settings = plansByID.get(plan);
                  if (!settings) return null;
                  return (
                    <PlanCard
                      key={plan}
                      index={index}
                      plan={plan}
                      settings={settings}
                      tier={normalizedSelectedTier}
                      tierDraft={selectedTierDraft}
                      planDraft={planDrafts[plan] ?? planLimitDraftFromSettings(settings)}
                      pending={
                        updatePlanMutation.isPending &&
                        updatePlanMutation.variables?.plan === plan
                      }
                      onUpdateTierDraft={updateTierDraft}
                      onUpdatePlanDraft={updatePlanDraft}
                      onSave={savePlan}
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

function PlanCard({
  index,
  plan,
  settings,
  tier,
  tierDraft,
  planDraft,
  pending,
  onUpdateTierDraft,
  onUpdatePlanDraft,
  onSave,
}: {
  index: number;
  plan: ConfigurablePlan;
  settings: BillingPlanSettings;
  tier: BillingPricingTier;
  tierDraft: TierDraft;
  planDraft: PlanLimitDraft;
  pending: boolean;
  onUpdateTierDraft: (patch: Partial<TierDraft>) => void;
  onUpdatePlanDraft: (plan: ConfigurablePlan, patch: Partial<PlanLimitDraft>) => void;
  onSave: (
    event: FormEvent<HTMLFormElement>,
    plan: ConfigurablePlan,
    settings: BillingPlanSettings,
  ) => void;
}) {
  const priceKey = PRICE_KEYS[plan];
  const priceDraftKey = plan;
  const currentPrice = tier[priceKey];
  const modelLimit = toNonNegativeInteger(planDraft.modelSelectionLimit);

  return (
    <form
      onSubmit={(event) => onSave(event, plan, settings)}
      className={cn(
        "relative bg-card p-5 lg:p-6",
        plan === "growth" && "bg-primary/[0.03] ring-2 ring-inset ring-primary",
      )}
    >
      {plan === "growth" ? (
        <span className="absolute right-5 top-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-background">
          Le plus choisi
        </span>
      ) : null}

      <div className="mb-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          {iconForPlan(plan)}
          <span className="font-mono text-xs">{String(index + 1).padStart(2, "0")}</span>
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-primary">
          {getBillingPlanLabel(plan)}
        </h2>
        <div className="mt-3 inline-flex border border-foreground/10 px-3 py-1 text-xs font-mono uppercase text-foreground">
          {formatPrompts(tier.promptVolume)} prompts
        </div>
      </div>

      <div className="mb-6 border-b border-foreground/10 pb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight text-foreground">
            {formatPrice(currentPrice)}
          </span>
          {currentPrice !== null ? (
            <span className="text-muted-foreground">/mois</span>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <Field
          id={`${plan}-tier-price`}
          label="Prix du palier (€)"
          value={tierDraft[priceDraftKey]}
          type="number"
          min={0}
          step="0.01"
          helper="Vide = Sur devis / indisponible"
          onChange={(value) => onUpdateTierDraft({ [priceDraftKey]: value })}
        />
        <Field
          id={`${plan}-monthly-quota`}
          label="Quota prompts app"
          value={planDraft.monthlyQuota}
          type="number"
          min={1}
          step="1"
          onChange={(monthlyQuota) =>
            onUpdatePlanDraft(plan, { monthlyQuota })
          }
        />
        <Field
          id={`${plan}-model-selection-limit`}
          label="Modeles utilisables en meme temps"
          value={planDraft.modelSelectionLimit}
          type="number"
          min={0}
          step="1"
          helper="0 = illimite"
          onChange={(modelSelectionLimit) =>
            onUpdatePlanDraft(plan, { modelSelectionLimit })
          }
        />
        <Field
          id={`${plan}-monthly-model-change-limit`}
          label="Changements de modeles / mois"
          value={planDraft.monthlyModelChangeLimit}
          type="number"
          min={0}
          step="1"
          helper="0 = illimite"
          onChange={(monthlyModelChangeLimit) =>
            onUpdatePlanDraft(plan, { monthlyModelChangeLimit })
          }
        />
      </div>

      <ul className="my-6 space-y-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Check className="size-4 text-foreground" />
          {toPositiveInteger(planDraft.monthlyQuota, settings.monthlyQuota)} prompts app / mois
        </li>
        <li className="flex items-center gap-2">
          <Check className="size-4 text-foreground" />
          {modelLimit === 0 ? "Modeles illimites" : `${modelLimit} modeles simultanes`}
        </li>
      </ul>

      <Button type="submit" disabled={pending} className="w-full">
        <Save data-icon="inline-start" />
        {pending ? "Sauvegarde..." : "Sauver ce plan"}
      </Button>
    </form>
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
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 p-5">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-6 h-2 w-full" />
      </div>
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border/70 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-card p-5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="mt-4 h-12 w-40" />
            <div className="mt-6 space-y-4">
              {Array.from({ length: 4 }).map((__, fieldIndex) => (
                <div key={fieldIndex} className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
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
