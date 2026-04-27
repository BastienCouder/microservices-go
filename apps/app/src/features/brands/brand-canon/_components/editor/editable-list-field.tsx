"use client";

import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Input } from "@/components/ui/input";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { sanitizeList } from "../../_lib/brand-canon-utils";

export function EditableListField({
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
  const { t } = useScopedI18n("perception-brand-canon");
  const [draft, setDraft] = useState("");
  const items = sanitizeList(value);

  const addItem = () => {
    const nextValue = draft.trim();
    if (!nextValue) return;
    if (items.some((item) => item.toLowerCase() === nextValue.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...items, nextValue]);
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
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
        <EmptyStateCard label={emptyLabel} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1.5 rounded-full px-3 py-1 font-normal">
              <span>{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((entry) => entry !== item))}
                className="rounded-full text-muted-foreground transition hover:text-foreground"
                aria-label={t("removeItem", { item })}
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
