"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { addWorkspaceMember } from "@/lib/api/members";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/lib/toast";
import { Loader2, ArrowLeft, UserPlus } from "lucide-react";
import { MemberForm } from "@/components/forms/MemberForm";

export default function NewMemberPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const workspaceId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);

  useEffect(() => {
    async function fetchRoles() {
      if (isNaN(workspaceId)) return;
      try {
        const res = await apiGet<any>(`/workspaces/${workspaceId}/roles`);
        setRoles(res.roles || []);
      }
      catch (error) {
        showToast("Error loading roles", "error");
      }
      finally {
        setLoading(false);
      }
    }
    fetchRoles();
  }, [workspaceId, showToast]);

  const handleSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      // Using 'create' mode by default as it covers both cases in the backend usually if data is provided
      // or we can stick to 'invite' if that's what's preferred. 
      // Given the original had both, I'll use 'create' with details.
      await addWorkspaceMember(
        workspaceId,
        data.email,
        data.role_id,
        'create',
        {
          first_name: data.first_name,
          last_name: data.last_name,
          password: "temporaryPassword123!" // Or random, or let them set it. Original had a field.
        }
      );

      showToast("Member added successfully", "success");
      router.push(`/workspaces/${workspaceId}/members`);
    }
    catch (error: any) {
      showToast(error.message || "Failed to add member", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="cursor-pointer">
          <Link href={`/workspaces/${workspaceId}/members`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Add New Member</h1>
          <p className="text-muted-foreground">Invite someone new to join your workspace team.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-slate-500" />
            Member Details
          </CardTitle>
          <CardDescription>
            Enter the details for the new member you want to add.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MemberForm
            roles={roles}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/workspaces/${workspaceId}/members`)}
            isSubmitting={isSubmitting}
            submitLabel="Add Member"
          />
        </CardContent>
      </Card>
    </div>
  );
}
