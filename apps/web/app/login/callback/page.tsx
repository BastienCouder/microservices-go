import { AuthCallbackClient } from "./auth-callback-client";

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
  return <AuthCallbackClient appURL={getAppURL()} webURL={getWebURL()} />;
}
