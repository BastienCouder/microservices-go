import { memo } from "react";
import { Navigate } from "react-router-dom";
import { PagesPanel } from "./_components/pages-panel";

type PagesLayoutProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export const PagesLayout = memo(function PagesLayout({
  apiBaseURL,
  routeSearch,
}: PagesLayoutProps) {
  return <Navigate to="/" replace />;
});
    // <div className="flex h-auto min-h-full flex-col gap-4 px-3 p-2 md:p-4">
    //   <PagesPanel apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
    // </div>