"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";
import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON, unwrapGatewayPayload } from "@/shared/api/gateway";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

type AdminUsersPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

type AdminUser = {
  ID: number;
  AuthIdentityID: string;
  Email: string;
  FirstName: string;
  LastName: string;
  Banned: boolean;
  BannedAt?: string | null;
  CreatedAt?: string | null;
  DeletedAt?: string | null;
  is_super_admin?: boolean;
  IsSuperAdmin?: boolean;
};

const EMPTY_USERS: AdminUser[] = [];

function isSuperAdmin(user: AdminUser): boolean {
  return user.is_super_admin === true || user.IsSuperAdmin === true;
}

async function loadAdminUsers(
  apiBaseURL: string,
  signal?: AbortSignal,
): Promise<AdminUser[]> {
  const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.admin.users(), {
    method: "GET",
    signal,
  });
  if (!response.ok) {
    throw new Error(response.error);
  }
  const payload = unwrapGatewayPayload(response.data);
  return Array.isArray(payload) ? (payload as AdminUser[]) : EMPTY_USERS;
}

async function grantUserSuperAdmin(apiBaseURL: string, userId: string): Promise<void> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.admin.grantUserSuperAdmin(userId),
    { method: "POST" },
  );
  if (!response.ok) {
    throw new Error(response.error);
  }
}

function formatUserName(user: AdminUser): string {
  const name = [user.FirstName, user.LastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  return name || user.Email || `User ${user.ID}`;
}

function formatDate(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function AdminUsersPage({ apiBaseURL }: AdminUsersPageProps) {
  const { t } = useScopedI18n("admin-users");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const usersQueryKey = useMemo(() => ["admin-users", apiBaseURL], [apiBaseURL]);
  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadAdminUsers(apiBaseURL, signal),
  });

  const users = usersQuery.data ?? EMPTY_USERS;
  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch === "") return users;
    return users.filter((user) =>
      [
        String(user.ID),
        user.Email,
        user.FirstName,
        user.LastName,
        user.AuthIdentityID,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [search, users]);

  const promoteMutation = useMutation({
    mutationFn: (userId: string) => grantUserSuperAdmin(apiBaseURL, userId),
    onSuccess: async () => {
      pushSuccessToast(t("promoteSuccess"));
      await queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
    onError: (error) => {
      pushErrorToast(error, t("promoteError"));
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-2 md:p-4">
      <PageHeader
        title={t("pageTitle")}
        baseline={t("pageBaseline")}
        actionsVariant="classic"
        className="mb-3 md:mb-4"
        meta={<Badge variant="default">{t("usersCount", { count: users.length })}</Badge>}
      />

      <div className="flex min-h-0 flex-1 flex-col rounded-md rounded-tr-none bg-background">
        <div className="border-b px-4 py-4 md:px-6">
          <div className="relative max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>
        </div>

        <div className="border-b px-4 py-3 md:px-6">
          <Badge variant="outline" className="h-9 px-3 text-sm">
            {t("displayedUsers", { count: filteredUsers.length })}
          </Badge>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
          {usersQuery.isLoading ? (
            <AdminUsersLoading />
          ) : usersQuery.isError ? (
            <EmptyState label={t("loadError")} />
          ) : users.length === 0 ? (
            <EmptyState label={t("noUsers")} />
          ) : filteredUsers.length === 0 ? (
            <EmptyState label={t("noFilteredUser")} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/70">
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("columnUser")}</TableHead>
                      <TableHead>{t("columnStatus")}</TableHead>
                      <TableHead>{t("columnCreated")}</TableHead>
                      <TableHead className="text-right">{t("columnAction")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <AdminUserRow
                        key={user.ID}
                        user={user}
                        pending={promoteMutation.isPending}
                        onPromote={() => promoteMutation.mutate(String(user.ID))}
                      />
                    ))}
                  </TableBody>
                </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminUserRow({
  user,
  pending,
  onPromote,
}: {
  user: AdminUser;
  pending: boolean;
  onPromote: () => void;
}) {
  const { t } = useScopedI18n("admin-users");
  const superAdmin = isSuperAdmin(user);
  const deleted = Boolean(user.DeletedAt);
  const disabled = pending || superAdmin || deleted;

  return (
    <TableRow>
      <TableCell>
        <div className="min-w-[220px]">
          <div className="font-medium text-foreground">{formatUserName(user)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {user.Email || `ID ${user.ID}`}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1 text-sm">
          {superAdmin ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-primary">
              <ShieldCheck className="size-4" />
              {t("superAdmin")}
            </span>
          ) : (
            <span>{t("standardUser")}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {deleted ? t("deleted") : user.Banned ? t("banned") : t("active")}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(user.CreatedAt, t("unknownDate"))}
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          size="sm"
          onClick={onPromote}
          disabled={disabled}
          className="gap-2"
        >
          <ShieldCheck className="size-4" />
          {superAdmin ? t("alreadySuperAdmin") : pending ? t("promoting") : t("makeSuperAdmin")}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AdminUsersLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-32 rounded-full" />
      <div className="overflow-hidden rounded-md border border-border">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[1.4fr_1fr_1fr_160px] gap-4 border-b border-border p-4 last:border-b-0">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-md border border-dashed border-border bg-background text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export default AdminUsersPage;
