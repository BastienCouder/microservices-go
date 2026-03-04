"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Save, Search } from "lucide-react";
import { DashboardDataProvider, type DashboardData, useDashboardData } from "@/hooks/use-dashboard-data";
import { resolveRuntimeContext, type RuntimeMode } from "@/lib/runtime-mode";
import { apiRoutes } from "@/lib/api-config";
import { apiFetchRuntimeJson } from "@/lib/runtime-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type ModelsClientProps = {
  initialData: DashboardData;
  initialMode: RuntimeMode;
  initialProjectId: string | null;
};

type ProjectModelApiItem = {
  id: string;
  name: string;
  label?: string;
  provider?: string;
  modelId?: string;
  isActive?: boolean;
  supportsLiveSearch?: boolean;
  isEnabledForProject?: boolean;
};

type ApiEnvelope<T> = { success?: boolean; data?: T };

export function ModelsClient({ initialData, initialMode, initialProjectId }: ModelsClientProps) {
  return (
    <DashboardDataProvider
      initialData={initialData}
      initialMode={initialMode}
      initialProjectId={initialProjectId}
    >
      <ModelsWorkspace initialProjectId={initialProjectId} />
    </DashboardDataProvider>
  );
}

function ModelsWorkspace({ initialProjectId }: { initialProjectId: string | null }) {
  const runtime = useMemo(() => resolveRuntimeContext(), []);
  const { data } = useDashboardData();
  const projectId = runtime.projectId || initialProjectId;
  const brandName = data.project.name || "Brand";

  const [items, setItems] = useState<ProjectModelApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setError("Aucun projectId actif.");
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetchRuntimeJson<ApiEnvelope<ProjectModelApiItem[]>>({
          projectPath: () => apiRoutes.projects.models(projectId),
          demoPath: apiRoutes.projects.models(projectId),
          mode: "project",
          projectId,
        });
        const nextItems = res?.data ?? [];
        if (cancelled) return;
        setItems(nextItems);
        setSelected(nextItems.filter((item) => item.isEnabledForProject).map((item) => item.id));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      `${item.label || item.name} ${item.provider || ""} ${item.name}`.toLowerCase().includes(q),
    );
  }, [items, search]);

  const toggleModel = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const saveSelection = async () => {
    if (!projectId) return;
    try {
      setSaving(true);
      setError(null);
      await apiFetchRuntimeJson<ApiEnvelope<{ count: number }>>({
        projectPath: () => apiRoutes.projects.models(projectId),
        demoPath: apiRoutes.projects.models(projectId),
        mode: "project",
        projectId,
        init: {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelIds: selected }),
        },
      });
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          isEnabledForProject: selected.includes(item.id),
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-auto p-2 md:p-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <Card className="rounded-md">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BrainCircuit className="h-5 w-5" />
                  Modeles IA
                </CardTitle>
                <CardDescription>
                  Choisissez quels modeles IA sont actives pour {brandName}. La selection est stockee en base (`project_models`).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selected.length} actifs</Badge>
                {projectId ? <Badge variant="secondary">{projectId}</Badge> : null}
                <Button onClick={saveSelection} disabled={saving || loading || !projectId} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-sm">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un modèle (provider, label...)"
                  className="pl-8"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelected(items.filter((i) => i.isActive !== false).map((i) => i.id))}>
                  Tout activer
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelected([])}>
                  Tout désactiver
                </Button>
              </div>
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {loading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-24 animate-pulse rounded-md border bg-muted/30" />
                  ))
                : filteredItems.map((model) => {
                    const checked = selected.includes(model.id);
                    return (
                      <label
                        key={model.id}
                        className="flex cursor-pointer items-start justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-muted/20"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{model.label || model.name}</span>
                            {model.provider ? <Badge variant="outline" className="text-[10px]">{model.provider}</Badge> : null}
                            {model.supportsLiveSearch ? (
                              <Badge variant="secondary" className="text-[10px]">Live search</Badge>
                            ) : null}
                            {model.isActive === false ? (
                              <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{model.name}</p>
                        </div>
                        <div className="flex items-center gap-2 pt-0.5">
                          <Label htmlFor={`model-${model.id}`} className="sr-only">
                            {model.label || model.name}
                          </Label>
                          <Switch
                            id={`model-${model.id}`}
                            checked={checked}
                            onCheckedChange={() => toggleModel(model.id)}
                            disabled={model.isActive === false}
                          />
                        </div>
                      </label>
                    );
                  })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
