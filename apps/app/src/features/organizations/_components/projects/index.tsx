import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FolderPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyBlock } from "../shared/empty-block";
import { ProjectCard } from "./project-card";
import type {
  OrganizationMember,
  OrganizationProject,
  OrganizationProjectMember,
  ProjectMemberDraft,
} from "../../_lib/shared/types";

type ProjectsPanelProps = {
  projects: OrganizationProject[];
  members: OrganizationMember[];
  projectMembers: OrganizationProjectMember[];
  currentUserId: string;
  memberDrafts: Record<string, ProjectMemberDraft>;
  onboardingHref: string;
  search: string;
  onMemberDraftChange: (projectId: string, draft: ProjectMemberDraft) => void;
  onSearchChange: (value: string) => void;
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
  search,
  onMemberDraftChange,
  onSearchChange,
  onAssignProjectMember,
  onRemoveProjectMember,
  memberBusy,
  removeMemberBusy,
}: ProjectsPanelProps) {
  const filteredProjects = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((project) =>
      [project.name, project.brandName, project.status, project.attributionSource]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [projects, search]);

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2>
              <SectionTitle>Projets</SectionTitle>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {members.length} membre{members.length > 1 ? "s" : ""} orga ont acces a ces projets.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Rechercher"
                className="pl-9"
              />
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link to={onboardingHref}>
                <FolderPlus data-icon="inline-start" />
                Creer un nouveau projet
              </Link>
            </Button>
          </div>
        </div>

        <div className="p-4">
          {filteredProjects.length === 0 ? (
            <EmptyBlock
              title="Aucun projet"
              description="Cree un premier projet pour alimenter cette organisation."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
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
                    availableMembers={availableMembers}
                    projectMembers={projectMembers}
                    currentUserId={currentUserId}
                    memberDraft={memberDraft}
                    memberBusy={memberBusy}
                    removeMemberBusy={removeMemberBusy}
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
