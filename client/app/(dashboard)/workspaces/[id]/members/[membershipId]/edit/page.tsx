"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { apiGet } from "@/lib/api-client";
import { getWorkspaceMembers, updateWorkspaceMember, WorkspaceMember } from "@/lib/api/members";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, UserCog } from "lucide-react";

export default function EditWorkspaceMemberPage() {
  const { id, membershipId } = useParams();
  const router = useRouter();
  const { activeWorkspace, loading: wsLoading, hasPermission } = useWorkspace();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role_id: 0
  });

  useEffect(() => {
    if (!hasPermission('members:manage_roles') && !wsLoading) {
      showToast("You do not have permission to edit members", "error");
      router.push(`/workspaces/${id}/members`);
    }
  }, [hasPermission, wsLoading, id, router, showToast]);

  useEffect(() => {
    async function fetchMemberDetails() {
      if (!id || !membershipId) return;
      
      try {
        const [membersRes, rolesRes] = await Promise.all([
          getWorkspaceMembers(Number(id)),
          apiGet<any>(`/workspaces/${id}/roles`)
        ]);
        
        const targetMember = membersRes.members.find((m: WorkspaceMember) => String(m.membership_id) === String(membershipId));
        const allRoles = rolesRes.roles || [];
        
        if (!targetMember) {
          showToast("Member not found", "error");
          router.push(`/workspaces/${id}/members`);
          return;
        }

        setRoles(allRoles);
        
        const matchingRole = allRoles.find((r: any) => r.name.toLowerCase() === targetMember.role?.toLowerCase());
        
        setEditForm({
          first_name: targetMember.first_name || "",
          last_name: targetMember.last_name || "",
          email: targetMember.email || "",
          role_id: matchingRole?.id || 0
        });
      } catch (err: any) {
        showToast("Failed to load member details", "error");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    if (!wsLoading) {
      fetchMemberDetails();
    }
  }, [id, membershipId, wsLoading, router, showToast]);

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.first_name.trim() || !editForm.last_name.trim() || !editForm.email.trim() || !editForm.role_id) {
      showToast("All fields are required", "error");
      return;
    }

    try {
      setIsSaving(true);
      await updateWorkspaceMember(Number(membershipId), {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email,
        role_id: editForm.role_id
      });
      showToast("Member details updated successfully", "success");
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
    <div className="max-w-4xl mx-auto space-y-6 flex flex-col w-full">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="cursor-pointer">
          <Link href={`/workspaces/${id}/members`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Edit Member Details</h1>
          <p className="text-muted-foreground">Modify user profile details and adjust workspace access roles.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-blue-600" />
            Member Configuration
          </CardTitle>
          <CardDescription>
            Update the member's core system details and workspace role below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateMember} className="mt-4">
            <div className="grid gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="first_name" className="text-sm font-medium">First Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="first_name"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    required
                    className="bg-white"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="last_name" className="text-sm font-medium">Last Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="last_name"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    required
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="email" className="text-sm font-medium">Email Address <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                  className="bg-white"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="role" className="text-sm font-medium">Workspace Role <span className="text-red-500">*</span></Label>
                <Select value={editForm.role_id.toString()} onValueChange={(val) => setEditForm({ ...editForm, role_id: parseInt(val) })}>
                  <SelectTrigger id="role" className="bg-white">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r: any) => (
                      <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                asChild
              >
                <Link href={`/workspaces/${id}/members`}>Cancel</Link>
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 cursor-pointer text-white"
                disabled={isSaving || !editForm.first_name || !editForm.last_name || !editForm.email || !editForm.role_id}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
