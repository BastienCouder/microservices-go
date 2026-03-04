"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { API_CONFIG, apiRoutes } from "@/lib/api-config";
import { cn } from "@/lib/utils";

type MemberRole = "owner" | "admin" | "member";

type OrgMember = {
  userId: string;
  role: MemberRole;
  joinedAt?: string;
  email: string;
};

type TeamData = {
  organizationId: string;
  organizationName: string;
  currentUserRole: MemberRole;
  currentUserId?: string;
  members: OrgMember[];
};

type PendingInvitation = {
  email: string;
  role: "admin" | "member";
  invitedAt: string;
};

type MembershipSummary = {
  id?: string;
  organizationId?: string;
};

type OrganizationOption = {
  id: string;
  name: string;
};

const SELECTED_ORG_KEY = "selected-organization-id";

export default function TeamClient() {
  return <TeamMembersPanel />;
}

export function TeamMembersPanel({
  embedded = false,
  forcedOrganizationId,
  showOrganizationSelector = true,
  section = "all",
}: {
  embedded?: boolean;
  forcedOrganizationId?: string;
  showOrganizationSelector?: boolean;
  section?: "all" | "members" | "invitations";
}) {
  const [data, setData] = useState<TeamData | null>(null);
  const [organizationOptions, setOrganizationOptions] = useState<OrganizationOption[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [roleFilter, setRoleFilter] = useState<"all" | MemberRole>("all");
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);

  const canManageMembers = useMemo(() => {
    if (!data) return false;
    return data.currentUserRole === "owner" || data.currentUserRole === "admin";
  }, [data]);

  const visibleMembers = useMemo(() => {
    if (!data) return [];
    if (roleFilter === "all") return data.members;
    return data.members.filter((member) => member.role === roleFilter);
  }, [data, roleFilter]);

  useEffect(() => {
    void bootstrapTeamData();
  }, [forcedOrganizationId]);

  const bootstrapTeamData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const membershipsRaw = await fetchJson(apiRoutes.organizations.me());
      const memberships = normalizeMemberships(membershipsRaw);

      if (memberships.length === 0) {
        setOrganizationOptions([]);
        setSelectedOrganizationId("");
        setData(null);
        return;
      }

      const organizationIds = memberships
        .map((membership) => membership.organizationId ?? membership.id ?? "")
        .filter((id) => !!id);

      const options = await Promise.all(
        organizationIds.map(async (organizationId) => {
          try {
            const organizationRaw = await fetchJson(apiRoutes.organizations.get(organizationId));
            const organizationData = normalizeOrganization(organizationRaw, organizationId);
            return {
              id: organizationData.organizationId,
              name: organizationData.organizationName,
            };
          } catch {
            return { id: organizationId, name: `Organization ${organizationId.slice(0, 8)}` };
          }
        }),
      );

      const uniqueOptions = Array.from(
        new Map(options.map((option) => [option.id, option] as const)).values(),
      );
      setOrganizationOptions(uniqueOptions);

      const selectedId = window.localStorage.getItem(SELECTED_ORG_KEY);
      const fallbackId = memberships[0]?.organizationId ?? memberships[0]?.id ?? "";
      const organizationId =
        forcedOrganizationId && memberships.some((membership) => (membership.organizationId ?? membership.id) === forcedOrganizationId)
          ? forcedOrganizationId
          : selectedId && memberships.some((membership) => (membership.organizationId ?? membership.id) === selectedId)
            ? selectedId
            : fallbackId;

      if (!organizationId) {
        setSelectedOrganizationId("");
        setData(null);
        return;
      }

      setSelectedOrganizationId(organizationId);
      if (window.localStorage.getItem(SELECTED_ORG_KEY) !== organizationId) {
        window.localStorage.setItem(SELECTED_ORG_KEY, organizationId);
      }
      await loadOrganizationDetails(organizationId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load team members";
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrganizationDetails = async (organizationId: string) => {
    const organizationRaw = await fetchJson(apiRoutes.organizations.get(organizationId));
    const normalized = normalizeOrganization(organizationRaw, organizationId);
    setData(normalized);
  };

  const handleOrganizationChange = async (organizationId: string) => {
    setSelectedOrganizationId(organizationId);
    window.localStorage.setItem(SELECTED_ORG_KEY, organizationId);
    setError(null);
    setIsLoading(true);
    try {
      await loadOrganizationDetails(organizationId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load selected organization";
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;
    if (!email.trim()) return;

    setIsInviting(true);
    setError(null);
    try {
      await fetchJson(apiRoutes.organizations.inviteMember(data.organizationId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          role: inviteRole,
        }),
      });

      setPendingInvitations((current) => [
        {
          email: email.trim(),
          role: inviteRole,
          invitedAt: new Date().toISOString(),
        },
        ...current,
      ]);
      setEmail("");
      setInviteRole("member");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send invitation";
      setError(message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!data) return;
    const shouldRemove = window.confirm("Remove this member from the organization?");
    if (!shouldRemove) return;

    setError(null);
    try {
      await fetchJson(apiRoutes.organizations.removeMember(data.organizationId, userId), {
        method: "DELETE",
      });
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          members: current.members.filter((member) => member.userId !== userId),
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove member";
      setError(message);
    }
  };

  const canChangeRole = (member: OrgMember) => {
    if (!data) return false;
    if (member.role === "owner") return false;
    if (member.userId === data.currentUserId) return false;
    if (data.currentUserRole === "owner") return true;
    if (data.currentUserRole === "admin") return member.role === "member";
    return false;
  };

  const handleRoleChange = async (member: OrgMember, nextRole: "admin" | "member") => {
    if (!data) return;
    if (!canChangeRole(member)) return;

    setError(null);
    try {
      await fetchJson(apiRoutes.organizations.updateMemberRole(data.organizationId, member.userId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          members: current.members.map((item) => (
            item.userId === member.userId ? { ...item, role: nextRole } : item
          )),
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update member role";
      setError(message);
    }
  };

  if (isLoading) {
    return <TeamMembersSkeleton embedded={embedded} section={section} />;
  }

  if (!data) {
    return (
      <div className={cn("p-6", embedded && "p-2")}>
        {!embedded ? <h1 className="text-2xl font-semibold">Team Members</h1> : null}
        <p className="mt-2 text-sm text-muted-foreground">
          No organization found for your account. Create or join an organization first.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("mx-auto w-full max-w-5xl p-6 md:p-8", embedded && "max-w-none p-0 md:p-0")}>
      {!embedded ? (
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Team Members</h1>
          <p className="mt-2 text-muted-foreground">
            Manage members and invitations for <span className="font-medium">{data.organizationName}</span>.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {section === "all" || section === "members" ? (
        <Card className="mb-6 border-0 shadow-none p-2">
          <CardHeader className="pb-0 px-0">
            <CardTitle>Members</CardTitle>
            <CardDescription>Manage your organization&apos;s members and roles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            {showOrganizationSelector && organizationOptions.length > 1 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Current organization</p>
                <Select value={selectedOrganizationId} onValueChange={(value) => void handleOrganizationChange(value)}>
                  <SelectTrigger className="w-full sm:w-[320px]">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizationOptions.map((organization) => (
                      <SelectItem key={organization.id} value={organization.id}>
                        {organization.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as "all" | MemberRole)}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Organization Role</TableHead>
                    <TableHead>Project Access</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No members found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleMembers.map((member) => (
                      <TableRow key={member.userId}>
                        <TableCell className="font-medium">{member.email}</TableCell>
                        <TableCell>
                          {canChangeRole(member) ? (
                            <Select
                              value={member.role}
                              onValueChange={(value) => void handleRoleChange(member, value as "admin" | "member")}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="capitalize">{member.role}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">Full access</Badge>
                        </TableCell>
                        <TableCell>{formatDate(member.joinedAt)}</TableCell>
                        <TableCell className="text-right">
                          {canManageMembers && member.role !== "owner" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => void handleRemoveMember(member.userId)}
                            >
                              Remove
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {section === "all" || section === "invitations" ? (
        <>
          <Card className="mb-6 border-0 shadow-none p-2">
            <CardHeader className="pb-0 px-0">
              <CardTitle>Invite New Member</CardTitle>
              <CardDescription>Enter the email address of the user you want to invite.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row">
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    required
                    disabled={!canManageMembers || isInviting}
                  />
                  <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as "admin" | "member")}>
                    <SelectTrigger className="w-full md:w-[180px]" disabled={!canManageMembers || isInviting}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" disabled={!canManageMembers || isInviting}>
                    {isInviting ? "Sending..." : "Send Invite"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="mb-6 border-0 shadow-none p-2">
            <CardHeader className="pb-0 px-0">
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>These users have been invited but haven&apos;t accepted yet.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {pendingInvitations.length === 0 ? (
                <div className="rounded-md border p-8 text-center text-muted-foreground">No pending invitations.</div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Invited</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingInvitations.map((invitation) => (
                        <TableRow key={`${invitation.email}-${invitation.invitedAt}`}>
                          <TableCell>{invitation.email}</TableCell>
                          <TableCell className="capitalize">{invitation.role}</TableCell>
                          <TableCell>{formatDate(invitation.invitedAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  if (isApiEnvelope(json)) {
    return json.data;
  }
  return json;
}

function buildApiUrl(path: string): string {
  const base = API_CONFIG.BASE_URL?.trim();
  if (!base) return path;
  if (/^https?:\/\//.test(path)) return path;
  return `${base}${path}`;
}

function normalizeMemberships(value: unknown): MembershipSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const props = isRecord(item.props) ? item.props : item;
      return {
        id: getString(props.id) ?? getString(item.id) ?? undefined,
        organizationId:
          getString(props.organizationId) ??
          getString(item.organizationId) ??
          undefined,
      };
    });
}

function normalizeOrganization(value: unknown, fallbackOrganizationId: string): TeamData {
  const objectValue = isRecord(value) ? value : {};
  const organizationObject = isRecord(objectValue.organization) ? objectValue.organization : objectValue;
  const payload = isRecord(organizationObject.props) ? organizationObject.props : organizationObject;
  const membersValue = Array.isArray(objectValue.members)
    ? objectValue.members
    : Array.isArray(payload.members)
      ? payload.members
      : [];
  const currentUserMemberObject = isRecord(objectValue.currentUserMember)
    ? objectValue.currentUserMember
    : isRecord(payload.currentUserMember)
      ? payload.currentUserMember
      : {};
  const currentUserMember = isRecord(currentUserMemberObject.props)
    ? currentUserMemberObject.props
    : currentUserMemberObject;

  const organizationId = getString(payload.id) || fallbackOrganizationId;
  const organizationName = getString(payload.name) || "Organization";
  const currentUserRole = normalizeRole(currentUserMember.role) || "member";
  const currentUserId = getString(currentUserMember.userId) || getString(currentUserMember.authUserId) || undefined;
  const members = membersValue.map(normalizeMember).filter((member): member is OrgMember => member !== null);

  return {
    organizationId,
    organizationName,
    currentUserRole,
    currentUserId,
    members,
  };
}

function normalizeMember(value: unknown): OrgMember | null {
  if (!isRecord(value)) return null;
  const props = isRecord(value.props) ? value.props : value;
  const user = isRecord(value.user) ? value.user : isRecord(props.user) ? props.user : {};
  const role = normalizeRole(props.role || value.role);
  const userId = getString(props.userId) || getString(props.authUserId) || getString(value.userId) || getString(value.authUserId);
  const joinedAt = getString(props.joinedAt) || getString(value.joinedAt);
  const email = getString(user.email) || getString(value.email) || getString(props.email) || "Email unavailable";

  if (!role || !userId) return null;

  return {
    userId,
    role,
    joinedAt: joinedAt ?? undefined,
    email,
  };
}

function normalizeRole(value: unknown): MemberRole | null {
  const roleValue = typeof value === "string"
    ? value
    : isRecord(value) && typeof value.value === "string"
      ? value.value
      : "";

  if (roleValue === "owner" || roleValue === "admin" || roleValue === "member") {
    return roleValue;
  }

  return null;
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiEnvelope(value: unknown): value is { data: unknown; status: number; message: string } {
  return isRecord(value) && "data" in value && "status" in value && "message" in value;
}

function TeamMembersSkeleton({
  embedded = false,
  section = "all",
}: {
  embedded?: boolean;
  section?: "all" | "members" | "invitations";
}) {
  return (
    <div className={cn("mx-auto w-full max-w-5xl p-6 md:p-8", embedded && "max-w-none p-0 md:p-0")}>
      {!embedded ? (
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Team Members</h1>
          <p className="mt-2 text-muted-foreground">Manage members and invitations for your organization.</p>
        </div>
      ) : null}

      {section === "all" || section === "members" ? (
        <Card className="mb-6 border-0 shadow-none">
          <CardHeader className="pb-0">
            <CardTitle>Members</CardTitle>
            <CardDescription>Manage your organization&apos;s members and roles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Skeleton className="h-10 w-full sm:w-[220px]" />
            </div>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Organization Role</TableHead>
                    <TableHead>Project Access</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-8" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {section === "all" || section === "invitations" ? (
        <>
          <Card className="mb-6 border-0 shadow-none">
            <CardHeader className="pb-0">
              <CardTitle>Invite New Member</CardTitle>
              <CardDescription>Enter the email address of the user you want to invite.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 md:flex-row">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-full md:w-[180px]" />
                <Skeleton className="h-10 w-32" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-none">
            <CardHeader className="pb-0">
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>These users have been invited but haven&apos;t accepted yet.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border p-4">
                <Skeleton className="h-4 w-40" />
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
