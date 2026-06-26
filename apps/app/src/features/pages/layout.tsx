import { memo } from "react";
import { Navigate } from "react-router-dom";

type PagesLayoutProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export const PagesLayout = memo(function PagesLayout(props: PagesLayoutProps) {
  void props;
  return <Navigate to="/" replace />;
});
    // <div className="flex h-auto min-h-full flex-col gap-4 px-3 p-2 md:p-4">
    //   <PagesPanel apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
    // </div>
