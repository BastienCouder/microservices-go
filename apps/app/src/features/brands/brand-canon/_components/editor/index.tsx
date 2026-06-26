"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { appQueryKeys } from "@/lib/query-keys";
import { resolveRuntimeMode } from "@/lib/runtime-mode";
import type {
  BrandCanon,
  BrandCompetitor,
  PerceptionLoadResult,
  PerceptionViewData,
} from "@/features/perception/_lib/shared/perception-data";
import { invalidateQueryKeys } from "@/shared/api/query-refresh";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  readOptionalProjectTokenFromSearch,
  readOrganizationIdFromSearch,
  readSelectedOrganizationPublicID,
} from "@/shared/selection";
import { CompetitorEditor } from "./competitor-editor";
import { EditableListField } from "./editable-list-field";
import {
  buildBrandsLocation,
  saveBrandCanonProject,
  sanitizeList,
  syncCompetitors,
  validateCompetitors,
} from "../../_lib";

export function BrandCanonEditorPanel({
  initialData,
  apiBaseURL,
  routeSearch,
  canEdit,
}: {
  initialData: PerceptionViewData;
  apiBaseURL: string;
  routeSearch: string;
  canEdit: boolean;
}) {
  const { locale, t } = useScopedI18n("perception-brand-canon");
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [canonDraft, setCanonDraft] = useState<BrandCanon>(() => initialData.brandCanon);
  const [competitorsDraft, setCompetitorsDraft] = useState<BrandCompetitor[]>(() => initialData.competitors);
  const brandsLocation = buildBrandsLocation(location.search);
  const loadError = initialData.metadata.emptyStateLabel;
  const routeProjectToken = readOptionalProjectTokenFromSearch(routeSearch);
  const organizationId =
    readOrganizationIdFromSearch(routeSearch) || readSelectedOrganizationPublicID() || null;

  const update = <K extends keyof BrandCanon>(key: K, value: BrandCanon[K]) => {
    setCanonDraft((current) => ({ ...current, [key]: value }));
  };

  const patchPerceptionCache = (
    queryKey: ReturnType<typeof appQueryKeys.perception>,
    nextCanon: BrandCanon,
    nextCompetitors: BrandCompetitor[],
  ) => {
    queryClient.setQueryData<PerceptionLoadResult | undefined>(queryKey, (current) => {
      if (!current) return current;

      return {
        ...current,
        data: {
          ...current.data,
          brandCanon: {
            ...current.data.brandCanon,
            ...nextCanon,
            audience: [...nextCanon.audience],
            useCases: [...nextCanon.useCases],
            features: [...nextCanon.features],
            pricing: {
              ...current.data.brandCanon.pricing,
              ...nextCanon.pricing,
            },
          },
          competitors: nextCompetitors.map((competitor) => ({ ...competitor })),
        },
      };
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!initialData.metadata.projectId) {
        throw new Error(t("demoSaveMessage"));
      }

      const competitorError = validateCompetitors(competitorsDraft, locale);
      if (competitorError) {
        throw new Error(competitorError);
      }

      const nextCanon: BrandCanon = {
        ...canonDraft,
        audience: sanitizeList(canonDraft.audience),
        useCases: sanitizeList(canonDraft.useCases),
        features: sanitizeList(canonDraft.features),
      };
      const savedBrandCanon = await saveBrandCanonProject(initialData.metadata.projectId, nextCanon);
      await syncCompetitors(initialData.metadata.projectId, initialData.competitors, competitorsDraft);
      setCanonDraft((current) => ({
        ...current,
        ...savedBrandCanon,
        audience: sanitizeList(savedBrandCanon.audience ?? current.audience),
        useCases: sanitizeList(savedBrandCanon.useCases ?? current.useCases),
        features: sanitizeList(savedBrandCanon.features ?? current.features),
        pricing: { ...current.pricing, ...(savedBrandCanon.pricing ?? {}) },
      }));
      const runtimeMode = resolveRuntimeMode(routeSearch);
      const resolvedCanon: BrandCanon = {
        ...nextCanon,
        ...savedBrandCanon,
        audience: sanitizeList(savedBrandCanon.audience ?? nextCanon.audience),
        useCases: sanitizeList(savedBrandCanon.useCases ?? nextCanon.useCases),
        features: sanitizeList(savedBrandCanon.features ?? nextCanon.features),
        pricing: {
          ...nextCanon.pricing,
          ...(savedBrandCanon.pricing ?? {}),
        },
      };
      const normalizedCompetitors = competitorsDraft.map((competitor) => ({
        ...competitor,
        name: competitor.name.trim(),
        website: competitor.website.trim(),
      }));
      const perceptionKeys: Array<ReturnType<typeof appQueryKeys.perception>> = [
        appQueryKeys.perception(
          apiBaseURL,
          routeProjectToken ?? null,
          organizationId,
          runtimeMode,
        ),
      ];

      if (
        initialData.metadata.projectId &&
        routeProjectToken !== initialData.metadata.projectId
      ) {
        perceptionKeys.push(
          appQueryKeys.perception(
            apiBaseURL,
            initialData.metadata.projectId,
            organizationId,
            runtimeMode,
          ),
        );
      }

      for (const queryKey of perceptionKeys) {
        patchPerceptionCache(queryKey, resolvedCanon, normalizedCompetitors);
      }

      await invalidateQueryKeys(queryClient, [
        ...perceptionKeys,
        ["perception", apiBaseURL],
        ["monitoring", apiBaseURL],
      ]);
      pushSuccessToast(t("savedMessage"));
      navigate(brandsLocation);
    },
    onError: (error) => {
      pushErrorToast(
        error,
        error instanceof Error ? error.message : t("saveError"),
      );
    },
  });
  const isSaving = saveMutation.isPending;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title={t("editorPageTitle")}
        baseline={t("editorPageBaseline")}
        actionsVariant="classic"
        actions={
          <Button asChild variant="default">
            <Link to={brandsLocation}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("back")}
            </Link>
          </Button>
        }
      />

      {loadError ? (
        <EmptyStateCard label={loadError} className="mb-4 h-20 text-sm" />
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4">
          <Card className="rounded-tr-none">
            <CardContent className="space-y-4 pb-6">
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label={t("fieldBrand")}>
                    <Input disabled={!canEdit} value={canonDraft.brandName} onChange={(e) => update("brandName", e.target.value)} />
                  </Field>
                  <Field label={t("fieldIndustry")}>
                    <Input disabled={!canEdit} value={canonDraft.category} onChange={(e) => update("category", e.target.value)} />
                  </Field>
                </div>

                <Field label={t("fieldLongDescription")}>
                  <Textarea
                    value={canonDraft.positioning}
                    disabled={!canEdit}
                    onChange={(e) => update("positioning", e.target.value)}
                    className="min-h-[140px]"
                  />
                </Field>

                <div className="grid gap-4 xl:grid-cols-2">
                  <EditableListField
                    label={t("fieldUseCases")}
                    value={canonDraft.useCases}
                    onChange={(next) => update("useCases", next)}
                    placeholder={t("fieldUseCasesPlaceholder")}
                    addLabel={t("fieldUseCasesAdd")}
                    emptyLabel={t("fieldUseCasesEmpty")}
                    disabled={!canEdit}
                  />
                  <EditableListField
                    label={t("fieldKeyStrengths")}
                    value={canonDraft.features}
                    onChange={(next) => update("features", next)}
                    placeholder={t("fieldFeaturesPlaceholder")}
                    addLabel={t("fieldFeaturesAdd")}
                    emptyLabel={t("fieldFeaturesEmpty")}
                    disabled={!canEdit}
                  />
                </div>

                <CompetitorEditor value={competitorsDraft} onChange={setCompetitorsDraft} disabled={!canEdit} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="border-t px-2 pt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(brandsLocation)}
              disabled={isSaving}
            >
              {t("cancel")}
            </Button>
            {canEdit ? (
              <Button type="button" onClick={() => saveMutation.mutate()} disabled={isSaving}>
                {isSaving ? t("saving") : t("save")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldShell({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
      <label className="mb-2 block text-sm font-medium text-primary">{label}</label>
      {description ? (
        <p className="mb-3 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <FieldShell label={label} description={description}>
      {children}
    </FieldShell>
  );
}
