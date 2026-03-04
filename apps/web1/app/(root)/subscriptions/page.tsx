import { apiFetch } from "@/lib/server-api";
import { SubscriptionsTable } from "./subscriptions-table";
import { ProfileMe } from "@/types/profile";

export type UsersFilters = {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
};

export type PaginatedUsers = {
    data: ProfileMe[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
};

export async function getAllUsers(filters: UsersFilters = {}) {
    const params = new URLSearchParams();
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);

    const queryString = params.toString();
    const url = `/users/admin/users${queryString ? `?${queryString}` : ""}`;

    const response = await apiFetch<PaginatedUsers>(url);

    return response || { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } };
}

export default async function SubscriptionsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const resolvedParams = await searchParams;
    const page = Number(resolvedParams.page) || 1;
    const search = typeof resolvedParams.search === "string" ? resolvedParams.search : undefined;
    const status = typeof resolvedParams.status === "string" ? resolvedParams.status : undefined;

    const { data, meta } = await getAllUsers({ page, limit: 10, search, status });

    return (
        <main className="flex-1 p-8 max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Gestion des Abonnements</h1>
                <p className="text-muted-foreground mt-2">
                    Vue d'ensemble de tous les utilisateurs et de leurs statuts d'abonnement.
                </p>
            </div>

            <SubscriptionsTable users={data} meta={meta} />
        </main>
    );
}
