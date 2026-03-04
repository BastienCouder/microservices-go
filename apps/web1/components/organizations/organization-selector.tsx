"use client";

import { useState } from "react";
import { useOrganization } from "@/hooks/use-organization";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateOrganizationDialog } from "./create-organization-dialog";

export function OrganizationSelector() {
    const { organizations, selectedOrganization, selectOrganization, isLoading } = useOrganization();
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    if (isLoading) {
        return (
            <Button variant="outline" disabled className="w-[200px]">
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                Loading...
            </Button>
        );
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-between">
                        {selectedOrganization?.name || "Select organization"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[200px]">
                    <DropdownMenuLabel>My Organizations</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {organizations.map((org) => (
                        <DropdownMenuItem
                            key={org.id}
                            onClick={() => selectOrganization(org.id)}
                            className="cursor-pointer"
                        >
                            <Check
                                className={`mr-2 h-4 w-4 ${selectedOrganization?.id === org.id ? "opacity-100" : "opacity-0"
                                    }`}
                            />
                            {org.name}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => setShowCreateDialog(true)}
                        className="cursor-pointer"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Organization
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <CreateOrganizationDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
            />
        </>
    );
}
