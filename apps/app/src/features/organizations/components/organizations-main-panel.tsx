"use client";

import { memo } from "react";
import { Building2, Mail, Settings2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonitoringSectionTitle } from "@/features/monitoring/_components/shared/monitoring-section-title";
import type { OrganizationHierarchy, OrganizationInvitation, OrganizationMember } from "@/shared/models";
import { formatDateTime } from "@/shared/utils";
import type { OrganizationBrandGroup } from "../lib/hierarchy";
import { OrganizationOverviewPanel } from "./organization-overview-panel";
import { OrganizationSettingsPanel } from "./organization-settings-panel";
import type { OrganizationSummary, OrganizationTab } from "./types";

function formatLabel(value: string): string {
  const normalized = value.trim().replace(/[_-]+/g, " ");
  if (normalized === "") return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getRoleBadgeVariant(role: OrganizationSummary["role"] | undefined): "default" | "secondary" | "outline" {
  if (role === "owner") return "default";
  if (role === "admin") return "secondary";
  return "outline";
}

function EmptyPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[340px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-10 text-center">
      <div className="flex max-w-md flex-col gap-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function TableLoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">Chargement en cours…</p>
      </div>
      <div className="rounded-xl border border-border/60">
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function OrganizationsMainPanel({
  activeTab,
  onTabChange,
  selectedOrganization,
  selectedOrganizationId,
  canManageOrganizationSettings,
  canDeleteOrganization,
  editedName,
  onEditedNameChange,
  isUpdatingName,
  onUpdateName,
  showDeleteConfirm,
  onShowDeleteConfirm,
  deleteConfirmName,
  onDeleteConfirmNameChange,
  isDeleting,
  onDeleteOrganization,
  onCancelDelete,
  members,
  invitations,
  teamsByID,
  hierarchy,
  brandGroups,
  brandsCount,
  onOpenCreateProject,
  loading,
}: {
  activeTab: OrganizationTab;
  onTabChange: (tab: OrganizationTab) => void;
  selectedOrganization: OrganizationSummary | null;
  selectedOrganizationId: string;
  canManageOrganizationSettings: boolean;
  canDeleteOrganization: boolean;
  editedName: string;
  onEditedNameChange: (value: string) => void;
  isUpdatingName: boolean;
  onUpdateName: () => void;
  showDeleteConfirm: boolean;
  onShowDeleteConfirm: (value: boolean) => void;
  deleteConfirmName: string;
  onDeleteConfirmNameChange: (value: string) => void;
  isDeleting: boolean;
  onDeleteOrganization: () => void;
  onCancelDelete: () => void;
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
  teamsByID: Map<number, string>;
  hierarchy: OrganizationHierarchy | null;
  brandGroups: OrganizationBrandGroup[];
  brandsCount: number;
  onOpenCreateProject: () => void;
  loading: boolean;
}) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as OrganizationTab)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <Card className="flex min-h-0 flex-1 flex-col border-border/60">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">
                <MonitoringSectionTitle>Organisation</MonitoringSectionTitle>
              </CardTitle>
              <CardDescription className="mt-2 leading-6">
                {selectedOrganization
                  ? `Vue simple de ${selectedOrganization.name}, avec les projets, les membres et les réglages essentiels.`
                  : "Sélectionnez une organisation dans la colonne de gauche pour afficher son détail."}
              </CardDescription>
            </div>

            {selectedOrganization ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getRoleBadgeVariant(selectedOrganization.role)}>{formatLabel(selectedOrganization.role)}</Badge>
                <Badge variant="outline">Org {selectedOrganization.id}</Badge>
                {activeTab === "overview" ? (
                  <Button size="sm" onClick={onOpenCreateProject}>
                    Créer un projet
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <TabsList variant="line" className="h-auto w-full justify-start gap-2 rounded-none p-0">
            <TabsTrigger value="overview">
              <Building2 data-icon="inline-start" />
              Vue d’ensemble
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users data-icon="inline-start" />
              Membres
            </TabsTrigger>
            <TabsTrigger value="invitations">
              <Mail data-icon="inline-start" />
              Invitations
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings2 data-icon="inline-start" />
              Réglages
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col">
          <TabsContent value="overview" className="mt-0 min-h-0 flex-1">
            <ScrollArea className="h-full pr-3 [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
              <OrganizationOverviewPanel
                selectedOrganizationId={selectedOrganizationId}
                selectedOrganization={selectedOrganization}
                hierarchy={hierarchy}
                brandGroups={brandGroups}
                brandsCount={brandsCount}
                onOpenCreateProject={onOpenCreateProject}
                loading={loading}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="members" className="mt-0 min-h-0 flex-1">
            <ScrollArea className="h-full pr-3 [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
              <MemoizedMembersPanel
                loading={loading}
                members={members}
                selectedOrganizationId={selectedOrganizationId}
                teamsByID={teamsByID}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="invitations" className="mt-0 min-h-0 flex-1">
            <ScrollArea className="h-full pr-3 [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
              <MemoizedInvitationsPanel
                invitations={invitations}
                loading={loading}
                selectedOrganizationId={selectedOrganizationId}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="settings" className="mt-0 min-h-0 flex-1">
            <ScrollArea className="h-full pr-3 [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
              <OrganizationSettingsPanel
                selectedOrganization={selectedOrganization}
                canManageOrganizationSettings={canManageOrganizationSettings}
                canDeleteOrganization={canDeleteOrganization}
                editedName={editedName}
                onEditedNameChange={onEditedNameChange}
                isUpdatingName={isUpdatingName}
                onUpdateName={onUpdateName}
                showDeleteConfirm={showDeleteConfirm}
                onShowDeleteConfirm={onShowDeleteConfirm}
                deleteConfirmName={deleteConfirmName}
                onDeleteConfirmNameChange={onDeleteConfirmNameChange}
                isDeleting={isDeleting}
                onDeleteOrganization={onDeleteOrganization}
                onCancelDelete={onCancelDelete}
              />
            </ScrollArea>
          </TabsContent>
        </CardContent>
      </Card>
    </Tabs>
  );
}

const MemoizedMembersPanel = memo(function MemoizedMembersPanel({
  selectedOrganizationId,
  members,
  teamsByID,
  loading,
}: {
  selectedOrganizationId: string;
  members: OrganizationMember[];
  teamsByID: Map<number, string>;
  loading: boolean;
}) {
  if (!selectedOrganizationId) {
    return (
      <EmptyPanel
        title="Aucune organisation sélectionnée"
        description="Choisissez une organisation pour consulter les membres associés."
      />
    );
  }

  if (loading) {
    return <TableLoadingState label="Membres" />;
  }

  if (members.length === 0) {
    return (
      <EmptyPanel
        title="Aucun membre"
        description="Cette organisation ne contient encore aucun membre."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex items-center gap-2">
        <Users aria-hidden="true" className="size-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{members.length} membre(s)</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Équipe</TableHead>
              <TableHead>Rôles</TableHead>
              <TableHead>Ajouté le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={`${member.OrganizationID}-${member.UserID}`}>
                <TableCell className="font-medium">{member.UserID}</TableCell>
                <TableCell>{member.TeamID > 0 ? teamsByID.get(member.TeamID) ?? `#${member.TeamID}` : "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {member.Roles.map((role) => (
                      <Badge key={role} variant="outline">
                        {formatLabel(role)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{formatDateTime(member.AddedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
});

const MemoizedInvitationsPanel = memo(function MemoizedInvitationsPanel({
  selectedOrganizationId,
  invitations,
  loading,
}: {
  selectedOrganizationId: string;
  invitations: OrganizationInvitation[];
  loading: boolean;
}) {
  if (!selectedOrganizationId) {
    return (
      <EmptyPanel
        title="Aucune organisation sélectionnée"
        description="Choisissez une organisation pour afficher les invitations en attente."
      />
    );
  }

  if (loading) {
    return <TableLoadingState label="Invitations" />;
  }

  if (invitations.length === 0) {
    return (
      <EmptyPanel
        title="Aucune invitation"
        description="Cette organisation n’a pas encore d’invitations enregistrées."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex items-center gap-2">
        <Mail aria-hidden="true" className="size-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{invitations.length} invitation(s)</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Créée le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => (
              <TableRow key={invitation.ID}>
                <TableCell className="font-medium">{invitation.Email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{formatLabel(invitation.Role)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={invitation.Status === "accepted" ? "default" : invitation.Status === "pending" ? "secondary" : "outline"}>
                    {formatLabel(invitation.Status)}
                  </Badge>
                </TableCell>
                <TableCell>{formatDateTime(invitation.CreatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
});
