import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { ShellNavLink } from "@/components/shell/shell-nav-link";
import {
  filterAdminNav,
  getNavForRole,
  isNavItemActive,
  portalSidebarLabel,
} from "@/components/shell/nav-config";
import { adminApi } from "@/lib/api";
import { dashboardPathForRole } from "@/lib/portal";
import { cn } from "@/lib/utils";
import { useAuth, usePortalRole } from "@/providers/auth-provider";

export function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const { pathname } = useLocation();
  const role = usePortalRole();
  const { auth, getToken } = useAuth();

  const { data: permissions } = useQuery({
    queryKey: ["admin-my-permissions"],
    queryFn: () => adminApi.myPermissions(getToken()!),
    enabled: role === "admin" && Boolean(getToken()),
    staleTime: 60_000,
  });

  const navItems =
    role === "admin" ? filterAdminNav(getNavForRole("admin"), permissions ?? null) : getNavForRole(role ?? "brand");
  const label = portalSidebarLabel(role ?? "brand");

  const profileInitials = (auth?.user.displayName ?? auth?.user.email ?? "A")
    .split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  const profileHref =
    role === "admin" ? "/admin/profile" : role === "staff" ? "/staff/profile" : "/settings/brand";

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-deep/40 backdrop-blur-[2px] transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!mobileOpen}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,14rem)] flex-col border-r border-border bg-surface transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:w-56 lg:shrink-0 lg:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full lg:shadow-none",
        )}
        aria-label={`${label} navigation`}
      >
        <div className="flex shrink-0 items-start justify-between px-4 pt-6 pb-3">
          <div>
            <Link
              to={dashboardPathForRole(role)}
              onClick={onClose}
              className="font-display text-xl font-extrabold tracking-tight text-primary"
            >
              Halchal
            </Link>
            <p className="mt-0.5 text-xs font-medium text-muted">{label}</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-muted hover:bg-surface-variant hover:text-foreground lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Main">
          <div className="flex flex-col gap-0.5">
            {navItems.map((item) => (
              <ShellNavLink
                key={item.href}
                to={item.href}
                label={item.label}
                icon={item.icon}
                active={isNavItemActive(pathname, item)}
                onNavigate={onClose}
              />
            ))}
          </div>
        </nav>

        {/* Profile block at bottom */}
        <div className="shrink-0 border-t border-border p-3">
          <Link
            to={profileHref}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-surface-variant",
              pathname === profileHref ? "bg-primary/10 text-primary" : "text-muted",
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-black text-primary">
              {profileInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">
                {auth?.user.displayName ?? auth?.user.email ?? "My Profile"}
              </p>
              <p className="truncate text-[10px] text-muted">{auth?.user.email ?? ""}</p>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}
