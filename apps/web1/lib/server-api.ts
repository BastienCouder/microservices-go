"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
type ApiResponse<T> = {
  message: string;
  status: number;
  data: T | null;
};

export interface ApiFetchOptions extends RequestInit {
  /** Skip authentication check - for public endpoints */
  skipAuth?: boolean;
}

/**
 * Server-side API fetch with automatic cookie forwarding.
 * 
 * Performance optimizations:
 * - Cookies forwarded for authentication
 * - No-store cache for fresh data
 * - Automatic redirect on 401/403
 * 
 * For even better SSR performance, use getServerSession() from auth-server.ts
 * to validate sessions without HTTP roundtrip.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const headers = new Headers(options.headers || {});
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    cache: options.cache ?? "no-store",
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      redirect("/");
    }

    const text = await res.text();
    console.error(`[ServerApi] Error ${res.status} on ${path}: ${text}`);

    // Try to parse JSON error message if possible
    try {
      const jsonErr = JSON.parse(text);
      if (jsonErr.message) {
        throw new Error(jsonErr.message);
      }
    } catch (e) {
      // ignore JSON parse error
    }

    throw new Error(`API Error ${res.status}: ${text}`);
  }

  if (res.status === 204) return undefined as T;

  const json = await res.json() as ApiResponse<T>;

  if (json && typeof json === 'object' && 'data' in json && 'status' in json && 'message' in json) {
    return json.data as T;
  }

  return json as T;
}

/**
 * Prefetch data for SSR with session validation.
 * Validates session first using getServerSession() to avoid unnecessary API calls
 * if user is not authenticated.
 */
export async function apiFetchWithAuth<T>(path: string, options: ApiFetchOptions = {}): Promise<T | null> {
  const { getServerSession } = await import("./auth-server");
  const { user } = await getServerSession();

  if (!user) {
    redirect("/auth");
  }

  return apiFetch<T>(path, options);
}
