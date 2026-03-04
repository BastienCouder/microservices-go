"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { API_CONFIG, apiRoutes } from "@/lib/api-config";
import { OrganizationsMainPanel } from "./_components/organizations-main-panel";
import { OrganizationsSidebar } from "./_components/organizations-sidebar";
import type { OrganizationSummary, SimulatedPlan, OrganizationTab } from "./_components/types";

type OrganizationsClientProps = {
  initialOrganizations: OrganizationSummary[];
};

const SELECTED_ORG_KEY = "selected-organization-id";
const SIM_PLAN_KEY_PREFIX = "simulated-billing-plan:";

function buildApiUrl(path: string): string {
  const base = API_CONFIG.BASE_URL?.trim();
  if (!base) return path;
  if (/^https?:\/\//.test(path)) return path;
  return `${base}${path}`;
}

async function mutate(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response;
}

export default function OrganizationsClient({ initialOrganizations }: OrganizationsClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const initialSelectedOrganizationId = initialOrganizations[0]?.id ?? "";
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>(initialSelectedOrganizationId);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [draftPlan, setDraftPlan] = useState<SimulatedPlan>("free");
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);

  const [editedName, setEditedName] = useState(
    initialOrganizations.find((organization) => organization.id === initialSelectedOrganizationId)?.name ?? "",
  );
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<OrganizationTab>("members");
  const deferredSearch = useDeferredValue(search);

  const filteredOrganizations = useMemo(() => {
    if (!deferredSearch.trim()) return initialOrganizations;
    const query = deferredSearch.toLowerCase();
    return initialOrganizations.filter((organization) => organization.name.toLowerCase().includes(query));
  }, [initialOrganizations, deferredSearch]);

  const selectedOrganization = useMemo(
    () => initialOrganizations.find((organization) => organization.id === selectedOrganizationId) || null,
    [initialOrganizations, selectedOrganizationId],
  );
  const canManageOrganizationSettings = selectedOrganization?.role === "owner" || selectedOrganization?.role === "admin";
  const canDeleteOrganization = selectedOrganization?.role === "owner";

  const refreshData = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handleSelectOrganization = (organizationId: string) => {
    setSelectedOrganizationId(organizationId);
    const selected = initialOrganizations.find((organization) => organization.id === organizationId);
    setEditedName(selected?.name ?? "");
    setShowDeleteConfirm(false);
    setDeleteConfirmName("");
    window.localStorage.setItem(SELECTED_ORG_KEY, organizationId);
  };

  const handleCreateOnBilling = async () => {
    const name = draftName.trim();
    const slug = generateSlug(draftSlug.trim() || draftName.trim());
    if (!name) {
      setError("Organization name is required");
      return;
    }
    if (!slug) {
      setError("Please provide a valid slug");
      return;
    }

    setIsCreatingOrganization(true);
    setError(null);
    try {
      const response = await mutate(apiRoutes.organizations.create(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });

      const json = await response.json();
      const createdId = extractCreatedId(json);
      if (createdId) {
        window.localStorage.setItem(SELECTED_ORG_KEY, createdId);
        window.localStorage.setItem(`${SIM_PLAN_KEY_PREFIX}${createdId}`, draftPlan);
        setSelectedOrganizationId(createdId);
      }

      setShowCreateWizard(false);
      setDraftName("");
      setDraftSlug("");
      setDraftPlan("free");
      refreshData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create organization";
      setError(message);
    } finally {
      setIsCreatingOrganization(false);
    }
  };

  const handleUpdateOrganizationName = async () => {
    if (!selectedOrganization) return;
    const nextName = editedName.trim();
    if (!nextName || nextName === selectedOrganization.name) return;

    setIsUpdatingName(true);
    setError(null);
    try {
      await mutate(apiRoutes.organizations.update(selectedOrganization.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      refreshData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update organization name";
      setError(message);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!selectedOrganization) return;
    if (deleteConfirmName.trim() !== selectedOrganization.name) {
      setError("Type the organization name to confirm deletion");
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      await mutate(apiRoutes.organizations.delete(selectedOrganization.id), {
        method: "DELETE",
      });
      setShowDeleteConfirm(false);
      setDeleteConfirmName("");
      // Select another org if available
      const remaining = initialOrganizations.filter((org) => org.id !== selectedOrganization.id);
      if (remaining.length > 0) {
        setSelectedOrganizationId(remaining[0].id);
        setEditedName(remaining[0].name);
        window.localStorage.setItem(SELECTED_ORG_KEY, remaining[0].id);
      } else {
        setSelectedOrganizationId("");
        setEditedName("");
        window.localStorage.removeItem(SELECTED_ORG_KEY);
      }
      refreshData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete organization";
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-hidden p-2 md:p-4">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md bg-background p-3 md:p-4">
        <div className="mb-6 shrink-0">
          <h1 className="text-3xl font-semibold tracking-tight">Organizations</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create organizations from billing simulation, then manage team and org settings.
          </p>
        </div>

        {error ? (
          <div className="mb-6 shrink-0 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="min-h-0 flex flex-1 flex-col gap-6 lg:flex-row">
          <OrganizationsSidebar
            search={search}
            onSearchChange={setSearch}
            showCreateWizard={showCreateWizard}
            onToggleCreateWizard={() => setShowCreateWizard((prev) => !prev)}
            draftName={draftName}
            onDraftNameChange={(value) => {
              setDraftName(value);
              setDraftSlug(generateSlug(value));
            }}
            draftSlug={draftSlug}
            onDraftSlugChange={(value) => setDraftSlug(generateSlug(value))}
            draftPlan={draftPlan}
            onDraftPlanChange={setDraftPlan}
            isCreatingOrganization={isCreatingOrganization}
            onCreate={() => void handleCreateOnBilling()}
            onCancelCreate={() => {
              setShowCreateWizard(false);
              setDraftName("");
              setDraftSlug("");
              setDraftPlan("free");
            }}
            organizations={filteredOrganizations}
            selectedOrganizationId={selectedOrganizationId}
            onSelectOrganization={handleSelectOrganization}
            getSimulatedPlanLabel={getPlanLabel}
          />

          <Separator orientation="vertical" className="hidden lg:block" />

          <OrganizationsMainPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            selectedOrganization={selectedOrganization}
            selectedOrganizationId={selectedOrganizationId}
            canManageOrganizationSettings={canManageOrganizationSettings}
            canDeleteOrganization={canDeleteOrganization}
            editedName={editedName}
            onEditedNameChange={setEditedName}
            isUpdatingName={isUpdatingName}
            onUpdateName={() => void handleUpdateOrganizationName()}
            showDeleteConfirm={showDeleteConfirm}
            onShowDeleteConfirm={setShowDeleteConfirm}
            deleteConfirmName={deleteConfirmName}
            onDeleteConfirmNameChange={setDeleteConfirmName}
            isDeleting={isDeleting}
            onDeleteOrganization={() => void handleDeleteOrganization()}
            onCancelDelete={() => {
              setShowDeleteConfirm(false);
              setDeleteConfirmName("");
            }}
          />
        </div>
      </div>
    </div>
  );
}

// --- Helpers (client-side only, no data fetching) ---

function extractCreatedId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  // unwrap API envelope
  const data = isRecord((value as Record<string, unknown>).data)
    ? (value as Record<string, unknown>).data as Record<string, unknown>
    : value as Record<string, unknown>;
  const payload = isRecord(data.organization) ? data.organization as Record<string, unknown> : data;
  const org = isRecord(payload.props) ? payload.props as Record<string, unknown> : payload;
  const id = org.id;
  return typeof id === "string" && id ? id : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function generateSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getPlanLabel(organizationId: string): string | null {
  if (typeof window === "undefined") return null;
  const plan = window.localStorage.getItem(`${SIM_PLAN_KEY_PREFIX}${organizationId}`) as SimulatedPlan | null;
  if (!plan) return null;
  if (plan === "free") return "Sim Free";
  if (plan === "pro-monthly") return "Sim Pro Monthly";
  return "Sim Pro Yearly";
}
