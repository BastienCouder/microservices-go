"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiFetch } from "@/lib/server-api";
import { apiRoutes } from "@/lib/api-config";

interface Organization {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    createdAt: string;
    members?: OrganizationMember[];
    currentUserRole?: "owner" | "admin" | "member";
}

interface OrganizationMember {
    userId: string;
    organizationId: string;
    role: "owner" | "admin" | "member";
    joinedAt: string;
    user?: {
        id: string;
        email: string;
        name: string | null;
    };
}

interface OrganizationContextType {
    organizations: Organization[];
    selectedOrganization: Organization | null;
    isLoading: boolean;
    selectOrganization: (orgId: string) => void;
    refreshOrganizations: () => Promise<void>;
    createOrganization: (data: { name: string; slug: string }) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const SELECTED_ORG_KEY = "selected-organization-id";

export function OrganizationProvider({ children }: { children: ReactNode }) {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load organizations on mount
    useEffect(() => {
        loadOrganizations();
    }, []);

    // Load selected organization from localStorage
    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(SELECTED_ORG_KEY);
            if (saved) {
                setSelectedOrgId(saved);
            }
        }
    }, []);

    // Auto-select first org after loading
    useEffect(() => {
        if (!isLoading && organizations.length > 0 && !selectedOrgId) {
            setSelectedOrgId(organizations[0].id);
            if (typeof window !== "undefined") {
                localStorage.setItem(SELECTED_ORG_KEY, organizations[0].id);
            }
        }
    }, [isLoading, organizations, selectedOrgId]);

    const loadOrganizations = async () => {
        try {
            setIsLoading(true);
            const data = await apiFetch<Organization[]>(apiRoutes.organizations.me());
            setOrganizations(data || []);

            // Auto-select first organization if none selected
            if (!selectedOrgId && data && data.length > 0) {
                setSelectedOrgId(data[0].id);
                if (typeof window !== "undefined") {
                    localStorage.setItem(SELECTED_ORG_KEY, data[0].id);
                }
            }
        } catch (error) {
            console.error("Failed to load organizations:", error);
            setOrganizations([]);
        } finally {
            setIsLoading(false);
        }
    };

    const selectOrganization = (orgId: string) => {
        setSelectedOrgId(orgId);
        if (typeof window !== "undefined") {
            localStorage.setItem(SELECTED_ORG_KEY, orgId);
        }
    };

    const createOrganization = async (data: { name: string; slug: string }) => {
        const response = await fetch(apiRoutes.organizations.create(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error("Failed to create organization");
        }

        await loadOrganizations();
    };

    const selectedOrganization = organizations.find((org) => org.id === selectedOrgId) || null;

    return (
        <OrganizationContext.Provider
            value={{
                organizations,
                selectedOrganization,
                isLoading,
                selectOrganization,
                refreshOrganizations: loadOrganizations,
                createOrganization,
            }}
        >
            {children}
        </OrganizationContext.Provider>
    );
}

export function useOrganization() {
    const context = useContext(OrganizationContext);
    if (!context) {
        throw new Error("useOrganization must be used within OrganizationProvider");
    }
    return context;
}
