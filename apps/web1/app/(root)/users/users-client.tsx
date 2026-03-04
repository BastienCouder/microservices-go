"use client";

import { useState } from "react";
import type { ProfileMe } from "@/types/profile";
import { getAllUsers } from "./page";

type PaginatedUsers = {
    data: ProfileMe[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
};

type UsersClientProps = {
    initialData: PaginatedUsers;
};

export default function UsersClient({ initialData }: UsersClientProps) {
    const [users, setUsers] = useState(initialData);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<string>("all");
    const [loading, setLoading] = useState(false);

    const loadUsers = async (newPage: number, newSearch?: string, newStatus?: string) => {
        setLoading(true);
        try {
            const filters = {
                page: newPage,
                limit: 10,
                search: newSearch || undefined,
                status: newStatus && newStatus !== "all" ? newStatus : undefined,
            };

            const data = await getAllUsers(filters);
            setUsers(data);
            setPage(newPage);
        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (value: string) => {
        setSearch(value);
        setPage(1);
        loadUsers(1, value, status);
    };

    const handleStatusChange = (value: string) => {
        setStatus(value);
        setPage(1);
        loadUsers(1, search, value);
    };

    const handlePageChange = (newPage: number) => {
        loadUsers(newPage, search, status);
    };

    const getStatusBadge = (user: ProfileMe) => {
        if (!user.subscriptionStatus || user.subscriptionStatus === "none") {
            return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">Free</span>;
        }
        if (user.subscriptionStatus === "active") {
            return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Active</span>;
        }
        if (user.subscriptionStatus === "canceled" || user.subscriptionStatus === "cancelled") {
            return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Canceled</span>;
        }
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">{user.subscriptionStatus}</span>;
    };

    const getPlanBadge = (user: ProfileMe) => {
        const plan = user.subscriptionProductId || user.planSlug;
        if (plan === "pro-monthly") {
            return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">Pro Monthly</span>;
        }
        if (plan === "pro-yearly") {
            return <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700">Pro Yearly</span>;
        }
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">Free</span>;
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
                    <p className="text-gray-600 mt-2">Manage all users and their subscriptions</p>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Search */}
                        <div>
                            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                                Search by name or email
                            </label>
                            <input
                                id="search"
                                type="text"
                                value={search}
                                onChange={(e) => handleSearch(e.target.value)}
                                placeholder="Search users..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Status Filter */}
                        <div>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                                Subscription Status
                            </label>
                            <select
                                id="status"
                                value={status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">All</option>
                                <option value="none">Free</option>
                                <option value="active">Active</option>
                                <option value="canceled">Canceled</option>
                                <option value="trialing">Trialing</option>
                            </select>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
                        <span className="font-medium">Total: {users.meta.total} users</span>
                        <span>•</span>
                        <span>Page {users.meta.page} of {users.meta.totalPages}</span>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {loading && (
                        <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Plan
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Period End
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {users.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            No users found
                                        </td>
                                    </tr>
                                ) : (
                                    users.data.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                                                        {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || "U"}
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {user.displayName || "No name"}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            ID: {user.authUserId.slice(0, 8)}...
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900">{user.email || "N/A"}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {getPlanBadge(user)}
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(user)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900">
                                                    {user.currentPeriodEnd
                                                        ? new Date(user.currentPeriodEnd).toLocaleDateString()
                                                        : "N/A"
                                                    }
                                                </div>
                                                {user.cancelAtPeriodEnd && (
                                                    <div className="text-xs text-red-600 mt-1">Will cancel</div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {users.meta.totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1 || loading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>

                            <div className="flex gap-2">
                                {Array.from({ length: users.meta.totalPages }, (_, i) => i + 1)
                                    .filter(p => {
                                        // Show first, last, current, and adjacent pages
                                        return p === 1 ||
                                            p === users.meta.totalPages ||
                                            Math.abs(p - page) <= 1;
                                    })
                                    .map((p, i, arr) => {
                                        // Add ellipsis
                                        if (i > 0 && p - arr[i - 1] > 1) {
                                            return [
                                                <span key={`ellipsis-${p}`} className="px-2 text-gray-400">...</span>,
                                                <button
                                                    key={p}
                                                    onClick={() => handlePageChange(p)}
                                                    disabled={loading}
                                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${page === p
                                                        ? "bg-blue-500 text-white"
                                                        : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                >
                                                    {p}
                                                </button>
                                            ];
                                        }
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => handlePageChange(p)}
                                                disabled={loading}
                                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${page === p
                                                    ? "bg-blue-500 text-white"
                                                    : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                            >
                                                {p}
                                            </button>
                                        );
                                    })}
                            </div>

                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === users.meta.totalPages || loading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
