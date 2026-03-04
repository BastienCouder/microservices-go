"use client";

import { useState } from "react";
import { Trash, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InviteMemberDialog } from "./invite-member-dialog";
import { apiRoutes } from "@/lib/api-config";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  members: Array<{
    userId: string;
    role: "owner" | "admin" | "member";
    joinedAt: string;
    user: {
      id: string;
      email: string;
      name: string | null;
    };
  }>;
  currentUserMember: {
    role: "owner" | "admin" | "member";
  };
}

interface OrganizationSettingsProps {
  organization: Organization;
}

export function OrganizationSettings({ organization }: OrganizationSettingsProps) {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [name, setName] = useState(organization.name);
  const [isUpdating, setIsUpdating] = useState(false);

  const canManage = ["owner", "admin"].includes(organization.currentUserMember.role);

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsUpdating(true);
    try {
      const response = await fetch(apiRoutes.organizations.update(organization.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error("Failed to update organization");
      }

      window.location.reload();
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;

    try {
      const response = await fetch(apiRoutes.organizations.removeMember(organization.id, userId), {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to remove member");
      }

      window.location.reload();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{organization.name}</h1>
        <p className="text-muted-foreground">Manage your organization settings and members</p>
      </div>

      {canManage ? (
        <div className="rounded-lg border p-6">
          <h2 className="mb-4 text-xl font-semibold">General Settings</h2>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <Button type="submit" disabled={isUpdating || name === organization.name}>
              {isUpdating ? "Updating..." : "Update"}
            </Button>
          </form>
        </div>
      ) : null}

      <div className="rounded-lg border p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Members</h2>
          {canManage ? (
            <Button onClick={() => setShowInviteDialog(true)} size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          ) : null}
        </div>

        <div className="space-y-2">
          {organization.members.map((member) => (
            <div key={member.userId} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{member.user.email}</p>
                <p className="text-sm capitalize text-muted-foreground">{member.role}</p>
              </div>
              {canManage && member.role !== "owner" ? (
                <Button variant="ghost" size="sm" onClick={() => void handleRemoveMember(member.userId)}>
                  <Trash className="h-4 w-4 text-red-600" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <InviteMemberDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        organizationId={organization.id}
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
}
