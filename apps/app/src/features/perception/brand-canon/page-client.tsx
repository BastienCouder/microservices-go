"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/features/shared/view/page-header";
import { API_CONFIG, apiRoutes, buildApiPath } from "@/lib/api-config";
import type { BrandCanon, BrandCompetitor, PerceptionViewData } from "@/lib/perception-data";

type EditorTab = "brand" | "personas" | "competitors";

export function BrandCanonEditorPageClient({ initialData }: { initialData: PerceptionViewData }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [canonDraft, setCanonDraft] = useState<BrandCanon>(initialData.brandCanon);
  const [competitorsDraft, setCompetitorsDraft] = useState<BrandCompetitor[]>(() => initialData.competitors);
  const [activeTab, setActiveTab] = useState<EditorTab>(() => readEditorTab(location.search));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const update = <K extends keyof BrandCanon>(key: K, value: BrandCanon[K]) => {
    setCanonDraft((current) => ({ ...current, [key]: value }));
  };

  const handleTabChange = (nextValue: string) => {
    if (!isEditorTab(nextValue)) {
      return;
    }

    setActiveTab(nextValue);
    const params = new URLSearchParams(location.search.startsWith("?") ? location.search.slice(1) : location.search);
    params.set("tab", nextValue);
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
  };

  const handleSave = async () => {
    setMessage(null);
    if (!initialData.metadata.projectId) {
      setMessage("Mode démo : aucune sauvegarde serveur.");
      return;
    }

    const competitorError = validateCompetitors(competitorsDraft);
    if (competitorError) {
      setActiveTab("competitors");
      setMessage(competitorError);
      return;
    }

    setIsSaving(true);
    try {
      await patchJson(apiRoutes.projects.get(initialData.metadata.projectId), {
        brandName: canonDraft.brandName,
        brandDescription: canonDraft.positioning,
        industry: canonDraft.category,
      });
      await patchJson(apiRoutes.analysis.brandCanon(initialData.metadata.projectId), {
        brandName: canonDraft.brandName,
        category: canonDraft.category,
        positioning: canonDraft.positioning,
        audience: sanitizeList(canonDraft.audience),
        useCases: sanitizeList(canonDraft.useCases),
        features: sanitizeList(canonDraft.features),
      });
      await syncCompetitors(initialData.metadata.projectId, initialData.competitors, competitorsDraft);
      setMessage("Référentiel de marque enregistré.");
      navigate(0);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur de sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title="Référentiel de marque"
        baseline="Modifiez la source de vérité de la marque : positionnement, personas, cas d’usage, fonctionnalités et concurrents."
        actionsVariant="classic"
        actions={
          <Button asChild variant="default">
            <Link to={{ pathname: "/brands", search: buildBackSearch(location.search) }}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
        }
      />

      <Card className="rounded-tr-none">
        <CardHeader>
          <CardTitle>Champs éditables</CardTitle>
          <CardDescription>
            Les modifications enregistrées sont réutilisées dans les vues marque et perception.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
            <TabsList className="h-auto w-full justify-start rounded-xl bg-muted/50 p-1 sm:w-auto">
              <TabsTrigger value="brand" className="px-3 py-1.5 text-xs sm:text-sm">
                Marque
              </TabsTrigger>
              <TabsTrigger value="personas" className="px-3 py-1.5 text-xs sm:text-sm">
                Personas
              </TabsTrigger>
              <TabsTrigger value="competitors" className="px-3 py-1.5 text-xs sm:text-sm">
                Concurrents
              </TabsTrigger>
            </TabsList>

            <TabsContent value="brand" className="mt-0 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Field
                  label="Marque"
                  hint="Nom affiché dans les réponses IA et sur les vues de synthèse."
                >
                  <Input value={canonDraft.brandName} onChange={(e) => update("brandName", e.target.value)} />
                </Field>

                <Field
                  label="Catégorie"
                  hint="Secteur ou catégorie principale utilisée pour situer la marque."
                >
                  <Input value={canonDraft.category} onChange={(e) => update("category", e.target.value)} />
                </Field>
              </div>

              <Field
                label="Positionnement"
                hint="Description de référence qui explique clairement ce que fait la marque."
              >
                <Textarea
                  value={canonDraft.positioning}
                  onChange={(e) => update("positioning", e.target.value)}
                  className="min-h-[140px]"
                />
              </Field>

              <div className="grid gap-4 xl:grid-cols-2">
                <EditableListField
                  label="Cas d’usage prioritaires"
                  description="Les usages à faire ressortir dans les réponses IA."
                  value={canonDraft.useCases}
                  onChange={(next) => update("useCases", next)}
                  placeholder="Ajouter un cas d’usage"
                  addLabel="Ajouter le cas"
                  emptyLabel="Aucun cas d’usage saisi."
                />
                <EditableListField
                  label="Fonctionnalités clés"
                  description="Les fonctionnalités que la marque doit faire reconnaître immédiatement."
                  value={canonDraft.features}
                  onChange={(next) => update("features", next)}
                  placeholder="Ajouter une fonctionnalité"
                  addLabel="Ajouter la fonctionnalité"
                  emptyLabel="Aucune fonctionnalité saisie."
                />
              </div>
            </TabsContent>

            <TabsContent value="personas" className="mt-0">
              <EditableListField
                label="Personas cibles"
                description="Les audiences que la marque doit adresser et que les IA doivent savoir rattacher."
                value={canonDraft.audience}
                onChange={(next) => update("audience", next)}
                placeholder="Ajouter un persona"
                addLabel="Ajouter le persona"
                emptyLabel="Aucun persona saisi."
              />
            </TabsContent>

            <TabsContent value="competitors" className="mt-0">
              <CompetitorEditor value={competitorsDraft} onChange={setCompetitorsDraft} />
            </TabsContent>
          </Tabs>

          <Separator />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {message ?? "Sauvegarde du référentiel de marque et des concurrents."}
            </div>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </CardContent>
      </Card>
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

function EditableListField({
  label,
  description,
  value,
  onChange,
  placeholder,
  addLabel,
  emptyLabel,
}: {
  label: string;
  description: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
  emptyLabel: string;
}) {
  const [draft, setDraft] = useState("");
  const items = sanitizeList(value);

  const addItem = () => {
    const nextValue = draft.trim();
    if (!nextValue) {
      return;
    }

    if (items.some((item) => item.toLowerCase() === nextValue.toLowerCase())) {
      setDraft("");
      return;
    }

    onChange([...items, nextValue]);
    setDraft("");
  };

  const removeItem = (itemToRemove: string) => {
    onChange(items.filter((item) => item !== itemToRemove));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    addItem();
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/10 p-4">
      <div className="space-y-1">
        <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1.5 rounded-full px-3 py-1 font-normal">
              <span>{item}</span>
              <button
                type="button"
                onClick={() => removeItem(item)}
                className="rounded-full text-muted-foreground transition hover:text-foreground"
                aria-label={`Supprimer ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={addItem}>
          <Plus className="mr-1 h-4 w-4" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

function CompetitorEditor({
  value,
  onChange,
}: {
  value: BrandCompetitor[];
  onChange: (next: BrandCompetitor[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newWebsite, setNewWebsite] = useState("");

  const addCompetitor = () => {
    const name = newName.trim();
    const website = newWebsite.trim();
    if (!name) {
      return;
    }

    if (value.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())) {
      setNewName("");
      setNewWebsite("");
      return;
    }

    onChange([...value, { name, website }]);
    setNewName("");
    setNewWebsite("");
  };

  const updateCompetitor = (index: number, nextValue: Partial<BrandCompetitor>) => {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...nextValue } : item)));
  };

  const removeCompetitor = (index: number) => {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    addCompetitor();
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/10 p-4">
      <div className="space-y-1">
        <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Concurrents suivis</div>
        <p className="text-xs leading-5 text-muted-foreground">
          Ajoutez ou mettez à jour les concurrents utilisés dans les comparaisons et les analyses IA.
        </p>
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
          Aucun concurrent saisi.
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((competitor, index) => (
            <div
              key={competitor.id ?? `${competitor.name}-${index}`}
              className="grid gap-3 rounded-xl border border-border/60 bg-background/80 p-4 md:grid-cols-[1fr_1fr_auto]"
            >
              <Input
                value={competitor.name}
                onChange={(event) => updateCompetitor(index, { name: event.target.value })}
                placeholder="Nom du concurrent"
              />
              <Input
                value={competitor.website}
                onChange={(event) => updateCompetitor(index, { website: event.target.value })}
                placeholder="https://exemple.com"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeCompetitor(index)}
                aria-label={`Supprimer ${competitor.name || "ce concurrent"}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ajouter un concurrent"
        />
        <Input
          value={newWebsite}
          onChange={(event) => setNewWebsite(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://exemple.com"
        />
        <Button type="button" variant="outline" onClick={addCompetitor}>
          <Plus className="mr-1 h-4 w-4" />
          Ajouter le concurrent
        </Button>
      </div>
    </div>
  );
}

function sanitizeList(items: string[]): string[] {
  const seen = new Set<string>();
  const nextItems: string[] = [];

  for (const item of items) {
    const trimmed = item.trim();
    const lower = trimmed.toLowerCase();
    if (!trimmed || seen.has(lower)) {
      continue;
    }
    seen.add(lower);
    nextItems.push(trimmed);
  }

  return nextItems;
}

function validateCompetitors(competitors: BrandCompetitor[]): string | null {
  const seen = new Set<string>();

  for (const competitor of competitors) {
    const name = competitor.name.trim();
    if (!name) {
      return "Chaque concurrent doit avoir un nom ou être supprimé.";
    }

    const key = name.toLowerCase();
    if (seen.has(key)) {
      return "Chaque concurrent doit être unique.";
    }
    seen.add(key);
  }

  return null;
}

async function syncCompetitors(
  projectId: string,
  previousCompetitors: BrandCompetitor[],
  nextCompetitors: BrandCompetitor[],
): Promise<void> {
  const normalizedNext = nextCompetitors.map((competitor) => ({
    ...competitor,
    name: competitor.name.trim(),
    website: competitor.website.trim(),
  }));

  const previousById = new Map(
    previousCompetitors
      .filter((competitor): competitor is BrandCompetitor & { id: string } => Boolean(competitor.id))
      .map((competitor) => [competitor.id, competitor]),
  );
  const nextById = new Map(
    normalizedNext
      .filter((competitor): competitor is BrandCompetitor & { id: string } => Boolean(competitor.id))
      .map((competitor) => [competitor.id, competitor]),
  );

  const competitorsToDelete = previousCompetitors.filter((competitor): competitor is BrandCompetitor & { id: string } => {
    if (!competitor.id) {
      return false;
    }
    return !nextById.has(competitor.id);
  });
  const competitorsToCreate = normalizedNext.filter((competitor) => !competitor.id);
  const competitorsToUpdate = normalizedNext.filter((competitor) => {
    if (!competitor.id) {
      return false;
    }

    const previous = previousById.get(competitor.id);
    if (!previous) {
      return false;
    }

    return previous.name !== competitor.name || previous.website !== competitor.website;
  });

  for (const competitor of competitorsToUpdate) {
    await patchJson(apiRoutes.competitors.update(competitor.id!), {
      name: competitor.name,
      websiteUrl: competitor.website,
    });
  }

  for (const competitor of competitorsToDelete) {
    await deleteJson(apiRoutes.competitors.delete(competitor.id));
  }

  if (competitorsToCreate.length > 0) {
    await postJson(apiRoutes.projects.competitors(projectId), {
      competitors: competitorsToCreate.map((competitor) => ({
        name: competitor.name,
        websiteUrl: competitor.website,
      })),
    });
  }
}

function isEditorTab(value: string): value is EditorTab {
  return value === "brand" || value === "personas" || value === "competitors";
}

function readEditorTab(search: string): EditorTab {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const tab = params.get("tab");
  if (tab && isEditorTab(tab)) {
    return tab;
  }
  return "brand";
}

function buildBackSearch(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("tab");
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function deleteJson(path: string): Promise<void> {
  await requestJson(path, { method: "DELETE" });
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const base = API_CONFIG.BASE_URL?.trim();
  const url = base ? `${base}${buildApiPath(path)}` : buildApiPath(path);
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  const json = JSON.parse(text) as unknown;
  if (json && typeof json === "object" && "data" in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}
