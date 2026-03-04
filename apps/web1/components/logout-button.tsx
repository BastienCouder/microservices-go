"use client";

import { auth } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";

export function LogoutButton() {
    const router = useRouter();

    const handleLogout = async () => {
        await Promise.all([auth.signOut(), logout()]);
        router.push("/auth"); // Redirect to login page
        router.refresh(); // Clear server cache
    };

    return (
        <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
        >
            <LogOut className="w-4 h-4" />
            <span>Se déconnecter</span>
        </button>
    );
}
