import { memo } from "react";
import { Link } from "react-router-dom";
import { Building2, Calendar, MousePointer2, UserPlus, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { buildScopedHref } from "@/shared/selection";
import { formatDateTime, formatLabel, getInitials, memberLabel } from "../../_lib/shared/formatters";
import { getProjectIdsForMember } from "../../_lib/shared/project-membership";
import type {
  OrganizationMember,
  OrganizationProject,
  OrganizationProjectMember,
  ProjectMemberDraft,
} from "../../_lib/shared/types";

type ProjectCardProps = {
  project: OrganizationProject;
  assignedMembers: OrganizationProjectMember[];
  availableMembers: OrganizationMember[];
  projectMembers: OrganizationProjectMember[];
  currentUserId: string;
  memberDraft: ProjectMemberDraft;
  memberBusy: boolean;
  removeMemberBusy: boolean;
  onRemoveProjectMember: (projectId: string, userId: string) => void;
  onMemberDraftChange: (projectId: string, draft: ProjectMemberDraft) => void;
  onAssignProjectMember: (projectId: string) => void;
};

export const ProjectCard = memo(function ProjectCard({
  project,
  assignedMembers,
  availableMembers,
  projectMembers,
  currentUserId,
  memberDraft,
  memberBusy,
  removeMemberBusy,
  onRemoveProjectMember,
  onMemberDraftChange,
  onAssignProjectMember,
}: ProjectCardProps) {
  const isActive = project.status === "active" || project.status === "published";

  return (
    <article
      className={cn(
        "group flex flex-col rounded-2xl border bg-card p-5 transition-all duration-200 hover:shadow-sm",
        isActive ? "border-primary/20 bg-primary/[0.02]" : "border-border hover:border-border/80",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-sm font-bold text-primary shadow-sm">
          {getInitials(project.name)}
        </div>

        <div
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn("size-1.5 rounded-full", isActive ? "bg-primary" : "bg-muted-foreground/60")}
          />
          {formatLabel(project.status)}
        </div>
      </div>

      <div className="mb-4 flex-1">
        <h3 className="truncate text-base font-semibold text-foreground">{project.name}</h3>
        <p className="truncate text-sm text-muted-foreground">
          {project.brandName || "Marque non renseignee"}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 border-y border-border/40 py-4 text-[11px]">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MousePointer2 className="size-3" />
            <span>Attribution</span>
          </div>
          <div className="truncate font-medium text-foreground">
            {project.attributionSource || "-"}
          </div>
        </div>
        <div className="space-y-1 border-l pl-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="size-3" />
            <span>Cree le</span>
          </div>
          <div className="truncate font-medium text-foreground">
            {formatDateTime(project.createdAt)}
          </div>
        </div>
      </div>

      <Button asChild variant="outline" size="sm" className="w-full gap-2 rounded-lg">
        <Link to={buildScopedHref("/monitoring", { project: project.slug })}>
          <Building2 className="size-3.5" />
          Acceder au Monitoring
        </Link>
      </Button>

      <div className="mt-5 space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
            <Users className="size-3" />
            Membres restreints
          </div>
          <Badge variant="secondary" className="h-4 px-1 text-[10px] font-mono">
            {assignedMembers.length}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {assignedMembers.length === 0 ? (
            <span className="text-[11px] italic text-muted-foreground/50">
              Aucun acces specifique
            </span>
          ) : (
            assignedMembers.map((member) => (
              <Badge
                key={`${project.id}-${member.userId}`}
                variant="secondary"
                className="gap-1 pr-1 text-[11px] font-normal transition-colors hover:bg-secondary/80"
              >
                {memberLabel(member)}
                {member.userId === currentUserId ? " (vous)" : ""}
                <button
                  type="button"
                  onClick={() => onRemoveProjectMember(project.id, member.userId)}
                  disabled={
                    removeMemberBusy ||
                    assignedMembers.length <= 1 ||
                    (member.userId === currentUserId &&
                      getProjectIdsForMember(projectMembers, currentUserId).length <= 1)
                  }
                  title={
                    assignedMembers.length <= 1
                      ? "Impossible de laisser ce projet sans utilisateur."
                      : member.userId === currentUserId &&
                          getProjectIdsForMember(projectMembers, currentUserId).length <= 1
                        ? "Votre compte doit rester rattache a au moins un projet."
                        : "Retirer ce membre"
                  }
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
                >
                  <X className="size-2.5" />
                </button>
              </Badge>
            ))
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Select
            value={memberDraft.userId || undefined}
            onValueChange={(userId) => onMemberDraftChange(project.id, { ...memberDraft, userId })}
            disabled={availableMembers.length === 0}
          >
            <SelectTrigger className="h-8 rounded-md bg-background text-[11px] focus:ring-1">
              <SelectValue placeholder="Ajouter un membre..." />
            </SelectTrigger>
            <SelectContent>
              {availableMembers.map((member) => (
                <SelectItem key={member.userId} value={member.userId} className="text-xs">
                  {memberLabel(member)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-8 p-0"
            onClick={() => onAssignProjectMember(project.id)}
            disabled={memberBusy || !memberDraft.userId}
          >
            <UserPlus className="size-3.5" />
          </Button>
        </div>
      </div>
    </article>
  );
});
