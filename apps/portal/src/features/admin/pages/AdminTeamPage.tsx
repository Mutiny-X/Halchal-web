import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, History, ListChecks, Plus, Search, Trash2, UserCheck, UserX } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { PortalShellSkeleton } from "@/components/ui/page-skeletons";
import { useToast } from "@/components/ui/toaster";
import { adminApi, type StaffAccessLevel, type StaffMember, type TaskStatus, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/* ── helpers ── */
function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  todo: "bg-surface-variant text-muted",
  in_progress: "bg-warning/15 text-warning",
  done: "bg-emerald-500/15 text-emerald-400",
};

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function unguessablePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ── Create Team Member Modal ── */
function CreateMemberModal({ onClose }: { onClose: () => void }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    // The member chooses their own password from the link in their welcome
    // email; this random one only satisfies the API and is never shown.
    mutationFn: () =>
      adminApi.createTeamMember(getToken()!, { name: name.trim(), email: email.trim(), password: unguessablePassword() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-team-members"] });
      toast("Team member added — they'll get an email to set their password", "success");
      onClose();
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Failed to create team member", "error"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-bold text-lg">Add Team Member</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-variant hover:text-foreground">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-6">
          <Field label="Full Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rahul@company.com" />
          </Field>
          <p className="text-xs text-muted">
            They'll get an email with a link to choose their own password (valid for 3 days). If it expires, they can use
            "Forgot password?" on the sign-in page.
          </p>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button
              className="flex-1"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !name.trim() || !email.trim()}
            >
              {mutation.isPending ? "Saving…" : "Save Team Member"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Assign Brand Modal ── */
function AssignBrandModal({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: brands = [] } = useQuery({
    queryKey: ["admin-brands"],
    queryFn: () => adminApi.brands(getToken()!),
    enabled: Boolean(getToken()),
  });

  const assignments = new Map(member.assignedBrands.map((b) => [b.id, b.accessLevel]));

  const assign = useMutation({
    mutationFn: ({ brandId, accessLevel }: { brandId: string; accessLevel: StaffAccessLevel }) =>
      adminApi.assignBrand(getToken()!, member.id, brandId, accessLevel),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-team-members"] }),
    onError: () => toast("Failed to assign brand", "error"),
  });

  const remove = useMutation({
    mutationFn: (brandId: string) => adminApi.removeBrand(getToken()!, member.id, brandId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-team-members"] }),
    onError: () => toast("Failed to remove brand", "error"),
  });

  const isPending = assign.isPending || remove.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-bold text-lg">Assign Brands</h2>
            <p className="text-xs text-muted mt-0.5">{member.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-variant hover:text-foreground">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
          {brands.length === 0 && (
            <p className="px-6 py-8 text-center text-sm text-muted">No brands yet.</p>
          )}
          {brands.map((brand) => {
            const accessLevel = assignments.get(brand.id);
            const isAssigned = Boolean(accessLevel);
            return (
              <div key={brand.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                  {brand.logoUrl
                    ? <img src={brand.logoUrl} className="h-9 w-9 rounded-full object-cover" alt="" />
                    : initials(brand.companyName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{brand.companyName}</p>
                  <p className="truncate text-xs text-muted">{brand.email ?? ""}</p>
                </div>

                {isAssigned ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <select
                      value={accessLevel}
                      disabled={isPending}
                      onChange={(e) => assign.mutate({ brandId: brand.id, accessLevel: e.target.value as StaffAccessLevel })}
                      className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-foreground"
                    >
                      <option value="full">Full access</option>
                      <option value="view_only">View only</option>
                    </select>
                    <button
                      disabled={isPending}
                      onClick={() => remove.mutate(brand.id)}
                      className="rounded-full bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/15 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={isPending}
                    onClick={() => assign.mutate({ brandId: brand.id, accessLevel: "full" })}
                    className="shrink-0 rounded-full bg-surface-variant px-3 py-1.5 text-xs font-semibold text-muted hover:bg-primary/15 hover:text-primary disabled:opacity-50"
                  >
                    Assign
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border px-5 py-3">
          <Button variant="outline" className="w-full" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

/* ── Staff Activity Modal ── */
function StaffActivityModal({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const { getToken } = useAuth();
  const { data: entries = [], isPending } = useQuery({
    queryKey: ["staff-activity", member.id],
    queryFn: () => adminApi.getStaffActivity(getToken()!, member.id),
    enabled: Boolean(getToken()),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-bold text-lg">Activity</h2>
            <p className="text-xs text-muted mt-0.5">{member.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-variant hover:text-foreground">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-4">
          {isPending ? (
            <div className="h-48 animate-pulse rounded-xl bg-surface-variant/50" />
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {entries.map((e) => (
                <div key={e.id} className="rounded-xl border border-border px-4 py-3">
                  <p className="text-sm font-medium">{e.label}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {e.brandName ? `${e.brandName} · ` : ""}{formatDate(e.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Tasks Modal ── */
function TasksModal({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [brandProfileId, setBrandProfileId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const { data: tasks = [], isPending } = useQuery({
    queryKey: ["admin-tasks", member.id],
    queryFn: () => adminApi.listTasks(getToken()!, { staffId: member.id }),
    enabled: Boolean(getToken()),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createTask(getToken()!, {
        title: title.trim(),
        assignedToUserId: member.id,
        brandProfileId: brandProfileId || undefined,
        dueDate: dueDate || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-tasks", member.id] });
      setTitle("");
      setDueDate("");
      setBrandProfileId("");
      toast("Task assigned");
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Failed to create task", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => adminApi.deleteTask(getToken()!, taskId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-tasks", member.id] }),
    onError: () => toast("Failed to delete task", "error"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-bold text-lg">Tasks</h2>
            <p className="text-xs text-muted mt-0.5">{member.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-variant hover:text-foreground">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 border-b border-border p-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
          <div className="flex gap-2">
            {member.assignedBrands.length > 0 && (
              <select
                value={brandProfileId}
                onChange={(e) => setBrandProfileId(e.target.value)}
                className="h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-foreground"
              >
                <option value="">No brand</option>
                {member.assignedBrands.map((b) => (
                  <option key={b.id} value={b.id}>{b.companyName}</option>
                ))}
              </select>
            )}
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="flex-1" />
          </div>
          <Button
            className="w-full"
            disabled={!title.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Assigning…" : "Assign Task"}
          </Button>
        </div>

        <div className="max-h-72 overflow-y-auto p-4">
          {isPending ? (
            <div className="h-32 animate-pulse rounded-xl bg-surface-variant/50" />
          ) : tasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No tasks assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {t.brand ? `${t.brand.companyName} · ` : ""}
                      {t.dueDate ? `Due ${formatDate(t.dueDate)}` : "No due date"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TASK_STATUS_STYLE[t.status]}`}>
                    {TASK_STATUS_LABEL[t.status]}
                  </span>
                  <button
                    onClick={() => deleteMutation.mutate(t.id)}
                    disabled={deleteMutation.isPending}
                    className="shrink-0 rounded-lg p-1 text-muted hover:bg-surface-variant hover:text-red-400"
                    aria-label="Delete task"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Delete Member Dialog ── */
function DeleteMemberDialog({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState("");

  const deleteMutation = useMutation({
    mutationFn: () => adminApi.deleteTeamMember(getToken()!, member.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-team-members"] });
      toast("Team member permanently deleted", "success");
      onClose();
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Failed to delete member", "error"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-red-500/30 bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-bold text-lg text-red-400">Delete Team Member</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-variant hover:text-foreground">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
            This will <strong>permanently delete</strong> <span className="font-semibold">{member.name}</span> and all their data. This cannot be undone.
          </div>

          <Field label='Type "delete" to confirm' required>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="delete"
              autoComplete="off"
            />
          </Field>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              disabled={typed !== "delete" || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete Permanently"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Member Row ── */
function MemberRow({ member }: { member: StaffMember }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAssign, setShowAssign] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const deactivateMutation = useMutation({
    mutationFn: () => adminApi.deactivateStaff(getToken()!, member.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-team-members"] });
      setConfirmDeactivate(false);
      toast("Team member deactivated");
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Failed to deactivate", "error"),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => adminApi.reactivateStaff(getToken()!, member.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-team-members"] });
      toast("Team member reactivated — re-assign their brands");
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Failed to reactivate", "error"),
  });

  return (
    <>
      {showAssign && <AssignBrandModal member={member} onClose={() => setShowAssign(false)} />}
      {showActivity && <StaffActivityModal member={member} onClose={() => setShowActivity(false)} />}
      {showTasks && <TasksModal member={member} onClose={() => setShowTasks(false)} />}
      {showDelete && <DeleteMemberDialog member={member} onClose={() => setShowDelete(false)} />}
      <ConfirmDialog
        open={confirmDeactivate}
        title="Deactivate this team member?"
        description={`${member.name} will no longer be able to log in, and all their brand assignments will be cleared immediately. This can be undone later.`}
        confirmLabel="Deactivate"
        variant="destructive"
        loading={deactivateMutation.isPending}
        onCancel={() => setConfirmDeactivate(false)}
        onConfirm={() => deactivateMutation.mutate()}
      />

      <tr className={`border-b border-border/60 bg-surface last:border-0 ${!member.isActive ? "opacity-60" : ""}`}>
        <td className="px-5 py-3">
          <div className="flex min-w-[180px] items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-black text-primary">
              {initials(member.name || member.email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
              <p className="truncate text-xs text-muted">{member.email}</p>
            </div>
          </div>
        </td>
        <td className="px-5 py-3">
          {member.assignedBrands.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {member.assignedBrands.map((b) => (
                <span key={b.id} className="flex items-center gap-1 rounded-full bg-surface-variant px-2 py-0.5 text-xs font-medium text-foreground">
                  {b.companyName}
                  {b.accessLevel === "view_only" && <span className="text-[9px] text-muted">(view)</span>}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted/60 italic">No brands assigned</span>
          )}
        </td>
        <td className="px-5 py-3">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${member.isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/20 text-muted"}`}>
            {member.isActive ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="px-5 py-3">
          <div className="flex flex-wrap justify-end gap-1.5">
            <button
              onClick={() => setShowAssign(true)}
              disabled={!member.isActive}
              title="Assign this member to a brand"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-variant hover:text-foreground disabled:opacity-40"
            >
              <Building2 className="h-3.5 w-3.5" />
              Assign Brand
            </button>
            <button
              onClick={() => setShowTasks(true)}
              title="View and assign tasks"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-variant hover:text-foreground"
            >
              <ListChecks className="h-3.5 w-3.5" />
              Assign Task
            </button>
            <button
              onClick={() => setShowActivity(true)}
              title="View activity log"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-variant hover:text-foreground"
            >
              <History className="h-3.5 w-3.5" />
              Activity
            </button>
            {member.isActive ? (
              <button
                onClick={() => setConfirmDeactivate(true)}
                title="Deactivate this member"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-destructive/10 hover:text-destructive"
              >
                <UserX className="h-3.5 w-3.5" />
                Deactivate
              </button>
            ) : (
              <>
                <button
                  onClick={() => reactivateMutation.mutate()}
                  disabled={reactivateMutation.isPending}
                  title="Reactivate this member"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-variant hover:text-foreground disabled:opacity-40"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Reactivate
                </button>
                <button
                  onClick={() => setShowDelete(true)}
                  title="Permanently delete this member"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Member
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}

/* ── Admin Team Page ── */
export function AdminTeamPage() {
  const { getToken } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");

  const { data: members = [], isPending } = useQuery({
    queryKey: ["admin-team-members"],
    queryFn: () => adminApi.listTeamMembers(getToken()!),
    enabled: Boolean(getToken()),
  });

  const activeCount = members.filter((m) => m.isActive).length;
  const q = query.trim().toLowerCase();
  const filteredMembers = q
    ? members.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
    : members;

  return (
    <>
      {showCreate && <CreateMemberModal onClose={() => setShowCreate(false)} />}

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Team Members</h1>
            <p className="mt-1 text-sm text-muted">
              {members.length} member{members.length !== 1 ? "s" : ""} · {activeCount} active
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add Member
          </Button>
        </div>

        {members.length > 0 && (
          <label className="relative flex h-10 max-w-sm items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members…"
              className="h-full w-full rounded-xl border border-border bg-surface py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-muted focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </label>
        )}

        {isPending ? (
          <PortalShellSkeleton />
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-16 text-center">
            <svg className="h-10 w-10 text-muted/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <p className="font-medium">No team members yet</p>
            <p className="mt-1 text-sm text-muted">Add members and assign them to brands.</p>
            <Button className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" strokeWidth={2} />
              Add First Member
            </Button>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-16 text-center">
            <p className="font-medium">No members match "{query}"</p>
            <Button variant="outline" className="mt-4" onClick={() => setQuery("")}>Clear search</Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-variant/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <th className="px-5 py-3">Member</th>
                    <th className="px-5 py-3">Assigned Brands</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((m) => <MemberRow key={m.id} member={m} />)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
