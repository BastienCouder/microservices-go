import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatLabel, memberLabel } from "../../_lib/shared/formatters";
import {
  buildCurrentUserProjectAccessGuardMessage,
  getOrphanedProjectsAfterMemberProjectsChange,
  memberHasOrganizationWideProjectAccess,
} from "../../_lib/shared/project-membership";
import type {
  OrganizationMember,
  OrganizationProject,
  OrganizationProjectMember,
} from "../../_lib/shared/types";

type ProjectAccessDialogProps = {
  member: OrganizationMember | null;
  members: OrganizationMember[];
  projects: OrganizationProject[];
  projectMembers: OrganizationProjectMember[];
  projectIdsDraft: string[];
  currentUserId: string;
  memberActionBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleProject: (projectId: string, checked: boolean) => void;
  onSubmit: () => void;
};

export function ProjectAccessDialog({
  member,
  members,
  projects,
  projectMembers,
  projectIdsDraft,
  currentUserId,
  memberActionBusy,
  onOpenChange,
  onToggleProject,
  onSubmit,
}: ProjectAccessDialogProps) {
  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier l'acces au projet</DialogTitle>
          <DialogDescription>{member ? memberLabel(member) : ""}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[360px] space-y-2 overflow-auto rounded-lg border border-border/60 p-2">
          {projects.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Aucun projet disponible.
            </p>
          ) : (
            projects.map((project) => {
              const editingMemberRoles = member?.roles ?? [];
              const hasOrganizationWideAccess =
                memberHasOrganizationWideProjectAccess(editingMemberRoles);
              const checked = hasOrganizationWideAccess || projectIdsDraft.includes(project.id);
              const nextProjectIdsWithoutProject = projectIdsDraft.filter((id) => id !== project.id);
              const removalWouldOrphan =
                checked &&
                getOrphanedProjectsAfterMemberProjectsChange({
                  projects,
                  projectMembers,
                  organizationMembers: members,
                  userId: member?.userId ?? "",
                  nextProjectIds: nextProjectIdsWithoutProject,
                }).some((orphanedProject) => orphanedProject.id === project.id);
              const currentUserGuardMessage = buildCurrentUserProjectAccessGuardMessage({
                currentUserId,
                userId: member?.userId ?? "",
                nextProjectIds: nextProjectIdsWithoutProject,
                roles: editingMemberRoles,
              });
              const disabledReason = hasOrganizationWideAccess
                ? "Ce role donne acces a tous les projets."
                : removalWouldOrphan
                  ? "Impossible de laisser ce projet sans utilisateur."
                  : checked && currentUserGuardMessage
                    ? "Votre compte doit rester rattache a au moins un projet."
                    : undefined;

              return (
                <label
                  key={project.id}
                  title={disabledReason}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted",
                    disabledReason && "cursor-not-allowed opacity-60",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => onToggleProject(project.id, value === true)}
                    disabled={memberActionBusy || Boolean(disabledReason)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{project.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {project.brandName || formatLabel(project.status)}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={onSubmit} disabled={memberActionBusy}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
