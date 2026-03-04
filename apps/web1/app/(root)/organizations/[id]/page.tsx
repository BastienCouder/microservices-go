import { apiFetch } from "@/lib/server-api";
import { apiRoutes } from "@/lib/api-config";
import { OrganizationSettings } from "@/components/organizations/organization-settings";

interface PageProps {
    params: {
        id: string;
    };
}

interface Organization {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    createdAt: string;
    members: Array<{
        userId: string;
        organizationId: string;
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

export default async function OrganizationPage({ params }: PageProps) {
    const { id } = params;
    const organization = await apiFetch<Organization>(apiRoutes.organizations.get(id));

    if (!organization) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-bold">Organization not found</h1>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-8">
            <OrganizationSettings organization={organization} />
        </div>
    );
}
