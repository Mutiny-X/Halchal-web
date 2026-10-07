import { Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { AuthPrimaryButton } from "@/components/auth/auth-primary-button";
import {
  authFooterLinkClass,
  authFormClass,
  authMutedFooterClass,
} from "@/components/auth/auth-styles";
import { AuthTextField } from "@/components/auth/auth-text-field";
import {
  AuthMobileBrandMark,
  AuthPageHeader,
  AuthSplitLayout,
  AuthTrustBadges,
} from "@/components/layout/auth-split-layout";
import { useToast } from "@/components/ui/toaster";
import { authApi, ApiError } from "@/lib/api";

export function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      toast("If that email exists, we sent reset instructions.");
    } catch (err) {
      toast(
        err instanceof ApiError ? err.message : "Request failed",
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
        title="Reset password"
        description="Enter your team account email and we'll send reset instructions."
      />
      <form onSubmit={onSubmit} className={authFormClass}>
        <AuthTextField
          id="email"
          label="Email"
          type="email"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <AuthPrimaryButton loading={loading}>
          Send reset link
        </AuthPrimaryButton>
      </form>
      <p className={authMutedFooterClass}>
        <Link to="/login" className={authFooterLinkClass}>
          Back to sign in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
