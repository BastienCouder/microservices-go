"use client";

import { memo } from "react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamMembersPanel } from "../../team/team-client";
import { OrganizationSettingsPanel } from "./organization-settings-panel";
import type { OrganizationSummary, OrganizationTab } from "./types";

export function OrganizationsMainPanel({
  activeTab,
  onTabChange,
  selectedOrganization,
  selectedOrganizationId,
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
  activeTab: OrganizationTab;
  onTabChange: (tab: OrganizationTab) => void;
  selectedOrganization: OrganizationSummary | null;
  selectedOrganizationId: string;
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
    <div className="min-h-0 flex-1 overflow-hidden pr-1">
      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as OrganizationTab)}
        className="flex h-full min-h-0 flex-col"
      >
        <div className="shrink-0">
          <h2 className="text-xl font-semibold">{selectedOrganization?.name || "No organization selected"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedOrganization
              ? "Manage members, invitations and settings from one place."
              : "Select an organization in the left panel."}
          </p>
          <TabsList className="mt-4 h-auto w-fit gap-5 rounded-none bg-transparent p-0">
            <TabsTrigger
              value="members"
              className="relative h-auto rounded-none px-0 pb-2 pt-0 text-sm font-medium text-muted-foreground transition-colors duration-200 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:after:scale-x-100"
            >
              Members
            </TabsTrigger>
            <TabsTrigger
              value="invitations"
              className="relative h-auto rounded-none px-0 pb-2 pt-0 text-sm font-medium text-muted-foreground transition-colors duration-200 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:after:scale-x-100"
            >
              Invitations
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="relative h-auto rounded-none px-0 pb-2 pt-0 text-sm font-medium text-muted-foreground transition-colors duration-200 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:after:scale-x-100"
            >
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <Separator className="my-4 shrink-0" />

        <TabsContent
          value="members"
          className="mt-0 min-h-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]"
        >
          <MemoizedTeamPanel selectedOrganizationId={selectedOrganizationId} section="members" />
        </TabsContent>

        <TabsContent
          value="invitations"
          className="mt-0 min-h-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]"
        >
          <MemoizedTeamPanel selectedOrganizationId={selectedOrganizationId} section="invitations" />
        </TabsContent>

        <TabsContent
          value="settings"
          className="mt-0 min-h-0 flex-1 overflow-y-auto"
        >
          <OrganizationSettingsPanel
            selectedOrganization={selectedOrganization}
            canManageOrganizationSettings={canManageOrganizationSettings}
            canDeleteOrganization={canDeleteOrganization}
            editedName={editedName}
            onEditedNameChange={onEditedNameChange}
            isUpdatingName={isUpdatingName}
            onUpdateName={onUpdateName}
            showDeleteConfirm={showDeleteConfirm}
            onShowDeleteConfirm={onShowDeleteConfirm}
            deleteConfirmName={deleteConfirmName}
            onDeleteConfirmNameChange={onDeleteConfirmNameChange}
            isDeleting={isDeleting}
            onDeleteOrganization={onDeleteOrganization}
            onCancelDelete={onCancelDelete}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const MemoizedTeamPanel = memo(function MemoizedTeamPanel({
  selectedOrganizationId,
  section,
}: {
  selectedOrganizationId: string;
  section: "members" | "invitations";
}) {
  if (!selectedOrganizationId) {
    return <p className="text-sm text-muted-foreground">No organization selected.</p>;
  }

  return (
    <TeamMembersPanel
      key={selectedOrganizationId}
      embedded
      section={section}
      forcedOrganizationId={selectedOrganizationId}
      showOrganizationSelector={false}
    />
  );
});
