"use client";

import { createAuthClient } from "better-auth/client";
import {
  adminClient,
  jwtClient,
  magicLinkClient,
} from "better-auth/client/plugins";

const baseURL = process.env.NEXT_PUBLIC_AUTH_URL!; // http://localhost:3000
const basePath = process.env.NEXT_PUBLIC_AUTH_BASE_PATH || "/auth";

export const auth = createAuthClient({
  baseURL,
  basePath,
  fetch: { credentials: "include" },
  plugins: [
    magicLinkClient(),
    adminClient(),
    jwtClient(),
  ],
});

// util simple pour extraire role(s)
export function rolesFrom(user: any): string[] {
  if (!user) return [];
  if (Array.isArray(user.roles)) return user.roles;
  if (typeof user.role === "string") {
    return user.role
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
  }
  return [];
}