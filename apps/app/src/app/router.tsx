import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import type { AppRouterProps } from "./App";
import { PageTemplateLoading } from "./template";

const ProfilePage = lazy(() =>
  import("@/features/profile/views/profile-page").then((module) => ({
    default: module.ProfilePage,
  })),
);
const OrganizationsPage = lazy(() =>
  import("@/features/organizations/views/organizations-page").then((module) => ({
    default: module.OrganizationsPage,
  })),
);
const DashboardPage = lazy(() =>
  import("@/features/dashboard").then((module) => ({
    default: module.DashboardPage,
  })),
);
const PromptsPage = lazy(() =>
  import("@/features/prompts").then((module) => ({
    default: module.PromptsPage,
  })),
);
const PagesPage = lazy(() =>
  import("@/features/pages").then((module) => ({
    default: module.PagesPage,
  })),
);
const BrandsPage = lazy(() =>
  import("@/features/brands").then((module) => ({
    default: module.BrandsPage,
  })),
);
const ModelsPage = lazy(() =>
  import("@/features/models").then((module) => ({
    default: module.ModelsPage,
  })),
);
const PerceptionPage = lazy(() =>
  import("@/features/perception").then((module) => ({
    default: module.PerceptionPage,
  })),
);
const OptimizeActionsPage = lazy(() =>
  import("@/features/optimize-actions").then((module) => ({
    default: module.OptimizeActionsPage,
  })),
);
const ContentOptimizerPage = lazy(() =>
  import("@/features/content-optimizer").then((module) => ({
    default: module.ContentOptimizerPage,
  })),
);
const ImpactPage = lazy(() =>
  import("@/features/impact").then((module) => ({
    default: module.ImpactPage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/features/settings").then((module) => ({
    default: module.SettingsPage,
  })),
);

const SIDEBAR_FEATURE_ROUTES = [
  {
    path: "/prompts",
    View: PromptsPage,
  },
  {
    path: "/pages",
    View: PagesPage,
  },
  {
    path: "/brands",
    View: BrandsPage,
  },
  {
    path: "/models",
    View: ModelsPage,
  },
  {
    path: "/perception",
    View: PerceptionPage,
  },
  {
    path: "/optimize/actions",
    View: OptimizeActionsPage,
  },
  {
    path: "/optimize/content-optimizer",
    View: ContentOptimizerPage,
  },
  {
    path: "/impact",
    View: ImpactPage,
  },
  {
    path: "/settings",
    View: SettingsPage,
  },
] as const;

export function AppRouter({ apiBaseURL, busy, routeSearch, session, user, onCreateProfile }: AppRouterProps) {
  return (
    <Routes>
      <Route
        path="/dashboard"
        element={
          <Suspense fallback={<PageTemplateLoading />}>
            <DashboardPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
          </Suspense>
        }
      />
      {SIDEBAR_FEATURE_ROUTES.map((item) => (
        <Route
          key={item.path}
          path={item.path}
          element={
            <Suspense fallback={<PageTemplateLoading />}>
              <item.View />
            </Suspense>
          }
        />
      ))}
      <Route
        path="/profile"
        element={
          <Suspense fallback={<PageTemplateLoading />}>
            {session ? (
              <ProfilePage
                busy={busy}
                onCreateProfile={onCreateProfile}
                session={session}
                user={user}
              />
            ) : (
              <section className="card">
                <h2>Session absente</h2>
                <p className="muted">Connecte-toi depuis le web auth pour accéder au profil.</p>
              </section>
            )}
          </Suspense>
        }
      />
      <Route
        path="/organizations"
        element={
          <Suspense fallback={<PageTemplateLoading />}>
            <OrganizationsPage
              apiBaseURL={apiBaseURL}
              routeSearch={routeSearch}
              user={user}
            />
          </Suspense>
        }
      />
      <Route path="/" element={<Navigate replace to="/dashboard" />} />
      <Route path="*" element={<Navigate replace to="/dashboard" />} />
    </Routes>
  );
}
