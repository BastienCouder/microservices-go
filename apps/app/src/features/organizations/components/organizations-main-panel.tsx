import { memo } from "react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OrganizationInvitation, OrganizationMember } from "@/shared/models";
import { formatDateTime } from "@/shared/utils";
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
  members,
  invitations,
  teamsByID,
  loading,
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
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
  teamsByID: Map<number, string>;
  loading: boolean;
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
          <MemoizedMembersPanel
            loading={loading}
            members={members}
            selectedOrganizationId={selectedOrganizationId}
            teamsByID={teamsByID}
          />
        </TabsContent>

        <TabsContent
          value="invitations"
          className="mt-0 min-h-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]"
        >
          <MemoizedInvitationsPanel
            invitations={invitations}
            loading={loading}
            selectedOrganizationId={selectedOrganizationId}
          />
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

const MemoizedMembersPanel = memo(function MemoizedMembersPanel({
  selectedOrganizationId,
  members,
  teamsByID,
  loading,
}: {
  selectedOrganizationId: string;
  members: OrganizationMember[];
  teamsByID: Map<number, string>;
  loading: boolean;
}) {
  if (!selectedOrganizationId) {
    return <p className="text-sm text-muted-foreground">No organization selected.</p>;
  }
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading members...</p>;
  }
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">No members found.</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">User ID</th>
            <th className="px-4 py-3 font-medium">Team</th>
            <th className="px-4 py-3 font-medium">Roles</th>
            <th className="px-4 py-3 font-medium">Added</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={`${member.OrganizationID}-${member.UserID}`} className="border-t">
              <td className="px-4 py-3">{member.UserID}</td>
              <td className="px-4 py-3">{member.TeamID > 0 ? teamsByID.get(member.TeamID) ?? `#${member.TeamID}` : "-"}</td>
              <td className="px-4 py-3">{member.Roles.join(", ")}</td>
              <td className="px-4 py-3">{formatDateTime(member.AddedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

const MemoizedInvitationsPanel = memo(function MemoizedInvitationsPanel({
  selectedOrganizationId,
  invitations,
  loading,
}: {
  selectedOrganizationId: string;
  invitations: OrganizationInvitation[];
  loading: boolean;
}) {
  if (!selectedOrganizationId) {
    return <p className="text-sm text-muted-foreground">No organization selected.</p>;
  }
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading invitations...</p>;
  }
  if (invitations.length === 0) {
    return <p className="text-sm text-muted-foreground">No invitations found.</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Token</th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((invitation) => (
            <tr key={invitation.ID} className="border-t">
              <td className="px-4 py-3">{invitation.Email}</td>
              <td className="px-4 py-3">{invitation.Role}</td>
              <td className="px-4 py-3">{invitation.Status}</td>
              <td className="px-4 py-3"><code>{invitation.Token}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
