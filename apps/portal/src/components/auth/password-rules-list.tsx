import { Check, Circle } from "lucide-react";

import { passwordRules } from "@/lib/password-rules";
import { cn } from "@/lib/utils";

/** Live checklist of the password rules — shows what's still missing
 * before the form is sent, instead of an error after. */
export function PasswordRulesList({ value, className }: { value: string; className?: string }) {
  return (
    <ul className={cn("space-y-1 text-xs", className)} aria-label="Password rules">
      {passwordRules(value).map((rule) => (
        <li key={rule.id} className={cn("flex items-center gap-2", rule.met ? "text-primary" : "text-muted")}>
          {rule.met ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          <span>{rule.label}</span>
        </li>
      ))}
    </ul>
  );
}
