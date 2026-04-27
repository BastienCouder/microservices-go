import { Ban, CheckCircle2, FolderKanban, Trash2 } from "lucide-react";
import { ActionsPopover, type ActionsPopoverItem } from "@/components/shared/actions-popover";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  formatLabel,
  getRoleBadgeVariant,
  isMemberBanned,
  memberLabel,
} from "../../_lib/shared/formatters";
import {
  ASSIGNABLE_ORGANIZATION_ROLES,
  type MemberActionPolicy,
} from "../../_lib/shared/project-membership";
import type { OrganizationMember } from "../../_lib/shared/types";

type MemberRowProps = {
  member: OrganizationMember;
  isCurrentUser: boolean;
  email: string;
  projectNames: string[];
  actionPolicy: MemberActionPolicy;
  showActions: boolean;
  memberActionBusy: boolean;
  onUpdateRoles: (userId: string, roles: string[]) => void;
  onEditProjects: (member: OrganizationMember) => void;
  onRemoveMember: (member: OrganizationMember) => void;
  onSetMemberBanned: (userId: string, banned: boolean) => void;
};

export function MemberRow({
  member,
  isCurrentUser,
  email,
  projectNames,
  actionPolicy,
  showActions,
  memberActionBusy,
  onUpdateRoles,
  onEditProjects,
  onRemoveMember,
  onSetMemberBanned,
}: MemberRowProps) {
  const banned = isMemberBanned(member);
  const selectedAssignableRole = ASSIGNABLE_ORGANIZATION_ROLES.find((role) =>
    member.roles.includes(role),
  );
  const roleOptions = ASSIGNABLE_ORGANIZATION_ROLES.filter((role) => {
    if (role !== "owner") return true;
    return actionPolicy.canAssignOwnerRole;
  });
  const actions: ActionsPopoverItem[] = [];
  if (actionPolicy.canEditProjects) {
    actions.push({
      icon: FolderKanban,
      title: "Modifier l'acces au projet",
      description: "Ajouter ou retirer ses acces projet.",
      disabled: false,
      onSelect: () => onEditProjects(member),
    });
  }
  if (actionPolicy.canSetBanned) {
    actions.push({
      icon: banned ? CheckCircle2 : Ban,
      title: banned ? "Debannir" : "Bannir",
      description: banned
        ? "Retirer le statut banni pour restaurer l'acces organisation."
        : "Marquer ce membre comme banni dans cette organisation.",
      disabled: false,
      onSelect: () => onSetMemberBanned(member.userId, !banned),
    });
  }
  if (actionPolicy.canRemoveMember) {
    actions.push({
      icon: Trash2,
      title: "Retirer le membre",
      description: "Supprimer son acces a cette organisation et retirer ses roles.",
      tone: "destructive",
      disabled: false,
      onSelect: () => onRemoveMember(member),
    });
  }

  return (
    <TableRow className={cn(isCurrentUser && "bg-primary/8 hover:bg-primary/12")}>
      <TableCell className="font-medium">
        <div className="flex flex-wrap items-center gap-2">
          <span>{memberLabel(member)}</span>
          {isCurrentUser ? <Badge variant="secondary">Vous</Badge> : null}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{email || "-"}</TableCell>
      <TableCell className="max-w-[280px] whitespace-normal">
        <div className="flex flex-wrap gap-1">
          {projectNames.length === 0 ? (
            <Badge variant="outline">Aucun projet</Badge>
          ) : (
            projectNames.map((projectName) => (
              <Badge key={projectName} variant="secondary" className="max-w-full truncate">
                {projectName}
              </Badge>
            ))
          )}
        </div>
      </TableCell>
      <TableCell>
        {actionPolicy.canEditRoles ? (
          <Select
            value={selectedAssignableRole}
            onValueChange={(role) => onUpdateRoles(member.userId, [role])}
            disabled={memberActionBusy || roleOptions.length === 0}
          >
            <SelectTrigger className="h-8 min-w-[132px] bg-background">
              <SelectValue placeholder={formatLabel(member.roles[0] ?? "member")} />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((role) => (
                <SelectItem key={role} value={role}>
                  {formatLabel(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex flex-wrap gap-1">
            {member.roles.length === 0 ? (
              <Badge variant="outline">member</Badge>
            ) : (
              member.roles.map((role) => (
                <Badge key={role} variant={getRoleBadgeVariant(role)}>
                  {formatLabel(role)}
                </Badge>
              ))
            )}
          </div>
        )}
      </TableCell>
      <TableCell>
        {banned ? (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            Banni
          </Badge>
        ) : (
          <Badge variant="secondary">Actif</Badge>
        )}
      </TableCell>
      <TableCell>{formatDateTime(member.addedAt)}</TableCell>
      {showActions ? (
        <TableCell className="text-right">
          {actionPolicy.showActions && actions.length > 0 ? (
            <ActionsPopover
              title="Actions membre"
              description={memberLabel(member)}
              triggerLabel="Actions du membre"
              items={actions}
              disabled={memberActionBusy}
            />
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </TableCell>
      ) : null}
    </TableRow>
  );
}
