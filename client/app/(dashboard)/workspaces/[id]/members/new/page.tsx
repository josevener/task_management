"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { addWorkspaceMember } from "@/lib/api/members";
import { ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/lib/toast";
import { ArrowLeft, Clock3, MailCheck, ShieldCheck, UserPlus } from "lucide-react";
import { InviteMemberForm } from "@/components/forms/invite-member-form";

export default function NewMemberPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const workspaceId = typeof params.id === "string" ? params.id : "";

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (email: string) => {
    if (!workspaceId) {
      showToast("Workspace not found", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await addWorkspaceMember(workspaceId, email);

      showToast(`${response.message} Sent to ${response.invitation.email}.`, "success");
      router.push(`/workspaces/${workspaceId}/members`);
    }
    catch (error) {
      const message = error instanceof ApiClientError && error.errors?.email
        ? error.errors.email
        : error instanceof Error ? error.message : "Failed to send invitation";
      showToast(message, "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild className="gap-2 text-slate-600"><Link href={`/workspaces/${workspaceId}/members`}><ArrowLeft className="h-4 w-4" />All members</Link></Button>
      </div>

      <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white shadow-sm sm:p-8">
        <div className="flex items-start gap-4"><div className="rounded-xl bg-white/15 p-3"><UserPlus className="h-6 w-6" /></div><div><p className="text-sm font-medium text-indigo-100">Grow your workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Invite a team member</h1><p className="mt-2 max-w-xl text-sm leading-6 text-indigo-100">We’ll send a secure email invitation. They choose their own profile details when they join.</p></div></div>
      </section>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5 text-slate-500" />
            Email invitation
          </CardTitle>
          <CardDescription>Enter one email address to start the invitation.</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteMemberForm
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/workspaces/${workspaceId}/members`)}
            isSubmitting={isSubmitting}
          />
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        {[[MailCheck, "Email invitation", "Sent straight to their inbox."], [Clock3, "48-hour expiry", "Expired invitations stay safe."], [ShieldCheck, "Workspace access", "Permissions are assigned after joining."]].map(([Icon, title, description]) => {
          const FeatureIcon = Icon as typeof MailCheck;
          return <div key={String(title)} className="rounded-xl border border-slate-200 bg-white p-4"><FeatureIcon className="h-5 w-5 text-indigo-600" /><p className="mt-3 text-sm font-medium text-slate-900">{String(title)}</p><p className="mt-1 text-xs leading-5 text-slate-500">{String(description)}</p></div>;
        })}
      </div>
    </div>
  );
}
