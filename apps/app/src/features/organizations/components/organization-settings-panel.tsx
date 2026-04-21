"use client";

import { AlertTriangle, ShieldCheck, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MonitoringSectionTitle } from "@/features/monitoring/_components/shared/monitoring-section-title";
import type { OrganizationSummary } from "./types";

export function OrganizationSettingsPanel({
  selectedOrganization,
  canManageOrganizationSettings,
  canDeleteOrganization,
  editedName,
  onEditedNameChange,
  isUpdatingName,
  onUpdateName,
  showDeleteConfirm,
  onShowDeleteConfirm,
  deleteConfirmName,
  onDeleteConfirmNameChange,
  isDeleting,
  onDeleteOrganization,
  onCancelDelete,
}: {
  selectedOrganization: OrganizationSummary | null;
  canManageOrganizationSettings: boolean;
  canDeleteOrganization: boolean;
  editedName: string;
  onEditedNameChange: (value: string) => void;
  isUpdatingName: boolean;
  onUpdateName: () => void;
  showDeleteConfirm: boolean;
  onShowDeleteConfirm: (value: boolean) => void;
  deleteConfirmName: string;
  onDeleteConfirmNameChange: (value: string) => void;
  isDeleting: boolean;
  onDeleteOrganization: () => void;
  onCancelDelete: () => void;
}) {
  if (!selectedOrganization) {
    return (
      <Card className="border border-dashed border-border/60 bg-muted/20">
        <CardContent className="flex min-h-[260px] items-center justify-center">
          <div className="flex max-w-md flex-col gap-2 text-center">
            <p className="text-base font-medium">Aucune organisation sélectionnée</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Choisissez une organisation pour modifier son nom ou ouvrir la zone sensible.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isNameUnchanged = editedName.trim() === selectedOrganization.name;
  const hasDeleteNameMismatch = deleteConfirmName.trim() !== "" && deleteConfirmName.trim() !== selectedOrganization.name;

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card className="border border-border/60">
        <CardHeader className="gap-2">
          <CardTitle className="text-base">
            <MonitoringSectionTitle>Réglages</MonitoringSectionTitle>
          </CardTitle>
          <CardDescription>Modifiez le nom affiché et gardez un accès rapide à la zone sensible.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Org {selectedOrganization.id}</Badge>
            <Badge variant={selectedOrganization.role === "owner" ? "default" : selectedOrganization.role === "admin" ? "secondary" : "outline"}>
              {selectedOrganization.role}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <ShieldCheck aria-hidden="true" className="size-3.5" />
              {canManageOrganizationSettings ? "Modification autorisée" : "Lecture seule"}
            </Badge>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="organization-name">Nom de l’organisation</FieldLabel>
              <Input
                id="organization-name"
                value={editedName}
                onChange={(event) => onEditedNameChange(event.target.value)}
                disabled={!canManageOrganizationSettings}
              />
              {!canManageOrganizationSettings ? (
                <FieldDescription>Vous devez être owner ou admin pour modifier ce nom.</FieldDescription>
              ) : (
                <FieldDescription>Le nouveau nom sera visible partout dans l’application.</FieldDescription>
              )}
            </Field>
          </FieldGroup>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={onUpdateName}
              disabled={!canManageOrganizationSettings || isUpdatingName || isNameUnchanged}
            >
              {isUpdatingName ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-destructive/20 bg-destructive/5">
        <CardHeader className="gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="size-4 text-destructive" />
            <CardTitle>Zone sensible</CardTitle>
          </div>
          <CardDescription>
            La suppression est irréversible. Les membres, invitations et accès associés deviennent indisponibles.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!canDeleteOrganization ? (
            <div className="rounded-xl border border-destructive/20 bg-background/80 p-4 text-sm leading-6 text-muted-foreground">
              Seul le owner de l’organisation peut lancer cette suppression.
            </div>
          ) : !showDeleteConfirm ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="destructive" onClick={() => onShowDeleteConfirm(true)}>
                <Trash2 data-icon="inline-start" />
                Supprimer l’organisation
              </Button>
              <Badge variant="outline">Confirmation du owner requise</Badge>
            </div>
          ) : (
            <>
              <FieldGroup>
                <Field data-invalid={hasDeleteNameMismatch || undefined}>
                  <FieldLabel htmlFor="delete-organization-confirmation">Confirmer le nom</FieldLabel>
                  <Input
                    id="delete-organization-confirmation"
                    value={deleteConfirmName}
                    onChange={(event) => onDeleteConfirmNameChange(event.target.value)}
                    placeholder={selectedOrganization.name}
                    aria-invalid={hasDeleteNameMismatch || undefined}
                  />
                  <FieldDescription>
                    Tapez <span className="font-medium text-foreground">{selectedOrganization.name}</span> pour confirmer.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="destructive" disabled={isDeleting} onClick={onDeleteOrganization}>
                  {isDeleting ? "Suppression..." : "Confirmer la suppression"}
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelDelete}>
                  Annuler
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
