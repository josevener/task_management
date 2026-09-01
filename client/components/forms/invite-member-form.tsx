"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteMemberFormProps {
  onSubmit: (email: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function InviteMemberForm({ onSubmit, onCancel, isSubmitting }: InviteMemberFormProps) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setEmailError("Email is required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError("Enter a valid email address");
      return;
    }

    setEmailError("");
    await onSubmit(normalizedEmail);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email address</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            id="invite-email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (emailError) setEmailError("");
            }}
            placeholder="name@example.com"
            className="h-11 pl-10"
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "invite-email-error" : "invite-email-help"}
            disabled={isSubmitting}
          />
        </div>
        {emailError ? (
          <p id="invite-email-error" role="alert" className="text-sm font-medium text-red-600">{emailError}</p>
        ) : (
          <p id="invite-email-help" className="text-sm text-muted-foreground">
            They will provide their profile details after opening the invitation.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t pt-5">
        <Button type="button" variant="outline" className="cursor-pointer" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" className="bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? "Sending..." : "Send invitation"}
        </Button>
      </div>
    </form>
  );
}
