"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { addWorkspaceMember } from "@/lib/api/members";
import { ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/lib/toast";
import { ArrowLeft, UserPlus } from "lucide-react";
import { InviteMemberForm } from "@/components/forms/invite-member-form";

export default function NewMemberPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const workspaceId = Number(params.id);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (email: string) => {
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
    <div className="w-full space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="cursor-pointer">
          <Link href={`/workspaces/${workspaceId}/members`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Invite a team member</h1>
          <p className="text-muted-foreground">Send a secure invitation that expires in 48 hours.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-slate-500" />
            Email invitation
          </CardTitle>
          <CardDescription>
            Enter their email address. They will complete their own profile when they accept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteMemberForm
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/workspaces/${workspaceId}/members`)}
            isSubmitting={isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}
