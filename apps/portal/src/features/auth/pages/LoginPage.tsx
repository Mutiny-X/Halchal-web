import { ArrowRight, Mail } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { AuthPasswordField } from "@/components/auth/auth-password-field";
import { AuthPrimaryButton } from "@/components/auth/auth-primary-button";
import { authFormClass } from "@/components/auth/auth-styles";
import { AuthTextField } from "@/components/auth/auth-text-field";
import {
  AuthMobileBrandMark,
  AuthPageHeader,
  AuthSplitLayout,
  AuthTrustBadges,
} from "@/components/layout/auth-split-layout";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { useAuth } from "@/providers/auth-provider";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  // Only an explicit ?next= overrides the user's own home page.
  const next = searchParams.get("next");
  const redirectTo = next ? safeRedirectPath(next) : undefined;
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      try {
        await login(email, password, "brand", redirectTo);
      } catch (err) {
        if (err instanceof ApiError && err.code === "WRONG_PORTAL") {
          await login(email, password, "admin", redirectTo);
        } else {
          throw err;
        }
      }
      toast("Welcome back!");
    } catch (err) {
      toast(
        err instanceof ApiError ? err.message : "Login failed",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout heroVariant="login" footer={<AuthTrustBadges />}>
      <AuthMobileBrandMark />

      <AuthPageHeader
        title="Team sign in"
        description="For the Halchal team. Admins are taken to the admin portal automatically."
      />

      <form onSubmit={onSubmit} className={authFormClass}>
        <AuthTextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <AuthPasswordField
            id="password"
            label=""
            hideLabel
            value={password}
            onChange={setPassword}
            required
          />
        </div>
        <AuthPrimaryButton
          loading={loading}
          trailingIcon={<ArrowRight className="size-4" />}
        >
          Sign in
        </AuthPrimaryButton>
      </form>
    </AuthSplitLayout>
  );
}
