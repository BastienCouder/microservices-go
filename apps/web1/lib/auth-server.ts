"use server";

import { cookies } from "next/headers";
import { jwtVerify, createRemoteJWKSet } from "jose";

// Configuration
const ISSUER = process.env.ISSUER || "auth-service";
const AUDIENCE = process.env.AUDIENCE || "web";
const JWKS_URL = process.env.AUTH_JWKS_URL;

// Create JWKS once at module level
const JWKS = JWKS_URL ? createRemoteJWKSet(new URL(JWKS_URL)) : null;

export interface ServerSession {
    user: {
        id: string;
        email?: string;
        roles: string[];
    } | null;
}

/**
 * Server-side session validation for SSR/SSG pages.
 * 
 * Benefits:
 * - No HTTP roundtrip to auth-service
 * - Direct JWT verification via JWKS
 * - Faster page loads for authenticated content
 * - Better SEO (content rendered server-side)
 * 
 * Usage in Server Components:
 * ```tsx
 * const { user } = await getServerSession();
 * if (!user) redirect("/auth");
 * ```
 */
export async function getServerSession(): Promise<ServerSession> {
    const cookieStore = await cookies();

    // Better Auth stores JWT in this cookie after login
    const token = cookieStore.get("better-auth.session_token")?.value;

    if (!token) {
        return { user: null };
    }

    // If no JWKS configured, fall back to API call
    if (!JWKS) {
        console.warn("[auth-server] No JWKS_URL configured, falling back to API validation");
        return await validateViaApi(token);
    }

    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: ISSUER,
            audience: AUDIENCE,
        });

        return {
            user: {
                id: String(payload.sub),
                email: payload.email as string | undefined,
                roles: extractRoles(payload),
            },
        };
    } catch (error) {
        // JWT expired or invalid
        console.warn("[auth-server] JWT validation failed:", error);
        return { user: null };
    }
}

/**
 * Check if the current user has admin role
 */
export async function isAdmin(): Promise<boolean> {
    const { user } = await getServerSession();
    return user?.roles.includes("admin") ?? false;
}

/**
 * Require authentication - throws redirect if not authenticated
 */
export async function requireAuth() {
    const { user } = await getServerSession();
    if (!user) {
        const { redirect } = await import("next/navigation");
        redirect("/auth");
    }
    return user;
}

/**
 * Require admin role - throws redirect if not admin
 */
export async function requireAdmin() {
    const user = await requireAuth();
    if (!user?.roles.includes("admin")) {
        const { redirect } = await import("next/navigation");
        redirect("/");
    }
    return user;
}

// Helper to extract roles from JWT payload
function extractRoles(payload: any): string[] {
    if (Array.isArray(payload.roles)) return payload.roles;
    if (typeof payload.role === "string") {
        return payload.role.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    return [];
}

// Fallback API validation when JWKS not available
async function validateViaApi(token: string): Promise<ServerSession> {
    try {
        const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        const res = await fetch(`${BASE_URL}/auth/session`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
        });

        if (!res.ok) {
            return { user: null };
        }

        const data = await res.json();
        if (data?.user) {
            return {
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    roles: extractRoles(data.user),
                },
            };
        }

        return { user: null };
    } catch {
        return { user: null };
    }
}
