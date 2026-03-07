"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { API_CONFIG, apiRoutes, buildApiPath } from "@/lib/api-config";
import type { BrandCanon, PerceptionViewData } from "@/lib/perception-data";

export function BrandCanonEditorPageClient({ initialData }: { initialData: PerceptionViewData }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [canonDraft, setCanonDraft] = useState<BrandCanon>(initialData.brandCanon);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const update = <K extends keyof BrandCanon>(key: K, value: BrandCanon[K]) => {
    setCanonDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    setMessage(null);
    if (!initialData.metadata.projectId) {
      setMessage("Mode demo: aucune sauvegarde serveur.");
      return;
    }

    setIsSaving(true);
    try {
      await patchJson(apiRoutes.analysis.brandCanon(initialData.metadata.projectId), {
        brandName: canonDraft.brandName,
        category: canonDraft.category,
        positioning: canonDraft.positioning,
        audience: canonDraft.audience,
        useCases: canonDraft.useCases,
        pricing: canonDraft.pricing,
        features: canonDraft.features,
      });
      setMessage("Brand Canon enregistré.");
      navigate(0);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur de sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-0 my-0 grid grid-cols-12 gap-0 md:m-4 xl:h-full xl:min-h-0">
      <div className="col-span-12 xl:col-span-8 xl:col-start-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={{ pathname: "/perception", search: location.search }}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour Perception
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{canonDraft.brandName}</Badge>
                <Badge variant={initialData.metadata.projectId ? "default" : "outline"}>
                  {initialData.metadata.projectId ? "Projet" : "Demo"}
                </Badge>
              </div>
            </div>
            <CardTitle>Brand Canon Editor</CardTitle>
            <CardDescription>
              Editez la source de vérité de la marque (catégorie, audience, use cases, pricing, features).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Marque">
              <Input value={canonDraft.brandName} onChange={(e) => update("brandName", e.target.value)} />
            </Field>

            <Field label="Catégorie">
              <Input value={canonDraft.category} onChange={(e) => update("category", e.target.value)} />
            </Field>

            <Field label="Positioning">
              <Textarea
                value={canonDraft.positioning}
                onChange={(e) => update("positioning", e.target.value)}
                className="min-h-[110px]"
              />
            </Field>

            <TagField label="Audience" value={canonDraft.audience} onChange={(next) => update("audience", next)} />
            <TagField label="Use Cases" value={canonDraft.useCases} onChange={(next) => update("useCases", next)} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Prix">
                <Input
                  type="number"
                  min={0}
                  value={canonDraft.pricing.amount}
                  onChange={(e) =>
                    setCanonDraft((current) => ({
                      ...current,
                      pricing: { ...current.pricing, amount: Number(e.target.value || 0) },
                    }))
                  }
                />
              </Field>
              <Field label="Devise">
                <Input
                  value={canonDraft.pricing.currency}
                  onChange={(e) =>
                    setCanonDraft((current) => ({
                      ...current,
                      pricing: { ...current.pricing, currency: e.target.value as BrandCanon["pricing"]["currency"] },
                    }))
                  }
                />
              </Field>
              <Field label="Période">
                <Input
                  value={canonDraft.pricing.period}
                  onChange={(e) =>
                    setCanonDraft((current) => ({
                      ...current,
                      pricing: { ...current.pricing, period: e.target.value as BrandCanon["pricing"]["period"] },
                    }))
                  }
                />
              </Field>
            </div>

            <Field label="Note pricing">
              <Input
                value={canonDraft.pricing.note ?? ""}
                onChange={(e) =>
                  setCanonDraft((current) => ({
                    ...current,
                    pricing: { ...current.pricing, note: e.target.value },
                  }))
                }
              />
            </Field>

            <TagField label="Features" value={canonDraft.features} onChange={(next) => update("features", next)} />

            <Separator />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                {message ?? "Sauvegarde via PATCH /analysis/projects/:projectId/brand-canon"}
              </div>
              <Button onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}

function TagField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <Field label={label}>
      <Textarea
        value={value.join(", ")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean),
          )
        }
        className="min-h-[84px]"
      />
    </Field>
  );
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const base = API_CONFIG.BASE_URL?.trim();
  const url = base ? `${base}${buildApiPath(path)}` : buildApiPath(path);
  const res = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const json = (await res.json()) as { data?: T; message?: string };
  if (json?.data) return json.data;
  throw new Error(json?.message || "Réponse API invalide");
}
