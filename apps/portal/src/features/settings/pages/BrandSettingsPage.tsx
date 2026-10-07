import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { ProfileSection } from "@/features/settings/components/ProfileSection";
import { portalApi, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

function Initials({ name }: { name: string }) {
  const letters = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary">
      {letters}
    </div>
  );
}

export function BrandSettingsPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = getToken()!;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: me, isPending } = useQuery({
    queryKey: ["me", "brand"],
    queryFn: () => portalApi.me(token),
    enabled: Boolean(token),
  });

  const [companyName, setCompanyName] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);

  // Populate fields once loaded
  const populated = useRef(false);
  if (me && !populated.current) {
    setCompanyName(me.brandProfile?.companyName ?? me.companyName ?? "");
    populated.current = true;
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => portalApi.uploadBrandLogo(token, file),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      let logoUrl: string | undefined;
      if (pendingLogoFile) {
        const res = await portalApi.uploadBrandLogo(token, pendingLogoFile);
        logoUrl = res.url;
      }
      return portalApi.updateBrandProfile(token, {
        companyName: companyName.trim() || undefined,
        logoUrl,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      setPendingLogoFile(null);
      toast("Profile updated");
    },
    onError: (err) => {
      toast(err instanceof ApiError ? err.message : "Update failed", "error");
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  const currentLogo = logoPreview ?? me?.brandProfile?.logoUrl ?? null;
  const currentName = me?.brandProfile?.companyName ?? me?.companyName ?? "";

  if (isPending) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="font-display text-2xl font-bold">Settings</h1>
        </header>
        <div className="h-64 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your brand profile.</p>
      </header>

      {/* Logo */}
      <Card>
        <CardTitle>Brand Logo</CardTitle>
        <div className="mt-4 flex items-center gap-4">
          {currentLogo ? (
            <img
              src={currentLogo}
              alt="Brand logo"
              className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/30"
            />
          ) : (
            <Initials name={currentName || "B"} />
          )}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {pendingLogoFile ? "Image selected ✓" : "Upload logo"}
            </Button>
            <p className="text-xs text-muted">PNG, JPG or WebP · Max 5 MB</p>
          </div>
        </div>
      </Card>

      {/* Company details */}
      <Card>
        <CardTitle>Company details</CardTitle>
        <div className="mt-4 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Company name</label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your company name"
            />
          </div>
        </div>

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

      <ProfileSection />
    </div>
  );
}
