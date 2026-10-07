import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { staffApi } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export function StaffBrandsPage() {
  const { getToken } = useAuth();

  const { data: brands = [], isPending } = useQuery({
    queryKey: ["staff-brands"],
    queryFn: () => staffApi.brands(getToken()!),
    enabled: Boolean(getToken()),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Brands</h1>
        <p className="mt-1 text-sm text-muted">Select a brand to manage its campaigns.</p>
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-variant" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-20 text-center">
          <svg className="h-12 w-12 text-muted/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
          <p className="text-lg font-semibold">No brands assigned</p>
          <p className="mt-1 text-sm text-muted">Ask your admin to assign brands to your account.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              to={`/staff/brands/${brand.id}`}
              className="group rounded-2xl border border-border bg-surface p-5 transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-base font-black text-primary overflow-hidden">
                  {brand.logoUrl
                    ? <img src={brand.logoUrl} alt="" className="h-full w-full object-cover" />
                    : initials(brand.companyName)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate group-hover:text-primary transition-colors">{brand.companyName}</p>
                  {brand.companyEmail && (
                    <p className="text-xs text-muted truncate">{brand.companyEmail}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted">
                  {brand.campaignCount} campaign{brand.campaignCount !== 1 ? "s" : ""}
                  {brand.accessLevel === "view_only" && (
                    <span className="rounded-full bg-surface-variant px-2 py-0.5 text-[10px] font-semibold">View only</span>
                  )}
                </span>
                <svg className="h-4 w-4 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
