"use client";

import { ProfileMe } from "@/types/profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, MoreHorizontal, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect, useRef } from "react";

type Meta = {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

export function SubscriptionsTable({ users, meta }: { users: ProfileMe[], meta?: Meta }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchInput, setSearchInput] = useState(searchParams.get("search")?.toString() || "");
    const isFirstRender = useRef(true);

    // Debounce de 500ms pour la recherche
    useEffect(() => {
        // Skip sur le premier render pour éviter une requête inutile
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timer = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (searchInput) {
                params.set("search", searchInput);
            } else {
                params.delete("search");
            }
            params.set("page", "1");
            router.replace(`?${params.toString()}`);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchInput]); // Seulement searchInput dans les dépendances

    const handleStatusChange = (status: string) => {
        const params = new URLSearchParams(searchParams);
        if (status && status !== "all") {
            params.set("status", status);
        } else {
            params.delete("status");
        }
        params.set("page", "1");
        router.replace(`?${params.toString()}`);
    };

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", String(newPage));
        router.replace(`?${params.toString()}`);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <CardTitle>Utilisateurs ({meta?.total || users.length})</CardTitle>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-initial">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher par nom ou email..."
                                className="pl-8 w-full sm:w-[250px]"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                            />
                        </div>
                        <select
                            className="h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            defaultValue={searchParams.get("status")?.toString() || "all"}
                            onChange={(e) => handleStatusChange(e.target.value)}
                        >
                            <option value="all">Tous les statuts</option>
                            <option value="active">Actif</option>
                            <option value="canceled">Annulé</option>
                            <option value="none">Gratuit</option>
                        </select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="relative w-full overflow-auto rounded-md border">
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b bg-muted/50">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Utilisateur</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Plan</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Statut</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Fin de période</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="h-24 text-center text-muted-foreground">
                                            Aucun utilisateur trouvé.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9">
                                                        <AvatarImage src={user.avatarUrl || ""} alt={user.displayName || ""} />
                                                        <AvatarFallback>{user.displayName?.substring(0, 2).toUpperCase() || "U"}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{user.displayName || "Sans nom"}</span>
                                                        <span className="text-xs text-muted-foreground">{user.email || "Pas d'email"}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <span className="font-medium capitalize">
                                                    {user.subscriptionProductId?.replace("pro-", "Pro ") || "Gratuit"}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <StatusBadge status={user.subscriptionStatus} cancelAtPeriodEnd={user.cancelAtPeriodEnd} />
                                            </td>
                                            <td className="p-4 align-middle text-muted-foreground">
                                                {user.currentPeriodEnd
                                                    ? new Date(user.currentPeriodEnd).toLocaleDateString()
                                                    : "-"}
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Ouvrir menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.id)}>
                                                            Copier ID
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.authUserId)}>
                                                            Copier Email/AuthID
                                                        </DropdownMenuItem>
                                                        {user.email && (
                                                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.email!)}>
                                                                Copier Email
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {meta && meta.totalPages > 1 && (
                        <div className="flex items-center justify-end space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(meta.page - 1)}
                                disabled={meta.page <= 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Précédent
                            </Button>
                            <div className="text-sm font-medium">
                                Page {meta.page} sur {meta.totalPages}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(meta.page + 1)}
                                disabled={meta.page >= meta.totalPages}
                            >
                                Suivant
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function StatusBadge({ status, cancelAtPeriodEnd }: { status: string | null, cancelAtPeriodEnd: boolean | null }) {
    if (!status || status === "none") {
        return <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">Gratuit</span>;
    }

    if (status === "active") {
        if (cancelAtPeriodEnd) {
            return <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400">Annulation programmée</span>;
        }
        return <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">Actif</span>;
    }

    return <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">{status}</span>;
}
