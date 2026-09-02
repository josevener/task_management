"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Mail, ShieldCheck, UserCog } from "lucide-react";
import { useWorkspace } from "@/contexts/workspace-context";
import { ApiClientError, apiGet } from "@/lib/api-client";
import { getWorkspaceMembers, updateWorkspaceMember, WorkspaceMember } from "@/lib/api/members";
import { useToast } from "@/lib/toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WorkspaceRole {
  id: number;
  name: string;
  description?: string | null;
  is_system_role?: boolean;
}

export default function EditWorkspaceMemberPage() {
  const { id, membershipId } = useParams();
  const workspaceId = typeof id === "string" ? id : "";
  const memberPublicId = typeof membershipId === "string" ? membershipId : "";
  const router = useRouter();
  const { loading: workspaceLoading, hasPermission } = useWorkspace();
  const { showToast } = useToast();
  const [member, setMember] = useState<WorkspaceMember | null>(null);
  const [roles, setRoles] = useState<WorkspaceRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [roleError, setRoleError] = useState("");

  useEffect(() => {
    if (!workspaceLoading && !hasPermission("members:manage_roles")) {
      showToast("You do not have permission to edit member roles", "error");
      router.replace(`/workspaces/${workspaceId}/members`);
    }
  }, [hasPermission, router, showToast, workspaceId, workspaceLoading]);

  useEffect(() => {
    async function loadData() {
      if (!workspaceId || !memberPublicId || workspaceLoading) return;
      try {
        const [membersResponse, rolesResponse] = await Promise.all([
          getWorkspaceMembers(workspaceId),
          apiGet<{ roles: WorkspaceRole[] }>(`/workspaces/${workspaceId}/roles`),
        ]);
        const foundMember = membersResponse.members.find((item) => item.membership_id === memberPublicId);
        if (!foundMember) {
          showToast("Member not found", "error");
          router.replace(`/workspaces/${workspaceId}/members`);
          return;
        }
        const loadedRoles = rolesResponse.roles || [];
        setMember(foundMember);
        setRoles(loadedRoles);
        setSelectedRoleId(String(loadedRoles.find((role) => role.name.toLowerCase() === foundMember.role?.toLowerCase())?.id || ""));
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Failed to load member details", "error");
      } finally { setIsLoading(false); }
    }
    void loadData();
  }, [memberPublicId, router, showToast, workspaceId, workspaceLoading]);

  const selectedRole = roles.find((role) => String(role.id) === selectedRoleId);
  const saveRole = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRoleId) { setRoleError("Choose a workspace role."); return; }
    setRoleError("");
    try {
      setIsSaving(true);
      await updateWorkspaceMember(memberPublicId, { role_id: Number(selectedRoleId) });
      showToast("Member role updated", "success");
      router.push(`/workspaces/${workspaceId}/members/${memberPublicId}`);
    } catch (error) {
      setRoleError(error instanceof ApiClientError && error.errors?.role_id ? error.errors.role_id : error instanceof Error ? error.message : "Could not update this member's role.");
    } finally { setIsSaving(false); }
  };

  if (isLoading || workspaceLoading) return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;
  if (!member) return null;
  const initials = `${member.first_name?.[0] || ""}${member.last_name?.[0] || ""}`.toUpperCase() || "?";

  return <div className="mx-auto w-full max-w-4xl space-y-6 pb-10">
    <div className="flex items-center justify-between gap-3"><Button variant="ghost" asChild className="gap-2 text-slate-600"><Link href={`/workspaces/${workspaceId}/members/${memberPublicId}`}><ArrowLeft className="h-4 w-4" />Member details</Link></Button></div>
    <div><p className="text-sm font-medium text-indigo-700">Workspace access</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Edit member role</h1><p className="mt-1 text-sm text-slate-500">Choose what this person can do in this workspace.</p></div>
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
      <Card className="h-fit border-slate-200 shadow-sm"><CardContent className="p-6"><Avatar className="h-14 w-14 border border-slate-200"><AvatarFallback className="bg-indigo-50 text-lg font-semibold text-indigo-700">{initials}</AvatarFallback></Avatar><h2 className="mt-4 text-lg font-semibold text-slate-950">{member.first_name} {member.last_name}</h2><p className="mt-1 flex break-all text-sm text-slate-500"><Mail className="mr-2 mt-0.5 h-4 w-4 shrink-0" />{member.email}</p><div className="mt-5 border-t border-slate-100 pt-5"><p className="flex items-center gap-2 text-sm font-medium text-slate-800"><ShieldCheck className="h-4 w-4 text-indigo-600" />Profile information</p><p className="mt-2 text-sm leading-6 text-slate-500">Names and email are managed by the member in their account settings.</p></div></CardContent></Card>
      <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-indigo-600" />Role assignment</CardTitle><CardDescription>Changing a role applies its workspace permissions immediately.</CardDescription></CardHeader><CardContent><form onSubmit={saveRole} className="space-y-6"><div className="w-full space-y-2"><Label htmlFor="workspace-role">Workspace role</Label><Select value={selectedRoleId} onValueChange={(value) => { setSelectedRoleId(value); setRoleError(""); }} disabled={isSaving}><SelectTrigger id="workspace-role" className="w-full" aria-invalid={Boolean(roleError)}><SelectValue placeholder="Select a role" /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.id} value={String(role.id)}>{role.name}</SelectItem>)}</SelectContent></Select>{roleError ? <p role="alert" className="text-sm font-medium text-red-600">{roleError}</p> : <p className="text-sm text-slate-500">{selectedRole?.description || "Select a role to review its access level."}</p>}</div><div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><span className="font-medium">Review before saving.</span> A role change can grant or remove access to workspace projects, tasks, and member management.</div><div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => router.push(`/workspaces/${workspaceId}/members/${memberPublicId}`)} disabled={isSaving}>Cancel</Button><Button type="submit" className="gap-2 bg-indigo-600 hover:bg-indigo-700" disabled={isSaving || !selectedRoleId}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{isSaving ? "Saving role..." : "Save role"}</Button></div></form></CardContent></Card>
    </div>
  </div>;
}
