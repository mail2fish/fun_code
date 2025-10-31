import { Outlet, useLocation, useNavigate } from "react-router";
import React from "react";
import { useUserInfo } from "~/hooks/use-user";

export default function WithAuth() {
  const { userInfo, isLoading } = useUserInfo();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (!isLoading && !userInfo) {
      if (location.pathname !== "/") {
        navigate("/", { replace: true, state: { redirectTo: location.pathname + location.search } });
      }
    }
  }, [isLoading, userInfo, navigate, location.pathname, location.search]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        加载中...
      </div>
    );
  }

  if (!userInfo) {
    return null;
  }

  return <Outlet />;
}


