import { memo, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Trash2, UserPlus, Users, X } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { buildScopedHref } from "@/shared/selection";
import { formatLabel, memberLabel } from "../../_lib/shared/formatters";
import {
  ASSIGNABLE_PROJECT_ROLES,
  getProjectIdsForMember,
} from "../../_lib/shared/project-membership";
import type {
  OrganizationMember,
  OrganizationProject,
  OrganizationProjectMember,
  ProjectSettingsInput,
  ProjectMemberDraft,
} from "../../_lib/shared/types";

type ProjectCardProps = {
  project: OrganizationProject;
  assignedMembers: OrganizationProjectMember[];
  organizationMembers: OrganizationMember[];
  availableMembers: OrganizationMember[];
  projectMembers: OrganizationProjectMember[];
  currentUserId: string;
  memberDraft: ProjectMemberDraft;
  memberBusy: boolean;
  removeMemberBusy: boolean;
  canUpdateProject: boolean;
  canDeleteProject: boolean;
  canManageProjectMembers: boolean;
  updateProjectBusy: boolean;
  deleteProjectBusy: boolean;
  onUpdateProjectSettings: (projectId: string, input: ProjectSettingsInput) => void;
  onDeleteProject: (projectId: string) => void;
  onRemoveProjectMember: (projectId: string, userId: string) => void;
  onMemberDraftChange: (projectId: string, draft: ProjectMemberDraft) => void;
  onAssignProjectMember: (projectId: string) => void;
};

