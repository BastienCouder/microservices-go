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
import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";
import { appQueryKeys } from "@/lib/query-keys";
import {
  loadOrganizationSummaries,
  type OrganizationSummary,
} from "@/features/organizations/_lib/shared/organization-page-api";
import {
  deleteBillingPricingTier,
  loadBillingCreditCostSettings,
  loadBillingPlanSettings,
  loadBillingPricingTiers,
  syncStripePricingCatalog,
  updateBillingCreditCostSettings,
  updateBillingPlanSettings,
  updateBillingPricingTier,
  type BillingPlanCode,
  type BillingCreditCostSettings,
  type BillingCreditCostRule,
  type BillingPlanSettings,
  type BillingPricingTier,
  type BillingPriceMap,
} from "@/shared/billing";
import { getBillingPlanLabel } from "@/shared/billing-plan";
import { invalidateQueryKeys } from "@/shared/api/query-refresh";
import { cn } from "@/shared/utils";

type AdminPricingPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

type TierDraft = {
  promptVolume: string;
  label: string;
  prices: Record<string, string>;
};

type PlanLimitDraft = {
  monthlyQuota: string;
  modelSelectionLimit: string;
  monthlyModelChangeLimit: string;
  maxProjects: string;
};

type NewPricingDraft = PlanLimitDraft & {
  plan: string;
  promptVolume: string;
  label: string;
  price: string;
  prices: Record<string, string>;
};

type CreditCostRuleDraft = {
  minPricePerMillion: string;
  creditCost: string;
};

const CORE_PLAN_ORDER = ["developer", "starter", "growth", "pro"] as const;
const EMPTY_PLANS: BillingPlanSettings[] = [];
const EMPTY_TIERS: BillingPricingTier[] = [];

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

function normalizePlanCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .split(/\s+/)
    .filter(Boolean)
    .join("-");
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

