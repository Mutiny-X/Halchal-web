import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { portalApi, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "U";
}

function AvatarUpload({ avatarUrl, name }: { avatarUrl: string | null | undefined; name: string }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = getToken()!;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => portalApi.uploadAvatar(token, file),
    onSuccess: async ({ url }) => {
      await portalApi.updateProfile(token, { avatarUrl: url });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      toast("Profile photo updated");
    },
    onError: (err) => {
      toast(err instanceof ApiError ? err.message : "Failed to update photo", "error");
    },
  });

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xl font-bold text-primary">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(name)
        )}
      </div>
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? "Uploading…" : "Change photo"}
        </Button>
        <p className="mt-1 text-xs text-muted">JPG or PNG, up to 5MB.</p>
      </div>
    </div>
  );
}

const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "twitter", label: "Twitter / X" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "youtube", label: "YouTube" },
  { key: "website", label: "Website" },
] as const;

function textareaClassName(className?: string) {
  return cn(
    "flex min-h-24 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    className,
  );
}

export function ProfileSection({ showBioAndSocials = true }: { showBioAndSocials?: boolean }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = getToken()!;

  const { data: me, isPending } = useQuery({
    queryKey: ["me"],
    queryFn: () => portalApi.me(token),
    enabled: Boolean(token),
  });

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  const populated = useRef(false);
  if (me && !populated.current) {
    setDisplayName(me.displayName ?? "");
    setPhone(me.phone ?? "");
    setBio(me.bio ?? "");
    setSocialLinks(me.socialLinks ?? {});
    populated.current = true;
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      portalApi.updateProfile(token, {
        displayName: displayName.trim() || undefined,
        phone: phone.trim() || undefined,
        ...(showBioAndSocials && { bio: bio.trim() || undefined, socialLinks }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      toast("Profile updated");
    },
    onError: (err) => {
      toast(err instanceof ApiError ? err.message : "Update failed", "error");
    },
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordMutation = useMutation({
    mutationFn: () => portalApi.changePassword(token, { currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Password changed — please sign in again on other devices");
    },
    onError: (err) => {
      toast(err instanceof ApiError ? err.message : "Failed to change password", "error");
    },
  });

  if (isPending) {
    return <div className="h-64 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Profile details</CardTitle>
        <div className="mt-4">
          <AvatarUpload avatarUrl={me?.avatarUrl} name={me?.displayName ?? me?.email ?? "User"} />
        </div>
        <div className="mt-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Display name</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Email</label>
            <Input value={me?.email ?? ""} disabled className="opacity-50" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Phone</label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
            />
          </div>
          {showBioAndSocials && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short description about you"
                className={textareaClassName()}
              />
            </div>
          )}
        </div>

        {showBioAndSocials && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {SOCIAL_PLATFORMS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-muted">{label}</label>
                <Input
                  value={socialLinks[key] ?? ""}
                  onChange={(e) =>
                    setSocialLinks((current) => ({ ...current, [key]: e.target.value }))
                  }
                  placeholder={`https://${key}.com/yourhandle`}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Button
            className="w-full"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Change password</CardTitle>
        <div className="mt-4 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Current password</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">New password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Confirm new password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6">
          <Button
            className="w-full"
            onClick={() => passwordMutation.mutate()}
            disabled={
              passwordMutation.isPending ||
              !currentPassword ||
              newPassword.length < 8 ||
              newPassword !== confirmPassword
            }
          >
            {passwordMutation.isPending ? "Updating…" : "Change password"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
