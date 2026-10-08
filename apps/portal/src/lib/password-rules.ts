/** The same rules the API enforces when a password is chosen (see
 * viralcut-api src/auth/password-policy.ts) — checked here first so the
 * form can say what's wrong before sending anything. */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRule = { id: string; label: string; met: boolean };

export function passwordRules(value: string): PasswordRule[] {
  return [
    { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH },
    { id: "letter", label: "A letter", met: /[A-Za-z]/.test(value) },
    { id: "number", label: "A number", met: /[0-9]/.test(value) },
    { id: "varied", label: "Not the same few characters repeated", met: new Set(value).size >= 5 },
  ];
}

/** Why the password can't be used, or null when it meets every rule. */
export function passwordProblem(value: string): string | null {
  const unmet = passwordRules(value).find((r) => !r.met);
  return unmet ? `Password needs: ${unmet.label.toLowerCase()}` : null;
}
