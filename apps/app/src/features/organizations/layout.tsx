import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";
import { InvitationsPanel } from "./_components/invitations";
import { ApiKeysPanel } from "./_components/api-keys";
import { MembersPanel } from "./_components/members";
import { ProjectsPanel } from "./_components/projects";
import { SettingsPanel } from "./_components/settings";
import { LoadingState } from "./_components/shared/template";
import { EmptyBlock } from "./_components/shared/empty-block";
import { OrganizationSummaryPanel } from "./_components/summary";
import type { OrganizationsPageViewModel } from "./_lib/page/use-organizations-page-view-model";

export function OrganizationsLayout({
  activeTab,
  activeError,
  notice,
  isInitialLoading,
  selectedOrganization,
  resources,
  currentUserId,
  currentUserEmail,
  projectSearch,
  projectMemberDrafts,
  invitationDraft,
  createProjectOnboardingHref,
  onStartCreateProjectOnboarding,
  canManageProjects,
  canDeleteProjects,
  deletingProjectId,
  projectSettingsBusy,
  projectMemberBusy,
  removeProjectMemberBusy,
  memberActionBusy,
  createInvitationBusy,
  revokeInvitationBusy,
  updateOrganizationBusy,
  deleteOrganizationBusy,
  createAPIKeyBusy,
  revokeAPIKeyBusy,
  createdAPIKey,
  setActiveTab,
  setProjectSearch,
  setInvitationDraft,
  onMemberDraftChange,
  onUpdateProjectSettings,
  onDeleteProject,
  onAssignProjectMember,
  onRemoveProjectMember,
  onUpdateMemberProjects,
  onUpdateRoles,
  onRemoveMember,
  onCreateInvitation,
  onRevokeInvitation,
  onUpdateOrganizationName,
  onDeleteOrganization,
  onCreateAPIKey,
  onRevokeAPIKey,
  onClearCreatedAPIKey,
  onRefetchOrganizations,
}: OrganizationsPageViewModel) {
  useEffect(() => {
    if (activeError) {
      pushErrorToast(new Error(activeError), activeError);
    }
  }, [activeError]);

  useEffect(() => {
    if (notice) {
      pushSuccessToast(notice);
    }
  }, [notice]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title="Organisations"
        baseline="Projets, membres et invitations de l'organisation active."
        actionsVariant="classic"
        className="hidden md:block"
      />

      {isInitialLoading ? (
        <LoadingState />
      ) : selectedOrganization ? (
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          <OrganizationSummaryPanel organization={selectedOrganization} resources={resources} />
          <div className="md:mt-4">
            {activeTab === "projects" ? (
                <ProjectsPanel
                  projects={resources.projects}
                  members={resources.members}
                  projectMembers={resources.projectMembers}
                  currentUserId={currentUserId}
                  memberDrafts={projectMemberDrafts}
                  onboardingHref={createProjectOnboardingHref}
                  onStartOnboarding={onStartCreateProjectOnboarding}
                  search={projectSearch}
                  canManageProjects={canManageProjects}
                  canDeleteProjects={canDeleteProjects}
                  deletingProjectId={deletingProjectId}
                  projectSettingsBusy={projectSettingsBusy}
                  onMemberDraftChange={onMemberDraftChange}
                  onSearchChange={setProjectSearch}
                  onUpdateProjectSettings={onUpdateProjectSettings}
                  onDeleteProject={onDeleteProject}
                  onAssignProjectMember={onAssignProjectMember}
                  onRemoveProjectMember={onRemoveProjectMember}
                  memberBusy={projectMemberBusy}
                  removeMemberBusy={removeProjectMemberBusy}
                />
              ) : null}

            {activeTab === "members" ? (
                <MembersPanel
                  members={resources.members}
                  projects={resources.projects}
                  projectMembers={resources.projectMembers}
                  invitations={resources.invitations}
                  currentUserId={currentUserId}
                  currentUserEmail={currentUserEmail}
                  onUpdateMemberProjects={onUpdateMemberProjects}
                  onUpdateRoles={onUpdateRoles}
                  onRemoveMember={onRemoveMember}
                  memberActionBusy={memberActionBusy}
                />
              ) : null}

            {activeTab === "invitations" ? (
                <InvitationsPanel
                  invitations={resources.invitations}
                  projects={resources.projects}
                  draft={invitationDraft}
                  onDraftChange={setInvitationDraft}
                  onSubmit={onCreateInvitation}
                  onRevokeInvitation={onRevokeInvitation}
                  busy={createInvitationBusy}
                  revokeBusy={revokeInvitationBusy}
                />
              ) : null}

            {activeTab === "settings" ? (
                <SettingsPanel
                  organization={selectedOrganization}
                  busy={updateOrganizationBusy}
                  deleteBusy={deleteOrganizationBusy}
                  onSubmit={onUpdateOrganizationName}
                  onDelete={onDeleteOrganization}
                />
              ) : null}

            {activeTab === "apiKeys" ? (
                <ApiKeysPanel
                  apiKeys={resources.apiKeys}
                  createdAPIKey={createdAPIKey}
                  createBusy={createAPIKeyBusy}
                  revokeBusy={revokeAPIKeyBusy}
                  onCreateAPIKey={onCreateAPIKey}
                  onRevokeAPIKey={onRevokeAPIKey}
                  onClearCreatedAPIKey={onClearCreatedAPIKey}
                />
              ) : null}
          </div>
        </div>
      ) : (
        <EmptyBlock
          title="Aucune organisation"
          description="Aucune organisation n'est disponible pour ce compte."
          action={
            <Button variant="outline" onClick={onRefetchOrganizations}>
              <RefreshCw data-icon="inline-start" />
              Recharger
            </Button>
          }
        />
      )}
    </div>
  );
}
