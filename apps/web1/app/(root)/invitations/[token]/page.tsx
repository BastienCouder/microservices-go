import { apiFetch } from "@/lib/server-api";
import { apiRoutes } from "@/lib/api-config";
import { getServerSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";

interface PageProps {
    params: Promise<{
        token: string;
    }>;
}

export default async function AcceptInvitationPage({ params }: PageProps) {
    const { token } = await params;

    if (!token) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="w-full max-w-md space-y-4 text-center">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-8">
                        <h1 className="text-2xl font-bold text-red-600 mb-2">
                            Invalid Invitation Link
                        </h1>
                        <p className="text-red-700 mb-6">
                            The invitation token is missing.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const { user } = await getServerSession();
    if (!user) {
        const redirectPath = `/invitations/${token}`;
        redirect(`/auth?redirect=${encodeURIComponent(redirectPath)}`);
    }

    try {
        await apiFetch(apiRoutes.organizations.acceptInvitation(token), {
            method: "POST",
        });

        return (
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="w-full max-w-md space-y-4 text-center">
                    <div className="rounded-lg border bg-card p-8">
                        <h1 className="text-2xl font-bold text-green-600 mb-2">
                            Invitation Accepted!
                        </h1>
                        <p className="text-muted-foreground mb-6">
                            You have successfully joined the organization.
                        </p>
                        <a
                            href="/"
                            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            Go to Dashboard
                        </a>
                    </div>
                </div>
            </div>
        );
    } catch (error: any) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="w-full max-w-md space-y-4 text-center">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-8">
                        <h1 className="text-2xl font-bold text-red-600 mb-2">
                            Invalid or Expired Invitation
                        </h1>
                        <p className="text-red-700 mb-6">
                            {error.message || "This invitation link is no longer valid."}
                        </p>
                        <a
                            href="/"
                            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            Go to Dashboard
                        </a>
                    </div>
                </div>
            </div>
        );
    }
}
