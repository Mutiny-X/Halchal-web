import { Navigate, Outlet } from "react-router-dom";

import { dashboardPathForRole } from "@/lib/portal";
import { useAuth } from "@/providers/auth-provider";

export function StaffRoute() {
  const { auth } = useAuth();

  if (!auth || auth.user.role !== "staff") {
    return <Navigate to={dashboardPathForRole(auth?.user.role)} replace />;
  }

  return <Outlet />;
}
