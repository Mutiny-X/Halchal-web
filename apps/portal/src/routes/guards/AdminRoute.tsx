import { Navigate, Outlet } from "react-router-dom";

import { dashboardPathForRole } from "@/lib/portal";
import { useAuth } from "@/providers/auth-provider";

export function AdminRoute() {
  const { auth, isLoading } = useAuth();

  if (isLoading) return null;

  if (!auth) {
    return <Navigate to="/admin/login" replace />;
  }

  if (auth.user.role !== "admin") {
    return <Navigate to={dashboardPathForRole(auth.user.role)} replace />;
  }

  return <Outlet />;
}