export const ProjectCard = memo(function ProjectCard({
  project,
  assignedMembers,
  organizationMembers,
  availableMembers,
  projectMembers,
  currentUserId,
  memberDraft,
  memberBusy,
  removeMemberBusy,
  canUpdateProject,
  canDeleteProject,
  canManageProjectMembers,
  updateProjectBusy,
  deleteProjectBusy,
  onUpdateProjectSettings,
  onDeleteProject,
  onRemoveProjectMember,
  onMemberDraftChange,
  onAssignProjectMember,
}: ProjectCardProps) {
  const [membersOpen, setMembersOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState(project.name);

  useEffect(() => {
    if (!settingsOpen) {
      setSettingsName(project.name);
    }
  }, [project.name, settingsOpen]);

  const canSaveSettings =
    settingsName.trim() !== "" && settingsName.trim() !== project.name;
  const currentUserProjectCount = getProjectIdsForMember(projectMembers, currentUserId).length;
  const organizationMemberByUserId = useMemo(
    () => new Map(organizationMembers.map((member) => [member.userId, member])),
    [organizationMembers],
  );
  const filteredAvailableMembers = useMemo(() => {
    const needle = memberSearch.trim().toLowerCase();
    if (!needle) return availableMembers;
    return availableMembers.filter((member) =>
      [memberLabel(member), member.email, ...member.roles]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [availableMembers, memberSearch]);

  return (
    <article
      className={cn(
        "group flex flex-col rounded-2xl border bg-card p-5 transition-all duration-200 hover:shadow-sm",
        "border-border hover:border-border/80",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="mb-4 flex-1">
          <h3 className="truncate text-base font-semibold text-primary">{project.name}</h3>
          <p className="truncate text-sm text-muted-foreground">
            {project.brandName || "Marque non renseignee"}
          </p>
        </div>
      </div>

      <Button asChild variant="outline" className="w-full gap-2 rounded-lg">
        <Link to={buildScopedHref("/monitoring", {
          project: project.slug,
          projectId: project.id,
        })}>
          Acceder au projet
        </Link>
      </Button>

      {canUpdateProject ? (
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full justify-center gap-2 rounded-lg"
            onClick={() => setSettingsOpen(true)}
          >
            Parametres projet
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Parametres projet</DialogTitle>
              <DialogDescription>Modifiez le nom du projet.</DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!canSaveSettings) return;
                onUpdateProjectSettings(project.id, {
                  name: settingsName.trim(),
                });
                setSettingsOpen(false);
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor={`project-name-${project.id}`}>Nom</Label>
                <Input
                  id={`project-name-${project.id}`}
                  value={settingsName}
                  disabled={updateProjectBusy}
                  onChange={(event) => setSettingsName(event.target.value)}
                />
              </div>
              <DialogFooter>
                {canDeleteProject ? (
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={deleteProjectBusy}
                        className="sm:mr-auto"
                      >
                        <Trash2 data-icon="inline-start" />
                        Supprimer
                      </Button>
                    }
                    title="Supprimer ce projet ?"
                    description="Cette action supprimera le projet et ses donnees associees."
                    confirmLabel="Supprimer"
                    loading={deleteProjectBusy}
                    media={<Trash2 />}
                    onConfirm={() => {
                      onDeleteProject(project.id);
                      setSettingsOpen(false);
                    }}
                  />
                ) : null}
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={updateProjectBusy}>
                    Annuler
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={updateProjectBusy || !canSaveSettings}>
                  Enregistrer
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {canManageProjectMembers ? (
        <Dialog
          open={membersOpen}
          onOpenChange={(open) => {
            setMembersOpen(open);
            if (!open) setMemberSearch("");
          }}
        >
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full justify-center gap-2 rounded-lg"
            onClick={() => setMembersOpen(true)}
          >
            <Users data-icon="inline-start" />
            Gerer les membres
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-mono">
              {assignedMembers.length}
            </Badge>
          </Button>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Membres de {project.name}</DialogTitle>
              <DialogDescription>
                Ajoutez ou retirez les acces specifiques a ce projet.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{assignedMembers.length} rattaches</Badge>
                <Badge variant="outline">{availableMembers.length} disponibles</Badge>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">Membres rattaches</p>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border/70">
                  {assignedMembers.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Aucun acces specifique
                    </div>
                  ) : (
                    assignedMembers.map((member) => {
                      const organizationMember = organizationMemberByUserId.get(member.userId);
                      const displayName = memberLabel(organizationMember ?? member);
                      const displayEmail = organizationMember?.email?.trim() ?? "";
                      const removeDisabled =
                        removeMemberBusy ||
                        assignedMembers.length <= 1 ||
                        (member.userId === currentUserId && currentUserProjectCount <= 1);
                      const removeTitle =
                        assignedMembers.length <= 1
                          ? "Impossible de laisser ce projet sans utilisateur."
                          : member.userId === currentUserId && currentUserProjectCount <= 1
                            ? "Votre compte doit rester rattache a au moins un projet."
                            : "Retirer ce membre";

                      return (
                        <div
                          key={`${project.id}-${member.userId}`}
                          className="flex min-h-12 items-center justify-between gap-3 border-b border-border/60 px-3 py-2 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {displayName}
                              </span>
                              {member.userId === currentUserId ? (
                                <Badge variant="secondary" className="h-5">
                                  Vous
                                </Badge>
                              ) : null}
                            </div>
                            <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="truncate">{displayEmail || "Email non renseigne"}</span>
                              <span>Role projet: {member.role || "viewer"}</span>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemoveProjectMember(project.id, member.userId)}
                            disabled={removeDisabled}
                            title={removeTitle}
                            aria-label={removeTitle}
                            className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid gap-3 border-t border-border/70 pt-4">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_120px_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder="Filtrer"
                      className="h-9 pl-9"
                    />
                  </div>

                  <Select
                    value={memberDraft.userId || undefined}
                    onValueChange={(userId) =>
                      onMemberDraftChange(project.id, { ...memberDraft, userId })
                    }
                    disabled={filteredAvailableMembers.length === 0}
                  >
                    <SelectTrigger className="h-9 rounded-lg bg-background text-xs">
                      <SelectValue placeholder="Ajouter un membre..." />
                    </SelectTrigger>

                    <SelectContent>
                      {filteredAvailableMembers.map((member) => (
                        <SelectItem key={member.userId} value={member.userId} className="text-xs">
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate font-medium">{memberLabel(member)}</span>
                            <span className="truncate text-muted-foreground">
                              {member.email || "Email non renseigne"}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={memberDraft.role || "viewer"}
                    onValueChange={(role) =>
                      onMemberDraftChange(project.id, { ...memberDraft, role })
                    }
                  >
                    <SelectTrigger className="h-9 rounded-lg bg-background text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_PROJECT_ROLES.map((role) => (
                        <SelectItem key={role} value={role} className="text-xs">
                          {formatLabel(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    className="h-9 gap-2 rounded-lg"
                    onClick={() => onAssignProjectMember(project.id)}
                    disabled={memberBusy || !memberDraft.userId}
                  >
                    <UserPlus className="size-3.5" />
                    Ajouter
                  </Button>
                </div>
                {availableMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Tous les membres disponibles sont deja rattaches a ce projet.
                  </p>
                ) : null}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </article>
  );
});
