import { AuthCallbackClient } from "@/app/login/callback/auth-callback-client";
import { Navigation } from "@/app/[locale]/_components/navigation";

export const dynamic = "force-dynamic";

function getAppURL(): string {
  const appURL = process.env.NEXT_PUBLIC_APP_URL;
  if (typeof appURL === "string" && appURL.trim() !== "") {
    return appURL.trim();
  }

  return "http://localhost:30004";
}

function getWebURL(): string {
  const webURL = process.env.NEXT_PUBLIC_WEB_URL;
  if (typeof webURL === "string" && webURL.trim() !== "") {
    return webURL.trim();
  }

  return "http://localhost:30000";
}

export default function AuthCallbackPage() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <header className="h-20 w-full shrink-0">
        <Navigation />
      </header>

      <section className="h-[calc(100vh-5rem)] w-full overflow-hidden">
        <AuthCallbackClient appURL={getAppURL()} webURL={getWebURL()} />
      </section>
    </main>
  );
}
