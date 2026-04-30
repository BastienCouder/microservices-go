import type { OrganizationMember, OrganizationRole } from "./types";

export function formatDateTime(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatLabel(value: string): string {
  const normalized = value.trim().replace(/[-_]+/g, " ");
  if (!normalized) return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getInitials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "OR";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase();
}

export function getRoleBadgeVariant(
  role: OrganizationRole | string,
): "default" | "secondary" | "outline" {
  if (role === "owner") return "default";
  if (role === "admin") return "secondary";
  return "outline";
}

export function getStatusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "active") return "default";
  if (status === "pending") return "secondary";
  return "outline";
}

export function memberLabel(
  member: Pick<OrganizationMember, "userId"> & Partial<Pick<OrganizationMember, "firstName" | "lastName" | "email">>,
): string {
  const fullName = [member.firstName, member.lastName].map((value) => value?.trim()).filter(Boolean).join(" ");
  if (fullName) return fullName;
  if (member.email?.trim()) return member.email.trim();
  return `User ${member.userId}`;
}
