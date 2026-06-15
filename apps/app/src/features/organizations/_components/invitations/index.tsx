import { useMemo } from "react";
import { Mail, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SectionTitle } from "@/components/shared/section-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { EmptyBlock } from "../shared/empty-block";
import {
  formatDateTime,
  formatLabel,
  getStatusBadgeVariant,
} from "../../_lib/shared/formatters";
import {
  ASSIGNABLE_PROJECT_ROLES,
  INVITABLE_ORGANIZATION_ROLES,
} from "../../_lib/shared/project-membership";
import type {
  InvitationDraft,
  OrganizationInvitation,
  OrganizationProject,
} from "../../_lib/shared/types";

type InvitationsPanelProps = {
  invitations: OrganizationInvitation[];
  projects: OrganizationProject[];
  draft: InvitationDraft;
  onDraftChange: (draft: InvitationDraft) => void;
  onSubmit: () => void;
  onResendInvitation: (invitationId: string) => void;
  onRevokeInvitation: (invitationId: string) => void;
  busy: boolean;
  resendBusy: boolean;
  revokeBusy: boolean;
};

export function InvitationsPanel({
  invitations,
  projects,
  draft,
  onDraftChange,
  onSubmit,
  onResendInvitation,
  onRevokeInvitation,
  busy,
  resendBusy,
  revokeBusy,
}: InvitationsPanelProps) {
  const { locale, t } = useScopedI18n("organizations");
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
          <SectionTitle showIndicator={false}>{t("newInvitationTitle")}</SectionTitle>
        </h2>
        <div className="mt-4 space-y-3">
          <Input
            value={draft.email}
            onChange={(event) => onDraftChange({ ...draft, email: event.target.value })}
            placeholder="email@domain.com"
          />
          <Select
            value={draft.locale || locale}
            onValueChange={(value: "fr" | "en") => onDraftChange({ ...draft, locale: value })}
          >
            <SelectTrigger className="bg-background w-full">
              <SelectValue placeholder={t("languagePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">{t("languageFrench")}</SelectItem>
              <SelectItem value="en">{t("languageEnglish")}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={draft.projectId || "organization"}
            onValueChange={(value) => {
              const projectId = value === "organization" ? "" : value;
              onDraftChange({
                ...draft,
                projectId,
                role: projectId
                  ? "viewer"
                  : INVITABLE_ORGANIZATION_ROLES.includes(
                      draft.role as (typeof INVITABLE_ORGANIZATION_ROLES)[number],
                    )
                    ? draft.role
                    : "viewer",
              });
            }}
          >
            <SelectTrigger className="bg-background w-full">
              <SelectValue placeholder={t("invitationScopePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="organization">{t("organizationWide")}</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={draft.role} onValueChange={(role) => onDraftChange({ ...draft, role })}>
            <SelectTrigger className="bg-background w-full">
              <SelectValue placeholder={t("rolePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {(draft.projectId ? ASSIGNABLE_PROJECT_ROLES : INVITABLE_ORGANIZATION_ROLES).map((role) => (
                <SelectItem key={role} value={role}>
                  {formatLabel(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={draft.message}
            onChange={(event) => onDraftChange({ ...draft, message: event.target.value })}
            placeholder={t("optionalMessagePlaceholder")}
          />
          <Button className="w-full" onClick={onSubmit} disabled={busy}>
            {busy ? t("sending") : t("invite")}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="border-b border-border/60 px-4 py-2">
          <h2>
            <SectionTitle showIndicator={false}>{t("pendingInvitationsTitle")}</SectionTitle>
          </h2>
        </div>
        <div className="p-4">
          {pendingInvitations.length === 0 ? (
            <EmptyBlock
              title={t("noInvitationTitle")}
              description={t("noInvitationDescription")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("emailColumn")}</TableHead>
                  <TableHead>{t("scopeColumn")}</TableHead>
                  <TableHead>{t("languageColumn")}</TableHead>
                  <TableHead>{t("roleColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  <TableHead>{t("sentAtColumn")}</TableHead>
                  <TableHead className="text-right">{t("actionsColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      {invitation.projectId
                        ? projectNameById.get(invitation.projectId) ?? t("projectFallback", { id: invitation.projectId })
                        : t("organization")}
                    </TableCell>
                    <TableCell>
                      {invitation.locale === "en" ? t("languageEnglish") : t("languageFrench")}
                    </TableCell>
                    <TableCell>{formatLabel(invitation.role)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(invitation.status)}>
                        {formatLabel(invitation.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(invitation.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onResendInvitation(invitation.id)}
                          disabled={resendBusy}
                        >
                          <Mail data-icon="inline-start" />
                          {resendBusy ? t("resendingInvitation") : t("resendInvitation")}
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              title={t("disableInvitation")}
                              disabled={revokeBusy}
                            >
                              <Trash2 />
                              <span className="sr-only">{t("disableInvitation")}</span>
                            </Button>
                          }
                          title={t("disableInvitationTitle")}
                          description={t("disableInvitationDescription", { email: invitation.email })}
                          confirmLabel={t("disable")}
                          loading={revokeBusy}
                          media={<Trash2 />}
                          onConfirm={() => onRevokeInvitation(invitation.id)}
                        />
                      </div>
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
