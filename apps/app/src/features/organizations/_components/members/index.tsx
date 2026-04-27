import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/shared/section-title";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyBlock } from "../shared/empty-block";
import { MemberRow } from "./member-row";
import { ProjectAccessDialog } from "./project-access-dialog";
import { RemoveMemberDialog } from "./remove-member-dialog";
import { getMemberActionPolicy, getProjectIdsForMember, getProjectNamesForMember } from "../../_lib/shared/project-membership";
import type {
  OrganizationInvitation,
  OrganizationMember,
  OrganizationProject,
  OrganizationProjectMember,
} from "../../_lib/shared/types";

type MembersPanelProps = {
  members: OrganizationMember[];
  projects: OrganizationProject[];
  projectMembers: OrganizationProjectMember[];
  invitations: OrganizationInvitation[];
  currentUserId: string;
  currentUserEmail: string;
  onUpdateMemberProjects: (userId: string, projectIds: string[]) => void;
  onUpdateRoles: (userId: string, roles: string[]) => void;
  onRemoveMember: (userId: string) => void;
  onSetMemberBanned: (userId: string, banned: boolean) => void;
  memberActionBusy: boolean;
};

export function MembersPanel({
  members,
  projects,
  projectMembers,
  invitations,
  currentUserId,
  currentUserEmail,
  onUpdateMemberProjects,
  onUpdateRoles,
  onRemoveMember,
  onSetMemberBanned,
  memberActionBusy,
}: MembersPanelProps) {
  const [editingProjectsMember, setEditingProjectsMember] = useState<OrganizationMember | null>(null);
  const [projectIdsDraft, setProjectIdsDraft] = useState<string[]>([]);
  const [removeTarget, setRemoveTarget] = useState<OrganizationMember | null>(null);
  const currentMember = useMemo(
    () => members.find((member) => member.userId === currentUserId) ?? null,
    [currentUserId, members],
  );
  const currentRoles = currentMember?.roles ?? [];
  const canShowAnyActions = getMemberActionPolicy({
    actorRoles: currentRoles,
    targetRoles: ["member"],
  }).showActions;
  const emailByUserId = useMemo(() => {
    const emails = new Map<string, string>();
    if (currentUserId && currentUserEmail) emails.set(currentUserId, currentUserEmail);
    for (const invitation of invitations) {
      if (invitation.acceptedByUserId && invitation.email) {
        emails.set(invitation.acceptedByUserId, invitation.email);
      }
    }
    for (const member of members) {
      if (member.email) emails.set(member.userId, member.email);
    }
    return emails;
  }, [currentUserEmail, currentUserId, invitations, members]);

  const openProjectsDialog = (member: OrganizationMember) => {
    const policy = getMemberActionPolicy({
      actorRoles: currentRoles,
      targetRoles: member.roles,
      isCurrentUser: member.userId === currentUserId,
    });
    if (!policy.canEditProjects) return;
    const memberProjectIds = getProjectIdsForMember(projectMembers, member.userId, {
      projects,
      roles: member.roles,
    });
    console.info("[organizations] open project editor", {
      actorUserId: currentUserId,
      actorRoles: currentRoles,
      targetUserId: member.userId,
      targetRoles: member.roles,
      policy,
      availableProjects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        organizationId: project.organizationId,
      })),
      currentProjectIds: memberProjectIds,
      projectMembers: projectMembers.map((projectMember) => ({
        projectId: projectMember.projectId,
        userId: projectMember.userId,
        role: projectMember.role,
      })),
    });
    setEditingProjectsMember(member);
    setProjectIdsDraft(memberProjectIds);
  };

  const toggleProjectDraft = (projectId: string, checked: boolean) => {
    setProjectIdsDraft((current) => {
      if (checked) return Array.from(new Set([...current, projectId]));
      return current.filter((id) => id !== projectId);
    });
  };

  const submitProjectsDialog = () => {
    if (!editingProjectsMember) return;
    onUpdateMemberProjects(editingProjectsMember.userId, projectIdsDraft);
    setEditingProjectsMember(null);
  };

  const confirmRemoveMember = () => {
    if (!removeTarget) return;
    onRemoveMember(removeTarget.userId);
    setRemoveTarget(null);
  };

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="border-b border-border/60 px-4 py-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <h2>
              <SectionTitle>Membres & roles</SectionTitle>
            </h2>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{members.length} membres</Badge>
            </div>
          </div>
        </div>

        <div className="p-4">
          {members.length === 0 ? (
            <EmptyBlock
              title="Aucun membre"
              description="Invite un membre pour gerer ses roles dans cette organisation."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Projets</TableHead>
                  <TableHead>Roles actuels</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Ajoute le</TableHead>
                  {canShowAnyActions ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const actionPolicy = getMemberActionPolicy({
                    actorRoles: currentRoles,
                    targetRoles: member.roles,
                    isCurrentUser: member.userId === currentUserId,
                  });
                  return (
                    <MemberRow
                      key={`${member.organizationId}-${member.userId}`}
                      member={member}
                      isCurrentUser={member.userId === currentUserId}
                      email={emailByUserId.get(member.userId) ?? ""}
                      projectNames={getProjectNamesForMember(
                        projects,
                        projectMembers,
                        member.userId,
                        member.roles,
                      )}
                      actionPolicy={actionPolicy}
                      showActions={canShowAnyActions}
                      memberActionBusy={memberActionBusy}
                      onUpdateRoles={onUpdateRoles}
                      onEditProjects={openProjectsDialog}
                      onRemoveMember={setRemoveTarget}
                      onSetMemberBanned={onSetMemberBanned}
                    />
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <ProjectAccessDialog
        member={editingProjectsMember}
        members={members}
        projects={projects}
        projectMembers={projectMembers}
        projectIdsDraft={projectIdsDraft}
        currentUserId={currentUserId}
        memberActionBusy={memberActionBusy}
        onOpenChange={(open) => !open && setEditingProjectsMember(null)}
        onToggleProject={toggleProjectDraft}
        onSubmit={submitProjectsDialog}
      />
      <RemoveMemberDialog
        member={removeTarget}
        memberActionBusy={memberActionBusy}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        onConfirm={confirmRemoveMember}
      />
    </div>
  );
}
