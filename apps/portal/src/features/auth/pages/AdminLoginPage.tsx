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
} from "@/components/layout/auth-split-layout";
import { useToast } from "@/components/ui/toaster";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { useAuth } from "@/providers/auth-provider";

import { signInErrorMessage } from "@/lib/sign-in-error";
export function AdminLoginPage() {
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
      await login(email, password, "admin", redirectTo);
      toast("Welcome back!");
    } catch (err) {
      toast(signInErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout heroVariant="login">
      <AuthMobileBrandMark />
      <AuthPageHeader
        title="Admin sign in"
        description="Sign in to manage all brands and campaigns."
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
        <AuthPasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          required
        />
        <AuthPrimaryButton
          loading={loading}
          trailingIcon={<ArrowRight className="size-4" />}
        >
          Sign in
        </AuthPrimaryButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Team member?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Team sign in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
