import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvitationsPanel } from "./_components/invitations";
import { MembersPanel } from "./_components/members";
import { ProjectsPanel } from "./_components/projects";
import { LoadingState } from "./_components/shared/template";
import { EmptyBlock } from "./_components/shared/empty-block";
import { OrganizationSummaryPanel } from "./_components/summary";
import type { OrganizationsPageViewModel } from "./_lib/page/use-organizations-page-view-model";
import type { ViewTab } from "./_lib/shared/types";

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
  projectMemberBusy,
  removeProjectMemberBusy,
  memberActionBusy,
  createInvitationBusy,
  revokeInvitationBusy,
  setActiveTab,
  setProjectSearch,
  setInvitationDraft,
  onMemberDraftChange,
  onAssignProjectMember,
  onRemoveProjectMember,
  onUpdateMemberProjects,
  onUpdateRoles,
  onRemoveMember,
  onSetMemberBanned,
  onCreateInvitation,
  onRevokeInvitation,
  onRefetchOrganizations,
}: OrganizationsPageViewModel) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title="Organisations"
        baseline="Projets, membres et invitations de l'organisation active."
        actionsVariant="classic"
      />

      {activeError ? (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {activeError}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-3 rounded-lg border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-foreground">
          {notice}
        </div>
      ) : null}

      {isInitialLoading ? (
        <LoadingState />
      ) : selectedOrganization ? (
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          <OrganizationSummaryPanel organization={selectedOrganization} resources={resources} />
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as ViewTab)}
            className="mt-4 flex-col rounded-lg border border-border/60 bg-card"
          >
            <div className="border-b border-border/60 px-4 py-3">
              <TabsList className="h-10 max-w-full overflow-x-auto p-1.5">
                <TabsTrigger value="projects" className="px-3 text-xs md:text-sm">
                  Projets
                </TabsTrigger>
                <TabsTrigger value="members" className="px-3 text-xs md:text-sm">
                  Membres & roles
                </TabsTrigger>
                <TabsTrigger value="invitations" className="px-3 text-xs md:text-sm">
                  Invitations
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4">
              <TabsContent value="projects" className="m-0">
                <ProjectsPanel
                  projects={resources.projects}
                  members={resources.members}
                  projectMembers={resources.projectMembers}
                  currentUserId={currentUserId}
                  memberDrafts={projectMemberDrafts}
                  onboardingHref={createProjectOnboardingHref}
                  search={projectSearch}
                  onMemberDraftChange={onMemberDraftChange}
                  onSearchChange={setProjectSearch}
                  onAssignProjectMember={onAssignProjectMember}
                  onRemoveProjectMember={onRemoveProjectMember}
                  memberBusy={projectMemberBusy}
                  removeMemberBusy={removeProjectMemberBusy}
                />
              </TabsContent>

              <TabsContent value="members" className="m-0">
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
                  onSetMemberBanned={onSetMemberBanned}
                  memberActionBusy={memberActionBusy}
                />
              </TabsContent>

              <TabsContent value="invitations" className="m-0">
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
              </TabsContent>
            </div>
          </Tabs>
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
