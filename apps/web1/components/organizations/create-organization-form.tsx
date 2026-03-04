"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_CONFIG, apiRoutes } from "@/lib/api-config";
import { Loader2 } from "lucide-react";

interface CreateOrganizationFormProps {
    redirectOnSuccess?: boolean;
    successRedirectPath?: string;
    onCreated?: (organization: { id: string; name: string }) => void;
}

export function CreateOrganizationForm({
    redirectOnSuccess = true,
    successRedirectPath = "/organizations?tab=team",
    onCreated,
}: CreateOrganizationFormProps) {
    const router = useRouter();
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const SELECTED_ORG_KEY = "selected-organization-id";

    const generateSlug = (value: string) => {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name) {
            setError("Organization name is required");
            return;
        }

        const slug = generateSlug(name);
        if (!slug) {
            setError("Please provide a valid organization name");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(buildApiUrl(apiRoutes.organizations.create()), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name, slug }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || "Failed to create organization");
            }

            const responseData = await response.json();
            const organization = extractOrganizationData(responseData);
            const orgId = organization?.id || null;
            if (orgId && typeof window !== "undefined") {
                window.localStorage.setItem(SELECTED_ORG_KEY, orgId);
            }
            if (organization) {
                onCreated?.(organization);
            }

            if (redirectOnSuccess) {
                router.push(successRedirectPath);
                router.refresh();
            }
        } catch (err: any) {
            setError(err.message || "Failed to create organization");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name" className="text-base">
                    Organization Name
                </Label>
                <Input
                    id="name"
                    placeholder="My Company"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-12 text-base"
                    autoFocus
                />
                <p className="text-xs text-gray-500">
                    Choose a name for your organization
                </p>
            </div>

            {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            <Button
                type="submit"
                disabled={isLoading || !name}
                className="w-full h-12 text-base"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                    </>
                ) : (
                    "Create Organization"
                )}
            </Button>
        </form>
    );
}

function buildApiUrl(path: string): string {
    const base = API_CONFIG.BASE_URL?.trim();
    if (!base) return path;
    if (/^https?:\/\//.test(path)) return path;
    return `${base}${path}`;
}

function extractOrganizationData(value: unknown): { id: string; name: string } | null {
    if (!isRecord(value)) return null;
    const payload = isRecord(value.data) ? value.data : value;
    const organization = isRecord(payload.organization) ? payload.organization : payload;
    const organizationProps = isRecord(organization.props) ? organization.props : organization;
    const id = organizationProps.id;
    const name = organizationProps.name;

    if (typeof id === "string" && id && typeof name === "string" && name) {
        return { id, name };
    }

    if (typeof id === "string" && id) {
        return { id, name: "Organization" };
    }

    return null;
}

function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === "object" && value !== null;
}
