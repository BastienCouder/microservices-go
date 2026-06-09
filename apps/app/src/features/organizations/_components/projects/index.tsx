import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FolderPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/shared/section-title";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { EmptyBlock } from "../shared/empty-block";
import { ProjectCard } from "./project-card";
import type {
  OrganizationMember,
  OrganizationProject,
  OrganizationProjectMember,
  ProjectSettingsInput,
  ProjectMemberDraft,
} from "../../_lib/shared/types";

type ProjectsPanelProps = {
  projects: OrganizationProject[];
  members: OrganizationMember[];
  projectMembers: OrganizationProjectMember[];
  currentUserId: string;
  memberDrafts: Record<string, ProjectMemberDraft>;
  onboardingHref: string;
  onStartOnboarding: () => void;
  search: string;
  canManageProjects: boolean;
  canDeleteProjects: boolean;
  deletingProjectId: string;
  projectSettingsBusy: boolean;
  onMemberDraftChange: (projectId: string, draft: ProjectMemberDraft) => void;
  onSearchChange: (value: string) => void;
  onUpdateProjectSettings: (projectId: string, input: ProjectSettingsInput) => void;
  onDeleteProject: (projectId: string) => void;
  onAssignProjectMember: (projectId: string) => void;
  onRemoveProjectMember: (projectId: string, userId: string) => void;
  memberBusy: boolean;
  removeMemberBusy: boolean;
};

export function ProjectsPanel({
  projects,
  members,
  projectMembers,
  currentUserId,
  memberDrafts,
  onboardingHref,
  onStartOnboarding,
  search,
  canManageProjects,
  canDeleteProjects,
  deletingProjectId,
  projectSettingsBusy,
  onMemberDraftChange,
  onSearchChange,
  onUpdateProjectSettings,
  onDeleteProject,
  onAssignProjectMember,
  onRemoveProjectMember,
  memberBusy,
  removeMemberBusy,
}: ProjectsPanelProps) {
  const { t } = useScopedI18n("organizations");
  const filteredProjects = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((project) =>
      [project.name, project.brandName, project.attributionSource]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [projects, search]);

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-2 md:flex-row md:items-center md:justify-between">
          <div>
            <SectionTitle showIndicator={false}>{t("projectsTitle")}</SectionTitle>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={t("search")}
                className="pl-9"
              />
            </div>
            {canManageProjects ? (
              <Button asChild className="w-full sm:w-auto">
                <Link to={onboardingHref} onClick={onStartOnboarding}>
                  <FolderPlus data-icon="inline-start" />
                  {t("createProject")}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="p-4">
          {filteredProjects.length === 0 ? (
            <EmptyBlock
              title={t("noProjectTitle")}
              description={
                canManageProjects
                  ? t("noProjectManageDescription")
                  : t("noProjectUserDescription")
              }
            />
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProjects.map((project) => {
                const assignedMembers = projectMembers.filter(
                  (member) => member.projectId === project.id,
                );
                const assignedUserIds = new Set(assignedMembers.map((member) => member.userId));
                const availableMembers = members.filter(
                  (member) => !assignedUserIds.has(member.userId),
                );
                const memberDraft = memberDrafts[project.id] ?? { userId: "", role: "viewer" };

                return (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    assignedMembers={assignedMembers}
                    organizationMembers={members}
                    availableMembers={availableMembers}
                    projectMembers={projectMembers}
                    currentUserId={currentUserId}
                    memberDraft={memberDraft}
                    memberBusy={memberBusy}
                    removeMemberBusy={removeMemberBusy}
                    canUpdateProject={canManageProjects}
                    canDeleteProject={canDeleteProjects}
                    canManageProjectMembers={canManageProjects}
                    updateProjectBusy={projectSettingsBusy}
                    deleteProjectBusy={deletingProjectId === project.id}
                    onUpdateProjectSettings={onUpdateProjectSettings}
                    onDeleteProject={onDeleteProject}
                    onRemoveProjectMember={onRemoveProjectMember}
                    onMemberDraftChange={onMemberDraftChange}
                    onAssignProjectMember={onAssignProjectMember}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
