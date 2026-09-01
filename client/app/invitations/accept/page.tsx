"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, Eye, EyeOff, Layers, Loader2, Mail, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { ApiClientError, apiGet, apiPost } from "@/lib/api-client";
import { useToast } from "@/lib/toast";

interface InvitationDetails {
  email: string;
  workspace_id: number;
  workspace_name: string;
  inviter_name: string;
  expires_at: string;
  account_exists: boolean;
  authenticated_as_invitee: boolean;
}

interface InvitationResponse {
  invitation: InvitationDetails;
}

interface AcceptInvitationResponse {
  workspace_id: number;
  message: string;
}

interface InvitationPageError {
  message: string;
  status?: number;
}

function getInvitationErrorState(error: InvitationPageError) {
  const message = error.message.toLowerCase();
  if (message.includes("expired")) return { title: "Invitation expired", guidance: "Ask a workspace administrator to send a new invitation.", action: "Go to sign in" };
  if (message.includes("accepted")) return { title: "Invitation already accepted", guidance: "This link can only be used once.", action: "Go to sign in" };
  if (message.includes("different account")) return { title: "Use the invited account", guidance: "Sign out, then sign in with the email address that received this invitation.", action: "Go to sign in" };
  if (error.status && error.status >= 500) return { title: "Temporary invitation problem", guidance: "Please try again in a moment. If it continues, contact the workspace administrator.", action: "Try again later" };
  if (message.includes("no longer available")) return { title: "Invitation revoked", guidance: "Ask a workspace administrator to send a new invitation.", action: "Go to sign in" };
  return { title: "Invitation unavailable", guidance: "Check that you opened the complete invitation link, or ask a workspace administrator to send a new one.", action: "Go to sign in" };
}

function InvitationAcceptForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState<InvitationPageError | null>(null);
  const [fields, setFields] = useState({
    first_name: "",
    last_name: "",
    password: "",
    password_confirmation: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    async function loadInvitation() {
      if (!token) {
        setPageError({ message: "This invitation link is missing its secure token." });
        setLoading(false);
        return;
      }

      try {
        const response = await apiGet<InvitationResponse>(`/invitations/${encodeURIComponent(token)}`);
        setInvitation(response.invitation);
      } catch (error) {
        setPageError({
          message: error instanceof Error ? error.message : "This invitation could not be loaded.",
          status: error instanceof ApiClientError ? error.status : undefined,
        });
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) loadInvitation();
  }, [authLoading, token, user?.email]);

  const updateField = (name: keyof typeof fields, value: string) => {
    setFields((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));
  };

  const acceptInvitation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!invitation) return;
    setSubmitting(true);
    setErrors({});

    try {
      const response = await apiPost<AcceptInvitationResponse>(
        `/invitations/${encodeURIComponent(token)}/accept`,
        invitation.account_exists ? {} : fields,
      );
      await refreshUser();
      showToast(response.message, "success");
      // The dashboard provider restores this persisted workspace after navigation.
      localStorage.setItem("activeWorkspaceId", response.workspace_id.toString());
      router.push("/dashboard");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401 && error.errors?.requires_auth) {
        // An account may be created after token inspection, so preserve this exact link while its owner signs in.
        const recipientEmail = typeof error.errors.email === "string" ? error.errors.email : invitation.email;
        const returnPath = `/invitations/accept?token=${encodeURIComponent(token)}`;
        router.push(`/login?email=${encodeURIComponent(recipientEmail)}&next=${encodeURIComponent(returnPath)}`);
        return;
      }
      if (error instanceof ApiClientError && error.errors) {
        setErrors(error.errors);
      } else {
        setPageError({
          message: error instanceof Error ? error.message : "The invitation could not be accepted.",
          status: error instanceof ApiClientError ? error.status : undefined,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return <div className="flex min-h-[260px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" aria-label="Loading invitation" /></div>;
  }

  if (pageError || !invitation) {
    const errorState = getInvitationErrorState(pageError || { message: "This invitation could not be loaded." });
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600"><Clock3 className="h-7 w-7" /></div>
        <div><h1 className="text-2xl font-bold text-slate-950">{errorState.title}</h1><p role="alert" className="mt-2 text-sm leading-6 text-slate-600">{pageError?.message}</p><p className="mt-2 text-sm leading-6 text-slate-600">{errorState.guidance}</p></div>
        <Button asChild variant="outline"><Link href="/login">{errorState.action}</Link></Button>
      </div>
    );
  }

  const returnPath = `/invitations/accept?token=${encodeURIComponent(token)}`;
  const loginHref = `/login?email=${encodeURIComponent(invitation.email)}&next=${encodeURIComponent(returnPath)}`;
  const signedInWrongAccount = Boolean(user && user.email.toLowerCase() !== invitation.email.toLowerCase());

  return (
    <div className="space-y-7">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><UsersRound className="h-7 w-7" /></div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Workspace invitation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Join {invitation.workspace_name}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600"><strong>{invitation.inviter_name}</strong> invited you to collaborate on Zentrix.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600" aria-label="Invitation details">
        <div className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span className="min-w-0 break-all">{invitation.email}</span></div>
        <div className="mt-2 flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>Expires {new Date(invitation.expires_at).toLocaleString()}</span></div>
      </div>

      {invitation.account_exists && (!user || signedInWrongAccount) ? (
        <div className="space-y-4 text-center">
          <p className="text-sm leading-6 text-slate-600">
            {signedInWrongAccount
              ? `You are signed in as ${user?.email}. This invitation belongs to ${invitation.email}.`
              : "You already have a Zentrix account. Sign in with the invited email to continue."}
          </p>
          <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-700"><Link href={loginHref}>Sign in as {invitation.email}</Link></Button>
        </div>
      ) : (
        <form onSubmit={acceptInvitation} className="space-y-5">
          {!invitation.account_exists && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" name="first_name" value={fields.first_name} error={errors.first_name} onChange={updateField} />
                <Field label="Last name" name="last_name" value={fields.last_name} error={errors.last_name} onChange={updateField} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} value={fields.password} onChange={(event) => updateField("password", event.target.value)} className="pr-10" autoComplete="new-password" aria-invalid={Boolean(errors.password)} />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
                <p className="text-xs leading-5 text-slate-500">Use at least 8 characters.</p>
                {errors.password && <p role="alert" className="text-sm text-red-600">{errors.password}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password_confirmation">Confirm password</Label>
                <Input id="password_confirmation" type={showPassword ? "text" : "password"} value={fields.password_confirmation} onChange={(event) => updateField("password_confirmation", event.target.value)} autoComplete="new-password" aria-invalid={Boolean(errors.password_confirmation)} />
                {errors.password_confirmation && <p role="alert" className="text-sm text-red-600">{errors.password_confirmation}</p>}
              </div>
            </>
          )}
          <Button type="submit" className="h-11 w-full bg-indigo-600 text-base hover:bg-indigo-700" disabled={submitting}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Accepting...</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Accept invitation</>}
          </Button>
        </form>
      )}
    </div>
  );
}

interface FieldProps {
  label: string;
  name: "first_name" | "last_name";
  value: string;
  error?: string;
  onChange: (name: "first_name" | "last_name", value: string) => void;
}

function Field({ label, name, value, error, onChange }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} value={value} onChange={(event) => onChange(name, event.target.value)} autoComplete={name === "first_name" ? "given-name" : "family-name"} aria-invalid={Boolean(error)} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    /* The app shell locks the document viewport; this route owns scrolling so no form fields are clipped on short screens. */
    <main className="h-full overflow-y-auto overscroll-contain bg-gradient-to-br from-slate-100 via-white to-indigo-50 px-4 py-6 sm:py-10">
      <div className="mx-auto mb-5 flex items-center justify-center gap-2 sm:mb-7"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><Layers className="h-6 w-6" /></div><span className="text-2xl font-bold text-slate-950">Zentrix</span></div>
      <section className="mx-auto mb-6 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:mb-10 sm:p-9">
        <Suspense fallback={<div className="flex min-h-[260px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>}>
          <InvitationAcceptForm />
        </Suspense>
      </section>
    </main>
  );
}
