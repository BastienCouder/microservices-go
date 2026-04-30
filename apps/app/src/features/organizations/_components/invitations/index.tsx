import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/shared/section-title";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyBlock } from "../shared/empty-block";
import {
  formatDateTime,
  formatLabel,
  getStatusBadgeVariant,
} from "../../_lib/shared/formatters";
import {
  INVITABLE_ORGANIZATION_ROLES,
} from "../../_lib/shared/project-membership";
import type {
  InvitationDraft,
  OrganizationInvitation,
  OrganizationProject,
} from "../../_lib/shared/types";

const PROJECT_ROLE_OPTIONS = ["viewer"] as const;

type InvitationsPanelProps = {
  invitations: OrganizationInvitation[];
  projects: OrganizationProject[];
  draft: InvitationDraft;
  onDraftChange: (draft: InvitationDraft) => void;
  onSubmit: () => void;
  onRevokeInvitation: (invitationId: string) => void;
  busy: boolean;
  revokeBusy: boolean;
};

export function InvitationsPanel({
  invitations,
  projects,
  draft,
  onDraftChange,
  onSubmit,
  onRevokeInvitation,
  busy,
  revokeBusy,
}: InvitationsPanelProps) {
  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === "pending"),
    [invitations],
  );
  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-lg border border-border/60 bg-card px-4 py-2">
        <h2>
          <SectionTitle showIndicator={false}>Nouvelle invitation</SectionTitle>
        </h2>
        <div className="mt-4 space-y-3">
          <Input
            value={draft.email}
            onChange={(event) => onDraftChange({ ...draft, email: event.target.value })}
            placeholder="email@domain.com"
          />
          <Select
            value={draft.projectId || "organization"}
            onValueChange={(value) => {
              const projectId = value === "organization" ? "" : value;
              onDraftChange({
                ...draft,
                projectId,
                role: projectId
                  ? PROJECT_ROLE_OPTIONS[0]
                  : INVITABLE_ORGANIZATION_ROLES.includes(
                      draft.role as (typeof INVITABLE_ORGANIZATION_ROLES)[number],
                    )
                    ? draft.role
                    : "member",
              });
            }}
          >
            <SelectTrigger className="bg-background w-full">
              <SelectValue placeholder="Portee de l'invitation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="organization">Toute l'organisation</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={draft.role} onValueChange={(role) => onDraftChange({ ...draft, role })}>
            <SelectTrigger className="bg-background w-full">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              {(draft.projectId ? PROJECT_ROLE_OPTIONS : INVITABLE_ORGANIZATION_ROLES).map((role) => (
                <SelectItem key={role} value={role}>
                  {formatLabel(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={draft.message}
            onChange={(event) => onDraftChange({ ...draft, message: event.target.value })}
            placeholder="Message optionnel"
          />
          <Button className="w-full" onClick={onSubmit} disabled={busy}>
            {busy ? "Envoi..." : "Inviter"}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="border-b border-border/60 px-4 py-2">
          <h2>
            <SectionTitle showIndicator={false}>Invitations en cours</SectionTitle>
          </h2>
        </div>
        <div className="p-4">
          {pendingInvitations.length === 0 ? (
            <EmptyBlock
              title="Aucune invitation"
              description="Les invitations en attente depuis cette organisation seront listees ici."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Portee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Envoyee le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      {invitation.projectId
                        ? projectNameById.get(invitation.projectId) ?? `Projet ${invitation.projectId}`
                        : "Organisation"}
                    </TableCell>
                    <TableCell>{formatLabel(invitation.role)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(invitation.status)}>
                        {formatLabel(invitation.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(invitation.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Desactiver l'invitation"
                            disabled={revokeBusy}
                          >
                            <Trash2 />
                            <span className="sr-only">Desactiver l'invitation</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Desactiver cette invitation ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              L'invitation envoyee a {invitation.email} ne pourra plus etre acceptee.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={revokeBusy}>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              disabled={revokeBusy}
                              onClick={() => onRevokeInvitation(invitation.id)}
                            >
                              Desactiver
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
