"use client";

import { useState, type KeyboardEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BrandCompetitor } from "@/lib/perception-data";

export function CompetitorEditor({
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
    if (!name) return;
    if (value.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())) {
      setNewName("");
      setNewWebsite("");
      return;
    }

    onChange([...value, { name, website }]);
    setNewName("");
    setNewWebsite("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
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
                onChange={(event) =>
                  onChange(
                    value.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, name: event.target.value } : item,
                    ),
                  )
                }
                placeholder="Nom du concurrent"
              />
              <Input
                value={competitor.website}
                onChange={(event) =>
                  onChange(
                    value.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, website: event.target.value } : item,
                    ),
                  )
                }
                placeholder="https://exemple.com"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
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
