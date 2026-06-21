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
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { redirectToWebPricing } from "@/shared/auth/web-auth";

export function OrganizationsLayout({
  activeTab,
  activeError,
  actionError,
  notice,
  isInitialLoading,
  organizations,
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
  resendInvitationBusy,
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
  onResendInvitation,
  onRevokeInvitation,
  onUpdateOrganizationName,
  onDeleteOrganization,
  onCreateAPIKey,
  onRevokeAPIKey,
  onClearCreatedAPIKey,
  onSelectOrganization,
  onRefetchOrganizations,
}: OrganizationsPageViewModel) {
  const { t } = useScopedI18n("organizations");

  useEffect(() => {
    if (actionError) {
      pushErrorToast(new Error(actionError), actionError);
    }
  }, [actionError]);

  useEffect(() => {
    if (notice) {
      pushSuccessToast(notice);
    }
  }, [notice]);

  useEffect(() => {
    if (activeTab === "billing") {
      redirectToWebPricing();
    }
  }, [activeTab]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title={t("pageTitle")}
        baseline={t("pageBaseline")}
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
                  onResendInvitation={onResendInvitation}
                  onRevokeInvitation={onRevokeInvitation}
                  busy={createInvitationBusy}
                  resendBusy={resendInvitationBusy}
                  revokeBusy={revokeInvitationBusy}
                />
              ) : null}

            {activeTab === "billing" ? (
                <div className="flex min-h-[320px] items-center justify-center rounded-lg border bg-background p-6 text-sm text-muted-foreground">
                  Redirection vers les tarifs...
                </div>
              ) : null}

            {activeTab === "settings" ? (
                <SettingsPanel
                  organization={selectedOrganization}
                  organizations={organizations}
                  busy={updateOrganizationBusy}
                  deleteBusy={deleteOrganizationBusy}
                  switchBusy={isInitialLoading}
                  onSelectOrganization={onSelectOrganization}
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
          title={t("emptyOrganizationTitle")}
          description={t("emptyOrganizationDescription")}
          action={
            <Button variant="outline" onClick={onRefetchOrganizations}>
              <RefreshCw data-icon="inline-start" />
              {t("reload")}
            </Button>
          }
        />
      )}
    </div>
  );
}
