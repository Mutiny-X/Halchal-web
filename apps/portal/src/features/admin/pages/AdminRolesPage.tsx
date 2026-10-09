import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";
import { adminApi, type AdminPermissionLevel, type AdminRole, type AdminSection } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

const SECTIONS: { key: AdminSection; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "brands", label: "Brands" },
  { key: "clippers", label: "Clippers" },
  { key: "campaigns", label: "Campaigns" },
  { key: "analytics", label: "Analytics" },
  { key: "tickets", label: "Tickets" },
  { key: "faqs", label: "FAQs" },
  { key: "notifications", label: "Notifications" },
  { key: "team", label: "Team" },
  { key: "payouts", label: "Payouts" },
];

const LEVELS: { key: AdminPermissionLevel; label: string }[] = [
  { key: "hidden", label: "Hidden" },
  { key: "view", label: "View" },
  { key: "manage", label: "Manage" },
];

export function AdminRolesPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminRole | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => adminApi.roles(getToken()!),
    enabled: Boolean(getToken()),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-roles"] });

  const setLevel = useMutation({
    mutationFn: ({ roleId, section, level }: { roleId: string; section: AdminSection; level: AdminPermissionLevel }) =>
      adminApi.setRolePermissions(getToken()!, roleId, [{ section, level }]),
    onSuccess: invalidate,
    onError: () => toast("Failed to update permission", "error"),
  });

  const toggleMoney = useMutation({
    mutationFn: (role: AdminRole) => adminApi.updateRole(getToken()!, role.id, { canSeeMoney: !role.canSeeMoney }),
    onSuccess: invalidate,
    onError: () => toast("Failed to update role", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteRole(getToken()!, id),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast("Role deleted");
    },
    onError: () => toast("Failed to delete role", "error"),
  });

  const reset = useMutation({
    mutationFn: () => adminApi.resetRoles(getToken()!),
    onSuccess: () => {
      invalidate();
      setResetConfirmOpen(false);
      toast("Roles reset — everything hidden, review before use");
    },
    onError: () => toast("Failed to reset roles", "error"),
  });

  const roles = data?.roles ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Roles &amp; Access</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Choose which sections each admin role can reach, and whether they see money. Changes apply on the
            affected admin's next request — they do not need to log out.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setResetConfirmOpen(true)}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset to defaults
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-variant">
          <Lock className="h-4 w-4 text-muted" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">Super Admin</p>
            <span className="rounded-full bg-surface-variant px-2 py-0.5 text-[10px] font-bold text-muted">
              {data?.superAdmin.userCount ?? 0} account{data?.superAdmin.userCount === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-xs text-muted">
            Full access to every section, including money figures. Not configurable.
          </p>
        </div>
      </div>

      {isPending ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-40 px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted">
                    Section
                  </th>
                  {roles.map((role) => (
                    <th key={role.id} className="min-w-[220px] px-5 py-3.5 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{role.name}</span>
                        <span className="rounded-full bg-surface-variant px-2 py-0.5 text-[10px] font-bold text-muted">
                          {role.userCount}
                        </span>
                        <button
                          onClick={() => setDeleteTarget(role)}
                          className="ml-auto text-muted hover:text-destructive"
                          aria-label={`Delete ${role.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="px-5 py-3.5">
                    <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add Role
                    </Button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {SECTIONS.map((section) => (
                  <tr key={section.key}>
                    <td className="px-5 py-3 font-medium text-foreground">{section.label}</td>
                    {roles.map((role) => {
                      const current =
                        role.permissions.find((p) => p.section === section.key)?.level ?? "hidden";
                      return (
                        <td key={role.id} className="px-5 py-3">
                          <div className="inline-flex overflow-hidden rounded-lg border border-border">
                            {LEVELS.map((lvl) => (
                              <button
                                key={lvl.key}
                                disabled={setLevel.isPending}
                                onClick={() =>
                                  setLevel.mutate({ roleId: role.id, section: section.key, level: lvl.key })
                                }
                                className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                                  current === lvl.key
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-transparent text-muted hover:bg-surface-variant/60"
                                }`}
                              >
                                {lvl.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                    <td />
                  </tr>
                ))}
                <tr>
                  <td className="px-5 py-3.5 font-medium text-foreground">
                    Can see money
                    <p className="text-xs font-normal text-muted">
                      Budgets, creator rates, payouts, platform fees and revenue counters
                    </p>
                  </td>
                  {roles.map((role) => (
                    <td key={role.id} className="px-5 py-3.5">
                      <input
                        type="checkbox"
                        checked={role.canSeeMoney}
                        disabled={toggleMoney.isPending}
                        onChange={() => toggleMoney.mutate(role)}
                        className="h-5 w-9"
                      />
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {roles.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted">
              No custom roles yet — every admin is a Super Admin until you add one.
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5 rounded-2xl border border-border bg-surface-variant/30 p-4 text-xs text-muted">
        <p className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" />
          Roles &amp; Access is super-admin-only and cannot be reassigned. Granting this page to another role would
          let that role grant itself everything else, so it is excluded from the grid by design.
        </p>
      </div>

      {addOpen && (
        <AddRoleModal
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            invalidate();
          }}
        />
      )}

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset all roles to defaults?"
        description="Every role's permissions go back to Hidden on every section, and Can see money turns off. Super Admins are unaffected."
        confirmLabel="Reset"
        variant="destructive"
        loading={reset.isPending}
        onConfirm={() => reset.mutate()}
        onCancel={() => setResetConfirmOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this role?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be deleted. Any admin assigned to it becomes a Super Admin.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function AddRoleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => adminApi.createRole(getToken()!, { name: name.trim() }),
    onSuccess: onCreated,
    onError: () => toast("Failed to create role — name may already be in use", "error"),
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-bold text-foreground">Add Role</h2>
        <p className="mt-1 text-sm text-muted">
          New roles start with everything Hidden — set permissions from the grid after creating it.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 60))}
          placeholder="e.g. Campaign Handling"
          autoFocus
          className="mt-4 w-full rounded-xl border border-border bg-surface-variant/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={() => create.mutate()} disabled={name.trim().length < 2 || create.isPending}>
            {create.isPending ? "Creating…" : "Create Role"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
