"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { apiGet } from "@/lib/api-client";
import { getWorkspaceMembers, updateWorkspaceMember, WorkspaceMember } from "@/lib/api/members";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, UserCog } from "lucide-react";
import { MemberForm } from "@/components/forms/MemberForm";

export default function EditWorkspaceMemberPage() {
  const { id, membershipId } = useParams();
  const router = useRouter();
  const { loading: wsLoading, hasPermission } = useWorkspace();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [member, setMember] = useState<any>(null);

  useEffect(() => {
    if (!hasPermission('members:manage_roles') && !wsLoading) {
      showToast("You do not have permission to edit members", "error");
      router.push(`/workspaces/${id}/members`);
    }
  }, [hasPermission, wsLoading, id, router, showToast]);

  useEffect(() => {
    async function fetchData() {
      if (!id || !membershipId) return;

      try {
        const [membersRes, rolesRes] = await Promise.all([
          getWorkspaceMembers(Number(id)),
          apiGet<any>(`/workspaces/${id}/roles`)
        ]);

        const targetMember = membersRes.members.find((m: WorkspaceMember) => String(m.membership_id) === String(membershipId));
        setRoles(rolesRes.roles || []);

        if (!targetMember) {
          showToast("Member not found", "error");
          router.push(`/workspaces/${id}/members`);
          return;
        }

        setMember(targetMember);
      }
      catch (err: any) {
        showToast("Failed to load member details", "error");
      }
      finally {
        setIsLoading(false);
      }
    }

    if (!wsLoading) {
      fetchData();
    }
  }, [id, membershipId, wsLoading, router, showToast]);

  const handleSubmit = async (data: any) => {
    try {
      setIsSaving(true);
      await updateWorkspaceMember(Number(membershipId), {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        role_id: Number(data.role_id)
      });
      showToast("Member updated successfully", "success");
      router.push(`/workspaces/${id}/members`);
    }
    catch (err: any) {
      showToast(err.message || "Failed to update member", "error");
    }
    finally {
      setIsSaving(false);
    }
  };

  if (isLoading || wsLoading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 flex flex-col w-full">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="cursor-pointer">
          <Link href={`/workspaces/${id}/members`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Edit Member</h1>
          <p className="text-muted-foreground">Modify user profile details and adjust workspace access roles.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-slate-500" />
            Member Configuration
          </CardTitle>
          <CardDescription>
            Update the member's profile details and workspace role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {member && (
            <MemberForm
              initialData={{
                first_name: member.first_name || "",
                last_name: member.last_name || "",
                email: member.email || "",
                role_id: roles.find(r => r.name.toLowerCase() === member.role?.toLowerCase())?.id?.toString() || ""
              }}
              roles={roles}
              onSubmit={handleSubmit}
              onCancel={() => router.push(`/workspaces/${id}/members`)}
              isSubmitting={isSaving}
              submitLabel="Save Changes"
              isEdit={true}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
