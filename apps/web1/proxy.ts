import { NextRequest, NextResponse } from "next/server";

const AUTH_ROUTES = ["/auth"];
const PROTECTED_ROUTES = ["/dashboard", "/projects", "/analysis", "/perception", "/account", "/settings", "/team", "/organizations", "/organization-create"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const sessionToken = request.cookies.get("better-auth.session_token")?.value;
  const isLoggedIn = !!sessionToken;
  const hasProject = request.cookies.get("has-project")?.value === "1";

  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );

  // Logged in user on /auth → redirect to dashboard
  if (isLoggedIn && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Not logged in on protected route → redirect to /auth
  if (!isLoggedIn && isProtectedRoute) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  // Root "/" → redirect based on auth state
  if (pathname === "/") {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/demo", request.url));
  }

  // Logged in + on /onboarding + already has project → skip to dashboard
  if (isLoggedIn && pathname === "/onboarding" && hasProject) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Not logged in on /onboarding → send to demo instead
  if (!isLoggedIn && pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/demo", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/auth",
    "/demo",
    "/onboarding",
    "/dashboard/:path*",
    "/prompts/:path*",
    "/projects/:path*",
    "/organizations/:path*",
    "/organization-create/:path*",
    "/analysis/:path*",
    "/perception/:path*",
    "/account/:path*",
    "/settings/:path*",
    "/team/:path*",
  ],
};
