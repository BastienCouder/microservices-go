"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  return (
    <Card className="border-0 p-2 shadow-none">
      <CardHeader className="px-0">
        <CardTitle>Organization Settings</CardTitle>
        <CardDescription>
          {selectedOrganization
            ? `Update ${selectedOrganization.name} or delete it permanently.`
            : "Select an organization to manage settings."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-0">
        {!selectedOrganization ? (
          <p className="text-sm text-muted-foreground">No organization selected.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Organization name</label>
              <div className="flex gap-2">
                <Input value={editedName} onChange={(event) => onEditedNameChange(event.target.value)} />
                <Button
                  size="sm"
                  onClick={onUpdateName}
                  disabled={!canManageOrganizationSettings || isUpdatingName || editedName.trim() === selectedOrganization.name}
                >
                  {isUpdatingName ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">Danger zone</p>
              <p className="mt-1 text-xs text-red-600">
                Deleting an organization is irreversible. All memberships and invites become inaccessible.
              </p>
              {!canDeleteOrganization ? (
                <p className="mt-3 text-xs text-red-700">
                  Only the organization owner can delete this organization.
                </p>
              ) : !showDeleteConfirm ? (
                <Button
                  size="sm"
                  variant="destructive"
                  className="mt-3"
                  onClick={() => onShowDeleteConfirm(true)}
                >
                  Delete organization
                </Button>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-red-700">
                    Type <span className="font-semibold">{selectedOrganization.name}</span> to confirm.
                  </p>
                  <Input
                    value={deleteConfirmName}
                    onChange={(event) => onDeleteConfirmNameChange(event.target.value)}
                    placeholder={selectedOrganization.name}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" disabled={isDeleting} onClick={onDeleteOrganization}>
                      {isDeleting ? "Deleting..." : "Confirm delete"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onCancelDelete}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
