"use client";

import { useState, type KeyboardEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Input } from "@/components/ui/input";
import type { BrandCompetitor } from "@/lib/perception-data";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

export function CompetitorEditor({
  value,
  onChange,
}: {
  value: BrandCompetitor[];
  onChange: (next: BrandCompetitor[]) => void;
}) {
  const { t } = useScopedI18n("perception-brand-canon");
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
        <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{t("competitorsTitle")}</div>
        <p className="text-xs leading-5 text-muted-foreground">
          {t("competitorsDescription")}
        </p>
      </div>

      {value.length === 0 ? (
        <EmptyStateCard label={t("competitorsEmpty")} />
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
                placeholder={t("competitorNamePlaceholder")}
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
                placeholder={t("competitorWebsitePlaceholder")}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                aria-label={t("deleteCompetitor", {
                  name: competitor.name || t("deleteCompetitorFallback"),
                })}
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
          placeholder={t("competitorAddPlaceholder")}
        />
        <Input
          value={newWebsite}
          onChange={(event) => setNewWebsite(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("competitorWebsitePlaceholder")}
        />
        <Button type="button" variant="outline" onClick={addCompetitor}>
          <Plus className="mr-1 h-4 w-4" />
          {t("competitorAdd")}
        </Button>
      </div>
    </div>
  );
}
