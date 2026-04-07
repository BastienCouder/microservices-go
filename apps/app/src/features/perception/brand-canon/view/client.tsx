"use client";

import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/features/shared/view/page-header";
import { appQueryKeys } from "@/lib/query-keys";
import { resolveRuntimeMode } from "@/lib/runtime-mode";
import type { BrandCanon, BrandCompetitor, PerceptionViewData } from "@/lib/perception-data";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { CompetitorEditor, EditableListField } from "../_components";
import {
  buildBackSearch,
  isEditorTab,
  readEditorTab,
  saveBrandCanonProject,
  sanitizeList,
  syncCompetitors,
  validateCompetitors,
  type EditorTab,
} from "../_lib";

export function BrandCanonEditorPageClient({
  initialData,
  apiBaseURL,
  routeSearch,
}: {
  initialData: PerceptionViewData;
  apiBaseURL: string;
  routeSearch: string;
}) {
  const { locale, t } = useScopedI18n("perception-brand-canon");
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [canonDraft, setCanonDraft] = useState<BrandCanon>(initialData.brandCanon);
  const [competitorsDraft, setCompetitorsDraft] = useState<BrandCompetitor[]>(() => initialData.competitors);
  const [activeTab, setActiveTab] = useState<EditorTab>(() => readEditorTab(location.search));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const update = <K extends keyof BrandCanon>(key: K, value: BrandCanon[K]) => {
    setCanonDraft((current) => ({ ...current, [key]: value }));
  };

  const handleTabChange = (nextValue: string) => {
    if (!isEditorTab(nextValue)) return;
    setActiveTab(nextValue);
    const params = new URLSearchParams(location.search.startsWith("?") ? location.search.slice(1) : location.search);
    params.set("tab", nextValue);
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
  };

  const handleSave = async () => {
    setMessage(null);
    if (!initialData.metadata.projectId) {
      setMessage(t("demoSaveMessage"));
      return;
    }

    const competitorError = validateCompetitors(competitorsDraft, locale);
    if (competitorError) {
      setActiveTab("competitors");
      setMessage(competitorError);
      return;
    }

    setIsSaving(true);
    try {
      const savedBrandCanon = await saveBrandCanonProject(initialData.metadata.projectId, {
        ...canonDraft,
        audience: sanitizeList(canonDraft.audience),
        useCases: sanitizeList(canonDraft.useCases),
        features: sanitizeList(canonDraft.features),
      });
      await syncCompetitors(initialData.metadata.projectId, initialData.competitors, competitorsDraft);
      setCanonDraft((current) => ({
        ...current,
        ...savedBrandCanon,
        audience: sanitizeList(savedBrandCanon.audience ?? current.audience),
        useCases: sanitizeList(savedBrandCanon.useCases ?? current.useCases),
        features: sanitizeList(savedBrandCanon.features ?? current.features),
        pricing: { ...current.pricing, ...(savedBrandCanon.pricing ?? {}) },
      }));
      await queryClient.invalidateQueries({
        queryKey: appQueryKeys.perception(
          apiBaseURL,
          initialData.metadata.projectId ?? null,
          resolveRuntimeMode(routeSearch),
        ),
      });
      setMessage(t("savedMessage"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title={t("editorPageTitle")}
        baseline={t("editorPageBaseline")}
        actionsVariant="classic"
        actions={
          <Button asChild variant="default">
            <Link to={{ pathname: "/brands", search: buildBackSearch(location.search) }}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("back")}
            </Link>
          </Button>
        }
      />

      <ScrollArea className="mt-4 min-h-0 flex-1 pr-2 [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
        <div className="space-y-4">
          <Card className="rounded-tr-none">
            <CardHeader>
              <CardTitle>{t("editableFieldsTitle")}</CardTitle>
              <CardDescription>
                {t("editableFieldsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-6">
              <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4 flex-col">
                <TabsList className="h-auto w-full justify-start rounded-xl bg-muted/50 p-1 sm:w-auto">
                  <TabsTrigger value="brand" className="px-3 py-1.5 text-xs sm:text-sm">{t("tabBrand")}</TabsTrigger>
                  <TabsTrigger value="competitors" className="px-3 py-1.5 text-xs sm:text-sm">{t("tabCompetitors")}</TabsTrigger>
                </TabsList>

                <TabsContent value="brand" className="mt-0 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label={t("fieldBrand")} hint={t("fieldBrandHint")}>
                      <Input value={canonDraft.brandName} onChange={(e) => update("brandName", e.target.value)} />
                    </Field>
                    <Field label={t("fieldCategory")} hint={t("fieldCategoryHint")}>
                      <Input value={canonDraft.category} onChange={(e) => update("category", e.target.value)} />
                    </Field>
                  </div>

                  <Field label={t("fieldPositioning")} hint={t("fieldPositioningHint")}>
                    <Textarea
                      value={canonDraft.positioning}
                      onChange={(e) => update("positioning", e.target.value)}
                      className="min-h-[140px]"
                    />
                  </Field>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <EditableListField
                      label={t("fieldUseCases")}
                      description={t("fieldUseCasesDescription")}
                      value={canonDraft.useCases}
                      onChange={(next) => update("useCases", next)}
                      placeholder={t("fieldUseCasesPlaceholder")}
                      addLabel={t("fieldUseCasesAdd")}
                      emptyLabel={t("fieldUseCasesEmpty")}
                    />
                    <EditableListField
                      label={t("fieldFeatures")}
                      description={t("fieldFeaturesDescription")}
                      value={canonDraft.features}
                      onChange={(next) => update("features", next)}
                      placeholder={t("fieldFeaturesPlaceholder")}
                      addLabel={t("fieldFeaturesAdd")}
                      emptyLabel={t("fieldFeaturesEmpty")}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="competitors" className="mt-0">
                  <CompetitorEditor value={competitorsDraft} onChange={setCompetitorsDraft} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <div className="border-t px-2 pt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {message ?? t("footerDefaultMessage")}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ pathname: "/brands", search: buildBackSearch(location.search) })}
              disabled={isSaving}
            >
              {t("cancel")}
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-4">
      <label className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <FieldShell label={label}>
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      {children}
    </FieldShell>
  );
}
