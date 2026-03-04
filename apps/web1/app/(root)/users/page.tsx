import { redirect } from "next/navigation";
import type { ProfileMe } from "@/types/profile";
import UsersClient from "./users-client";
import { apiFetch } from "@/lib/server-api";
import { apiRoutes } from "@/lib/api-config";


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

async function checkAuth() {
    try {
        const profile = await apiFetch<ProfileMe>(apiRoutes.profiles.me());
        return profile;
    } catch (error) {
        return null;
    }
}

export default async function UsersPage() {
    // Check authentication
    const profile = await checkAuth();
    if (!profile) {
        redirect("/auth");
    }

    // Fetch initial users data
    const initialData = await getAllUsers({ page: 1, limit: 10 });

    return <UsersClient initialData={initialData} />;
}