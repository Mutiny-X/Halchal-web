export type Portal = "brand" | "admin" | "staff";

export function parsePortal(value: string | null | undefined): Portal {
  if (value === "admin") return "admin";
  if (value === "staff") return "staff";
  return "brand";
}

export function portalFromRole(role: string | undefined | null): Portal {
  if (role === "admin") return "admin";
  if (role === "staff") return "staff";
  return "brand";
}

export function dashboardPathForRole(role: string | undefined | null): string {
  if (role === "admin") return "/admin/dashboard";
  if (role === "staff") return "/staff/brands";
  // Brands have no pages of their own any more.
  return "/login";
}