function sortBillingPlans(plans: string[]) {
  const uniquePlans = Array.from(
    new Set(plans.map(normalizePlanCode).filter(Boolean)),
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

function emptyPriceDrafts(planKeys: string[], current?: Record<string, string>) {
  return Object.fromEntries(
    planKeys.map((plan) => [plan, current?.[plan] ?? ""]),
  );
}

function emptyPlanDraft(): PlanLimitDraft {
  return {
    monthlyQuota: "1",
    modelSelectionLimit: "0",
    monthlyModelChangeLimit: "0",
    maxProjects: "0",
  };
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
    isMostChosen: false,
  };
}

function defaultCreditCostSettingsDraft(): {
  defaultCreditCost: string;
  rules: CreditCostRuleDraft[];
} {
  return {
    defaultCreditCost: "1",
    rules: [
      { minPricePerMillion: "20", creditCost: "4" },
      { minPricePerMillion: "10", creditCost: "3" },
      { minPricePerMillion: "5", creditCost: "2" },
    ],
  };
}

function creditCostSettingsDraftFromSettings(settings: BillingCreditCostSettings) {
  return {
    defaultCreditCost: String(Math.max(1, settings.defaultCreditCost || 1)),
    rules: settings.rules.map((rule) => ({
      minPricePerMillion: String(rule.minPricePerMillion),
      creditCost: String(rule.creditCost),
    })),
  };
}

function normalizeCreditCostSettingsDraft(draft: {
  defaultCreditCost: string;
  rules: CreditCostRuleDraft[];
}): BillingCreditCostSettings {
  const rules = draft.rules
    .map((rule) => {
      const minPrice = Number.parseFloat(rule.minPricePerMillion.trim().replace(",", "."));
      const creditCost = Number.parseInt(rule.creditCost, 10);
      if (!Number.isFinite(minPrice) || minPrice < 0 || !Number.isFinite(creditCost) || creditCost <= 0) {
        return null;
      }
      return {
        minPricePerMillion: minPrice,
        creditCost,
      } satisfies BillingCreditCostRule;
    })
    .filter((rule): rule is BillingCreditCostRule => rule !== null)
    .sort((left, right) => right.minPricePerMillion - left.minPricePerMillion);

  return {
    defaultCreditCost: toPositiveInteger(draft.defaultCreditCost, 1),
    rules,
  };
}

function nextPromptVolume(tiers: BillingPricingTier[]) {
  const maxPromptVolume = Math.max(0, ...tiers.map((tier) => tier.promptVolume));
  if (maxPromptVolume <= 0) return 100;
  if (maxPromptVolume >= 5000) return maxPromptVolume + 1000;
  return maxPromptVolume * 2;
}

function emptyNewPricingDraft(
  tiers: BillingPricingTier[] = EMPTY_TIERS,
  planKeys: string[] = [],
): NewPricingDraft {
  return {
    plan: "",
    promptVolume: String(nextPromptVolume(tiers)),
    label: "",
    price: "",
    prices: emptyPriceDrafts(planKeys),
    ...emptyPlanDraft(),
  };
}

function tierDraftFromTier(tier: BillingPricingTier, planKeys: string[]): TierDraft {
  const prices = emptyPriceDrafts(planKeys);
  for (const plan of planKeys) {
    prices[plan] = centsToEuroString(tier.prices[plan] ?? null);
  }
  return {
    promptVolume: String(tier.promptVolume),
    label: tier.label,
    prices,
  };
}

function planLimitDraftFromSettings(settings: BillingPlanSettings): PlanLimitDraft {
  return {
    monthlyQuota: String(Math.max(1, settings.monthlyQuota || 1)),
    modelSelectionLimit: String(Math.max(0, settings.modelSelectionLimit)),
    monthlyModelChangeLimit: String(Math.max(0, settings.monthlyModelChangeLimit)),
    maxProjects: String(Math.max(0, settings.maxProjects)),
  };
}

function normalizeTierDraft(draft: TierDraft): BillingPricingTier {
  const promptVolume = toPositiveInteger(draft.promptVolume, 1);
  const prices = Object.fromEntries(
    Object.entries(draft.prices).map(([plan, value]) => [
      normalizePlanCode(plan),
      euroStringToNullableCents(value),
    ]),
  ) as BillingPriceMap;

  return {
    promptVolume,
    creditVolume: promptVolume,
    label: draft.label.trim() || formatPrompts(promptVolume),
    prices,
    developerPriceCents: prices.developer ?? null,
    starterPriceCents: prices.starter ?? null,
    growthPriceCents: prices.growth ?? null,
    proPriceCents: prices.pro ?? null,
  };
}

function normalizePlanLimitDraft(
  plan: BillingPlanCode,
  settings: BillingPlanSettings,
  draft: PlanLimitDraft,
): BillingPlanSettings {
  return {
    ...settings,
    plan,
    monthlyQuota: toPositiveInteger(draft.monthlyQuota, settings.monthlyQuota || 1),
    modelSelectionLimit: toNonNegativeInteger(draft.modelSelectionLimit),
    monthlyModelChangeLimit: toNonNegativeInteger(draft.monthlyModelChangeLimit),
    maxProjects: toNonNegativeInteger(draft.maxProjects),
  };
}

export function AdminPricingPage({ apiBaseURL }: AdminPricingPageProps) {
  const queryClient = useQueryClient();
  const [volumeIndex, setVolumeIndex] = useState(2);
  const [tierDrafts, setTierDrafts] = useState<Record<number, TierDraft>>({});
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanLimitDraft>>({});
  const [creditCostDraft, setCreditCostDraft] = useState(defaultCreditCostSettingsDraft);
  const [newPricingDraft, setNewPricingDraft] = useState<NewPricingDraft>(() =>
    emptyNewPricingDraft(),
  );

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
  const creditCostSettingsQueryKey = appQueryKeys.billingCreditCostSettings(
    apiBaseURL,
    organizationId,
  );

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
  const creditCostSettingsQuery = useQuery({
    queryKey: creditCostSettingsQueryKey,
    enabled: apiBaseURL.trim() !== "" && organizationId !== "",
    queryFn: ({ signal }) =>
      loadBillingCreditCostSettings(apiBaseURL, organizationId, { signal }),
  });

  const plans = plansQuery.data ?? EMPTY_PLANS;
  const tiers = tiersQuery.data ?? EMPTY_TIERS;
  const orderedPlans = useMemo(
    () =>
      sortBillingPlans([
        ...plans.map((plan) => plan.plan),
        ...tiers.flatMap((tier) => Object.keys(tier.prices)),
      ]),
    [plans, tiers],
  );
  const selectedTier = tiers[Math.min(volumeIndex, Math.max(0, tiers.length - 1))];
  const selectedTierDraft = selectedTier
    ? tierDrafts[selectedTier.promptVolume] ??
      tierDraftFromTier(selectedTier, orderedPlans)
    : null;
  const normalizedSelectedTier = selectedTierDraft
    ? normalizeTierDraft(selectedTierDraft)
    : null;

  const plansByID = useMemo(
    () => new Map(plans.map((plan) => [plan.plan, plan])),
    [plans],
  );

  useEffect(() => {
    if (!creditCostSettingsQuery.data) return;
    setCreditCostDraft(creditCostSettingsDraftFromSettings(creditCostSettingsQuery.data));
  }, [creditCostSettingsQuery.data]);

  useEffect(() => {
    setTierDrafts((current) => {
      const next = { ...current };
      for (const tier of tiers) {
        next[tier.promptVolume] = tierDraftFromTier(
          tier,
          orderedPlans.length > 0 ? orderedPlans : Object.keys(tier.prices),
        );
      }
      return next;
    });
  }, [orderedPlans, tiers]);

  useEffect(() => {
    if (plans.length === 0) return;
    setPlanDrafts((current) => {
      const next = { ...current };
      for (const plan of plans) {
        next[plan.plan] = current[plan.plan] ?? planLimitDraftFromSettings(plan);
      }
      return next;
    });
  }, [plans]);

  useEffect(() => {
    setNewPricingDraft((current) => ({
      ...current,
      promptVolume:
        current.promptVolume || String(nextPromptVolume(tiers)),
      prices: emptyPriceDrafts(orderedPlans, current.prices),
    }));
  }, [orderedPlans, tiers]);

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
      pushSuccessToast("Palier de tarification mis à jour.");
    },
    onError: (error) => {
      pushErrorToast(error, "Impossible de mettre à jour ce palier.");
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({
      plan,
      settings,
      tier,
    }: {
      plan: BillingPlanCode;
      settings: BillingPlanSettings;
      tier: BillingPricingTier;
      successMessage?: string;
    }) => {
      if (!organizationId) throw new Error("Organisation admin introuvable.");
      const updatedSettings = await updateBillingPlanSettings(apiBaseURL, {
        organizationId,
        ...settings,
      });
      await updateBillingPricingTier(apiBaseURL, {
        organizationId,
        ...tier,
      });
      return { plan, settings: updatedSettings, tier };
    },
    onSuccess: async (_result, variables) => {
      await invalidateQueryKeys(queryClient, [
        plansQueryKey,
        tiersQueryKey,
        ["billing", "quota", apiBaseURL],
        ["prompt-quota", apiBaseURL],
      ]);
      pushSuccessToast(
        variables.successMessage ?? "Plan et prix du palier mis à jour.",
      );
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

  const deleteTierMutation = useMutation({
    mutationFn: async (promptVolume: number) => {
      if (!organizationId) throw new Error("Organisation admin introuvable.");
      await deleteBillingPricingTier(apiBaseURL, organizationId, promptVolume);
      return promptVolume;
    },
    onSuccess: async (_promptVolume, deletedPromptVolume) => {
      await queryClient.invalidateQueries({ queryKey: tiersQueryKey });
      setVolumeIndex((current) => Math.max(0, Math.min(current, tiers.length - 2)));
      setTierDrafts((current) => {
        const next = { ...current };
        delete next[deletedPromptVolume];
        return next;
      });
      pushSuccessToast("Palier supprimé.");
    },
    onError: (error) => {
      pushErrorToast(error, "Impossible de supprimer ce palier.");
    },
  });

  const updateCreditCostSettingsMutation = useMutation({
    mutationFn: async (settings: BillingCreditCostSettings) => {
      if (!organizationId) throw new Error("Organisation admin introuvable.");
      return updateBillingCreditCostSettings(apiBaseURL, {
        organizationId,
        ...settings,
      });
    },
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        creditCostSettingsQueryKey,
        appQueryKeys.modelsCatalog(apiBaseURL, organizationId, "all"),
        appQueryKeys.modelsCatalog(apiBaseURL, "__onboarding__", "active"),
      ]);
      pushSuccessToast("Règles de crédits mises à jour.");
    },
    onError: (error) => {
      pushErrorToast(error, "Impossible de mettre à jour les règles de crédits.");
    },
  });

  const updateTierDraft = (patch: Partial<TierDraft>) => {
    if (!selectedTier) return;
    setTierDrafts((current) => ({
      ...current,
      [selectedTier.promptVolume]: {
        ...(current[selectedTier.promptVolume] ??
          tierDraftFromTier(selectedTier, orderedPlans)),
        ...patch,
      },
    }));
  };

  const updateTierDraftPrice = (plan: BillingPlanCode, value: string) => {
    if (!selectedTier) return;
    const fallback = tierDraftFromTier(selectedTier, orderedPlans);
    setTierDrafts((current) => ({
      ...current,
      [selectedTier.promptVolume]: {
        ...(current[selectedTier.promptVolume] ?? fallback),
        prices: {
          ...((current[selectedTier.promptVolume] ?? fallback).prices),
          [plan]: value,
        },
      },
    }));
  };

  const updatePlanDraft = (plan: BillingPlanCode, patch: Partial<PlanLimitDraft>) => {
    const settings = plansByID.get(plan) ?? emptyPlanSettings(plan);
    setPlanDrafts((current) => ({
      ...current,
      [plan]: {
        ...(current[plan] ?? planLimitDraftFromSettings(settings)),
        ...patch,
      },
    }));
  };

  const updateCreditCostRuleDraft = (index: number, patch: Partial<CreditCostRuleDraft>) => {
    setCreditCostDraft((current) => ({
      ...current,
      rules: current.rules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...patch } : rule,
      ),
    }));
  };

  const saveTier = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTier || !normalizedSelectedTier) return;
    const previousPromptVolume = selectedTier.promptVolume;
    if (
      previousPromptVolume !== normalizedSelectedTier.promptVolume &&
      tiers.some((tier) => tier.promptVolume === normalizedSelectedTier.promptVolume)
    ) {
      pushErrorToast(
        new Error("Palier déjà existant."),
        "Ce volume existe déjà. Choisis un volume libre pour modifier ce palier.",
      );
      return;
    }
    updateTierMutation.mutate(normalizedSelectedTier, {
      onSuccess: async () => {
        if (
          previousPromptVolume === normalizedSelectedTier.promptVolume ||
          !organizationId
        ) {
          return;
        }
        try {
          await deleteBillingPricingTier(apiBaseURL, organizationId, previousPromptVolume);
          await queryClient.invalidateQueries({ queryKey: tiersQueryKey });
          setTierDrafts((current) => {
            const next = { ...current };
            delete next[previousPromptVolume];
            return next;
          });
        } catch (error) {
          pushErrorToast(
            error,
            "Le nouveau palier est sauvegardé, mais l'ancien volume n'a pas pu être supprimé.",
          );
        }
      },
    });
  };

  const savePlan = (
    event: FormEvent<HTMLFormElement>,
    plan: BillingPlanCode,
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

  const markMostChosen = (plan: BillingPlanCode, settings: BillingPlanSettings) => {
    setMostChosenMutation.mutate({
      ...settings,
      ...(planDrafts[plan]
        ? normalizePlanLimitDraft(plan, settings, planDrafts[plan]!)
        : settings),
      plan,
      isMostChosen: true,
    });
  };

  const saveNewPricing = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const plan = normalizePlanCode(newPricingDraft.plan);
    if (!plan) {
      pushErrorToast(new Error("Plan invalide."), "Le code du plan est requis.");
      return;
    }
    if (orderedPlans.includes(plan)) {
      pushErrorToast(
        new Error("Plan déjà existant."),
        "Ce code plan existe déjà. Modifie sa carte ou choisis un autre code.",
      );
      return;
    }

    const priceCents = euroStringToNullableCents(newPricingDraft.price);
    if (priceCents === null) {
      pushErrorToast(
        new Error("Prix invalide."),
        "Le prix du nouveau plan sur ce palier est requis.",
      );
      return;
    }
    const newPlanPrice = centsToEuroString(priceCents);

    const promptVolume = toPositiveInteger(
      newPricingDraft.promptVolume,
      nextPromptVolume(tiers),
    );
    if (tiers.some((tier) => tier.promptVolume === promptVolume)) {
      pushErrorToast(
        new Error("Palier déjà existant."),
        "Ce volume de crédits existe déjà. Choisis un nouveau volume.",
      );
      return;
    }

    const settings = normalizePlanLimitDraft(
      plan,
      emptyPlanSettings(plan),
      newPricingDraft,
    );
    const tier = normalizeTierDraft({
      promptVolume: String(promptVolume),
      label: newPricingDraft.label,
      prices: {
        ...newPricingDraft.prices,
        [plan]: newPlanPrice,
      },
    });

    updatePlanMutation.mutate(
      {
        plan,
        settings,
        tier,
        successMessage: "Nouveau plan et nouveau palier créés.",
      },
      {
        onSuccess: (result) => {
          setNewPricingDraft(
            emptyNewPricingDraft([...tiers, result.tier], orderedPlans),
          );
        },
      },
    );
  };

  const saveCreditCostSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeCreditCostSettingsDraft(creditCostDraft);
    if (normalized.rules.length === 0) {
      pushErrorToast(
        new Error("Aucune règle valide."),
        "Ajoute au moins une règle de seuil valide.",
      );
      return;
    }
    updateCreditCostSettingsMutation.mutate(normalized);
  };

  const isLoading =
    organizationsQuery.isLoading ||
    plansQuery.isLoading ||
    tiersQuery.isLoading ||
    creditCostSettingsQuery.isLoading;
  const isFetching =
    organizationsQuery.isFetching ||
    plansQuery.isFetching ||
    tiersQuery.isFetching ||
    creditCostSettingsQuery.isFetching;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden md:p-4">
      <PageHeader
        title="Tarification admin"
        baseline="Gérez dynamiquement les paliers de crédits, les plans et les limites associées."
        actionsVariant="classic"
        className="mb-2 md:mb-3"
        meta={
          <>
            <Badge variant="default">{tiers.length} paliers</Badge>
            <Badge variant="outline">{orderedPlans.length} plans</Badge>
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
            <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
              <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
                <form
                  onSubmit={saveCreditCostSettings}
                  className="rounded-lg border border-border/70 bg-card p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                        Règles coût crédits
                      </p>
                      <h2 className="text-base font-semibold text-foreground">
                        Seuils OpenRouter
                      </h2>
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={updateCreditCostSettingsMutation.isPending}
                    >
                      {updateCreditCostSettingsMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
                    </Button>
                  </div>

                  <Field
                    id="credit-cost-default"
                    label="Crédits par défaut"
                    value={creditCostDraft.defaultCreditCost}
                    type="number"
                    min={1}
                    step="1"
                    helper="Utilisé si aucun prix input/output n'est disponible"
                    onChange={(defaultCreditCost) =>
                      setCreditCostDraft((current) => ({ ...current, defaultCreditCost }))
                    }
                  />

                  <div className="mt-3 space-y-2">
                    {creditCostDraft.rules.map((rule, index) => (
                      <div
                        key={`credit-rule-${index}`}
                        className="grid gap-2 rounded-md border border-border/70 p-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]"
                      >
                        <Field
                          id={`credit-rule-min-price-${index}`}
                          label="Prix min / 1M"
                          value={rule.minPricePerMillion}
                          type="number"
                          min={0}
                          step="0.01"
                          onChange={(minPricePerMillion) =>
                            updateCreditCostRuleDraft(index, { minPricePerMillion })
                          }
                        />
                        <Field
                          id={`credit-rule-cost-${index}`}
                          label="Crédits"
                          value={rule.creditCost}
                          type="number"
                          min={1}
                          step="1"
                          onChange={(creditCost) =>
                            updateCreditCostRuleDraft(index, { creditCost })
                          }
                        />
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            disabled={creditCostDraft.rules.length <= 1}
                            onClick={() =>
                              setCreditCostDraft((current) => ({
                                ...current,
                                rules: current.rules.filter((_, ruleIndex) => ruleIndex !== index),
                              }))
                            }
                          >
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCreditCostDraft((current) => ({
                          ...current,
                          rules: [
                            ...current.rules,
                            { minPricePerMillion: "0", creditCost: String(Math.max(1, Number.parseInt(current.defaultCreditCost, 10) || 1)) },
                          ],
                        }))
                      }
                    >
                      Ajouter une règle
                    </Button>
                  </div>
                </form>

                {selectedTier && selectedTierDraft && normalizedSelectedTier ? (
                  <form
                    onSubmit={saveTier}
                    className="rounded-lg border border-border/70 bg-card p-3"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                          Palier sélectionné
                        </p>
                        <h2 className="text-xl font-semibold text-primary">
                          {formatPrompts(normalizedSelectedTier.promptVolume)} crédits
                        </h2>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={deleteTierMutation.isPending}
                          onClick={() =>
                            deleteTierMutation.mutate(normalizedSelectedTier.promptVolume)
                          }
                        >
                          Supprimer
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={updateTierMutation.isPending}
                        >
                          {updateTierMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                        <Field
                          id="pricing-tier-label"
                          label="Label"
                          value={selectedTierDraft.label}
                          onChange={(label) => updateTierDraft({ label })}
                        />
                        <Field
                          id="pricing-tier-volume"
                          label="Crédits"
                          value={selectedTierDraft.promptVolume}
                          type="number"
                          min={1}
                          step="1"
                          onChange={(promptVolume) => updateTierDraft({ promptVolume })}
                        />
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
                      className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-foreground/10 accent-foreground"
                    />

                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      {tiers.map((tier, index) => {
                        const active = index === volumeIndex;
                        return (
                          <Button
                            key={tier.promptVolume}
                            type="button"
                            onClick={() => setVolumeIndex(index)}
                            className={cn(
                              "h-auto rounded-md border px-2 py-2 text-center transition-all",
                              active
                                ? "border-primary bg-primary text-background"
                                : "border-foreground/10 bg-transparent text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-primary",
                            )}
                          >
                            <div className="text-sm font-medium">{tier.label}</div>
                            <div className="mt-1 text-[10px] font-mono uppercase">
                              crédits
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </form>
                ) : (
                  <EmptyState label="Aucun palier pricing chargé pour le moment." />
                )}

                <form
                  onSubmit={saveNewPricing}
                  className="rounded-lg border border-dashed border-border/70 bg-card/60 p-3"
                >
                  <h2 className="mb-2 text-base font-semibold text-foreground">
                    Nouveau plan + palier
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                  <Field
                    id="new-pricing-plan-code"
                    label="Code plan"
                    value={newPricingDraft.plan}
                    helper="Exemple: agency-plus"
                    onChange={(plan) =>
                      setNewPricingDraft((current) => ({ ...current, plan }))
                    }
                  />
                  <Field
                    id="new-pricing-volume"
                    label="Crédits"
                    value={newPricingDraft.promptVolume}
                    type="number"
                    min={1}
                    step="1"
                    onChange={(promptVolume) =>
                      setNewPricingDraft((current) => ({ ...current, promptVolume }))
                    }
                  />
                  <Field
                    id="new-pricing-label"
                    label="Label"
                    value={newPricingDraft.label}
                    onChange={(label) =>
                      setNewPricingDraft((current) => ({ ...current, label }))
                    }
                  />
                  <Field
                    id="new-pricing-price"
                    label="Prix du nouveau plan (€)"
                    value={newPricingDraft.price}
                    type="number"
                    min={0}
                    step="0.01"
                    helper="Requis pour creer un prix exploitable"
                    onChange={(price) =>
                      setNewPricingDraft((current) => ({ ...current, price }))
                    }
                  />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Field
                    id="new-pricing-monthly-quota"
                    label="Crédits inclus / mois"
                    value={newPricingDraft.monthlyQuota}
                    type="number"
                    min={1}
                    step="1"
                    onChange={(monthlyQuota) =>
                      setNewPricingDraft((current) => ({
                        ...current,
                        monthlyQuota,
                      }))
                    }
                  />
                  <Field
                    id="new-pricing-model-limit"
                    label="Modeles utilisables en meme temps"
                    value={newPricingDraft.modelSelectionLimit}
                    type="number"
                    min={0}
                    step="1"
                    helper="0 = illimite"
                    onChange={(modelSelectionLimit) =>
                      setNewPricingDraft((current) => ({
                        ...current,
                        modelSelectionLimit,
                      }))
                    }
                  />
                  <Field
                    id="new-pricing-model-change-limit"
                    label="Changements de modeles / mois"
                    value={newPricingDraft.monthlyModelChangeLimit}
                    type="number"
                    min={0}
                    step="1"
                    helper="0 = illimite"
                    onChange={(monthlyModelChangeLimit) =>
                      setNewPricingDraft((current) => ({
                        ...current,
                        monthlyModelChangeLimit,
                      }))
                    }
                  />
                  <Field
                    id="new-pricing-max-projects"
                    label="Projets maximum"
                    value={newPricingDraft.maxProjects}
                    type="number"
                    min={0}
                    step="1"
                    helper="0 = illimite"
                    onChange={(maxProjects) =>
                      setNewPricingDraft((current) => ({
                        ...current,
                        maxProjects,
                      }))
                    }
                  />
                  </div>

                {orderedPlans.length > 0 ? (
                  <div className="mt-3 border-t border-border/70 pt-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
                      Prix optionnels
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {orderedPlans.map((plan) => (
                        <Field
                          key={plan}
                          id={`new-pricing-existing-price-${plan}`}
                          label={`Prix ${getBillingPlanLabel(plan)} (€)`}
                          value={newPricingDraft.prices[plan] ?? ""}
                          type="number"
                          min={0}
                          step="0.01"
                          helper="Vide = Sur devis / indisponible"
                          onChange={(value) =>
                            setNewPricingDraft((current) => ({
                              ...current,
                              prices: {
                                ...current.prices,
                                [plan]: value,
                              },
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex justify-end">
                  <Button type="submit" disabled={updatePlanMutation.isPending}>
                    {updatePlanMutation.isPending ? "Ajout..." : "Ajouter plan + palier"}
                  </Button>
                </div>
              </form>
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden">
                {selectedTier && selectedTierDraft && normalizedSelectedTier ? (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-foreground">
                          Plans et prix du palier
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {formatPrompts(normalizedSelectedTier.promptVolume)} crédits inclus
                        </p>
                      </div>
                    </div>
                    <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-4">
                      {orderedPlans.map((plan, index) => {
                        const settings = plansByID.get(plan) ?? emptyPlanSettings(plan);
                        return (
                          <PlanCard
                            key={plan}
                            index={index}
                            plan={plan}
                            settings={settings}
                            tier={normalizedSelectedTier}
                            tierPriceDraft={selectedTierDraft.prices[plan] ?? ""}
                            planDraft={planDrafts[plan] ?? planLimitDraftFromSettings(settings)}
                            pending={
                              updatePlanMutation.isPending &&
                              updatePlanMutation.variables?.plan === plan
                            }
                            stripePending={
                              syncStripeMutation.isPending &&
                              syncStripeMutation.variables === plan
                            }
                            stripeDisabled={
                              syncStripeMutation.isPending ||
                              updateTierMutation.isPending ||
                              updatePlanMutation.isPending
                            }
                            mostChosenPending={
                              setMostChosenMutation.isPending &&
                              setMostChosenMutation.variables?.plan === plan
                            }
                            onUpdateTierPrice={updateTierDraftPrice}
                            onUpdatePlanDraft={updatePlanDraft}
                            onSave={savePlan}
                            onSyncStripe={(targetPlan) =>
                              syncStripeMutation.mutate(targetPlan)
                            }
                            onMarkMostChosen={markMostChosen}
                          />
                        );
                      })}
                    </div>
                  </>
                ) : null}
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
  tierPriceDraft,
  planDraft,
  pending,
  stripePending,
  stripeDisabled,
  mostChosenPending,
  onUpdateTierPrice,
  onUpdatePlanDraft,
  onSave,
  onSyncStripe,
  onMarkMostChosen,
}: {
  index: number;
  plan: BillingPlanCode;
  settings: BillingPlanSettings;
  tier: BillingPricingTier;
  tierPriceDraft: string;
  planDraft: PlanLimitDraft;
  pending: boolean;
  stripePending: boolean;
  stripeDisabled: boolean;
  mostChosenPending: boolean;
  onUpdateTierPrice: (plan: BillingPlanCode, value: string) => void;
  onUpdatePlanDraft: (plan: BillingPlanCode, patch: Partial<PlanLimitDraft>) => void;
  onSave: (
    event: FormEvent<HTMLFormElement>,
    plan: BillingPlanCode,
    settings: BillingPlanSettings,
  ) => void;
  onSyncStripe: (plan: BillingPlanCode) => void;
  onMarkMostChosen: (plan: BillingPlanCode, settings: BillingPlanSettings) => void;
}) {
  const currentPrice = tier.prices[plan] ?? null;

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
          {formatPrice(currentPrice)}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatPrompts(tier.promptVolume)} crédits
        </span>
      </div>

      <div className="grid gap-2">
        <Field
          id={`${plan}-tier-price`}
          label="Prix du palier (€)"
          value={tierPriceDraft}
          type="number"
          min={0}
          step="0.01"
          helper="Vide = Sur devis / indisponible"
          onChange={(value) => onUpdateTierPrice(plan, value)}
        />
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <Field
          id={`${plan}-monthly-quota`}
          label="Crédits inclus / mois"
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
          label="Modèles simultanés"
          value={planDraft.modelSelectionLimit}
          type="number"
          min={0}
          step="1"
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
          onChange={(maxProjects) => onUpdatePlanDraft(plan, { maxProjects })}
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
