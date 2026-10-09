import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { AuthPasswordField } from "@/components/auth/auth-password-field";
import { AuthPrimaryButton } from "@/components/auth/auth-primary-button";
import { PasswordRulesList } from "@/components/auth/password-rules-list";
import {
  authFooterLinkClass,
  authFormClass,
  authMutedFooterClass,
} from "@/components/auth/auth-styles";
import {
  AuthMobileBrandMark,
  AuthPageHeader,
  AuthSplitLayout,
  AuthTrustBadges,
} from "@/components/layout/auth-split-layout";
import { useToast } from "@/components/ui/toaster";
import { authApi, ApiError } from "@/lib/api";
import { PASSWORD_MIN_LENGTH, passwordProblem } from "@/lib/password-rules";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  // The link's token is read once, then taken out of the address bar so it
  // isn't left in the browser history or copied along with the page address.
  const [token] = useState(() => searchParams.get("token") ?? "");
  useEffect(() => {
    if (searchParams.has("token")) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, [searchParams]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast("Reset link is invalid or missing.", "error");
      return;
    }
    const problem = passwordProblem(password);
    if (problem) {
      toast(problem, "error");
      return;
    }
    if (password !== confirm) {
      toast("Passwords do not match.", "error");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({ token, password });
      toast("Password updated. You can sign in now.", "success");
      navigate("/login", { replace: true });
    } catch (err) {
      toast(
        err instanceof ApiError ? err.message : "Could not reset password",
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
        title="Choose a new password"
        description="Choose a new password for your Halchal account."
      />
      <form onSubmit={onSubmit} className={authFormClass}>
        <AuthPasswordField
          id="password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
        />
        <PasswordRulesList value={password} />
        <AuthPasswordField
          id="confirm"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
        />
        <AuthPrimaryButton loading={loading}>
          Update password
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
