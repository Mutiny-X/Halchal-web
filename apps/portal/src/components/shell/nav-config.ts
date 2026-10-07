import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Building2,
  CheckSquare,
  CircleHelp,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Settings,
  Shield,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";

import type { AdminSection } from "@/lib/api";
import type { Portal } from "@/lib/portal";

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  matchNested?: boolean;
  /** Gates visibility for restricted admin roles. Omit for items every
   * admin can always see (or that have their own access rule, like
   * Roles & Access, which is handled separately as super-admin-only). */
  section?: AdminSection;
  /** Only rendered for Super Admins, regardless of the section matrix. */
  superAdminOnly?: boolean;
};

const adminNavItems: PortalNavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "dashboard" },
  { href: "/admin/brands", label: "Brands", icon: Building2, matchNested: true, section: "brands" },
  { href: "/admin/clippers", label: "Clippers", icon: Users, matchNested: true, section: "clippers" },
  { href: "/admin/verifications", label: "Verification", icon: ShieldCheck, section: "clippers" },
  {
    href: "/admin/campaigns",
    label: "Campaigns",
    icon: Megaphone,
    matchNested: true,
    section: "campaigns",
  },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, section: "analytics" },
  {
    href: "/admin/support-tickets",
    label: "Support",
    icon: LifeBuoy,
    matchNested: true,
    section: "tickets",
  },
  { href: "/admin/notifications", label: "Notifications", icon: Bell, section: "notifications" },
  { href: "/admin/faqs", label: "FAQs", icon: CircleHelp, section: "faqs" },
  { href: "/admin/team", label: "Team", icon: UserCog, section: "team" },
  { href: "/admin/roles", label: "Roles & Access", icon: Shield, superAdminOnly: true },
];

const staffNavItems: PortalNavItem[] = [
  { href: "/staff/brands", label: "My Brands", icon: Building2, matchNested: true },
  { href: "/staff/tasks", label: "My Tasks", icon: CheckSquare },
  { href: "/staff/profile", label: "Profile", icon: Settings },
];

export function getNavForRole(role: Portal): PortalNavItem[] {
  if (role === "admin") return adminNavItems;
  if (role === "staff") return staffNavItems;
  // Brands don't sign in to the website.
  return [];
}

/** Applies a restricted admin's effective permissions to the nav list.
 * Pass `null` permissions (still loading, or role isn't admin) to show
 * everything unfiltered — avoids a flash of an empty sidebar on load. */
export function filterAdminNav(
  items: PortalNavItem[],
  permissions: { isSuperAdmin: boolean; sections: Record<AdminSection, string> } | null,
): PortalNavItem[] {
  if (!permissions) return items;
  return items.filter((item) => {
    if (item.superAdminOnly) return permissions.isSuperAdmin;
    if (!item.section) return true;
    if (permissions.isSuperAdmin) return true;
    return permissions.sections[item.section] !== "hidden";
  });
}

export function resolvePortalTitle(pathname: string, role: Portal): string {
  if (pathname === "/dashboard" || pathname === "/admin/dashboard") {
    return "Dashboard";
  }
  if (pathname === "/admin/brands") return "Brands";
  if (pathname === "/admin/clippers") return "Clippers";
  if (pathname === "/admin/verifications") return "Verification";
  if (pathname === "/admin/support-tickets") return "Support Tickets";
  if (pathname === "/admin/notifications") return "Notifications";
  if (pathname === "/admin/faqs") return "FAQ Management";
  if (pathname === "/admin/roles") return "Roles & Access";
  if (pathname === "/admin/campaigns") return "Campaigns";
  if (pathname === "/campaigns") return "Campaigns";
  if (pathname.startsWith("/campaigns/new") || pathname.startsWith("/admin/campaigns/new")) {
    return "Create campaign";
  }
  if (/^\/campaigns\/[^/]+$/.test(pathname) || /^\/admin\/campaigns\/[^/]+$/.test(pathname)) {
    return "Campaign";
  }
  if (pathname === "/analytics" || pathname === "/admin/analytics") return "Analytics";
  if (pathname === "/billing") return "Billing";
  if (pathname === "/settings/brand") return "Settings";
  if (pathname === "/admin/profile" || pathname === "/staff/profile") return "My Profile";
  if (pathname === "/admin/team") return "Team";
  if (pathname === "/staff/tasks") return "My Tasks";
  return role === "admin" ? "Admin Portal" : "Brand Portal";
}

export function portalSidebarLabel(role: Portal): string {
  if (role === "admin") return "Admin Portal";
  if (role === "staff") return "Staff Portal";
  return "Brand Portal";
}

export function isNavItemActive(
  pathname: string,
  item: PortalNavItem,
): boolean {
  if (pathname === item.href) return true;
  if (!item.matchNested) return false;
  return pathname.startsWith(`${item.href}/`);
}
