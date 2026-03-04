import { Suspense } from "react";
import { AuthForm } from "./_components/auth-form";

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm isAdmin={false} modules={{ google: true, magicLink: true }} />
    </Suspense>
  );
}
