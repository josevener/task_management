"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Edit2, Loader2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useWorkspace } from "@/contexts/workspace-context";
import { getWorkspaceMembers, WorkspaceMember } from "@/lib/api/members";
import { useToast } from "@/lib/toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function WorkspaceMemberPage() {
  const { id, membershipId } = useParams();
  const workspaceId = typeof id === "string" ? id : "";
  const memberPublicId = typeof membershipId === "string" ? membershipId : "";
  const { hasPermission, loading: workspaceLoading } = useWorkspace();
  const { showToast } = useToast();
  const router = useRouter();
  const [member, setMember] = useState<WorkspaceMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMember() {
      if (!workspaceId || !memberPublicId) return;
      try {
        const response = await getWorkspaceMembers(workspaceId);
        const foundMember = response.members.find((item) => item.membership_id === memberPublicId);
        if (!foundMember) {
          showToast("Member not found", "error");
          router.replace(`/workspaces/${workspaceId}/members`);
          return;
        }
        setMember(foundMember);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Failed to load member", "error");
      } finally { setIsLoading(false); }
    }
    void loadMember();
  }, [memberPublicId, router, showToast, workspaceId]);

  if (isLoading || workspaceLoading) return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;
  if (!member) return null;
  const initials = `${member.first_name?.[0] || ""}${member.last_name?.[0] || ""}`.toUpperCase() || "?";

  return <div className="mx-auto w-full max-w-3xl space-y-6 pb-10">
    <div className="flex items-center justify-between gap-3"><Button variant="ghost" asChild className="gap-2 text-slate-600"><Link href={`/workspaces/${workspaceId}/members`}><ArrowLeft className="h-4 w-4" />All members</Link></Button>{hasPermission("members:manage_roles") && <Button asChild className="gap-2 bg-indigo-600 hover:bg-indigo-700"><Link href={`/workspaces/${workspaceId}/members/${memberPublicId}/edit`}><Edit2 className="h-4 w-4" />Edit role</Link></Button>}</div>
    <Card className="overflow-hidden border-slate-200 shadow-sm"><div className="h-24 bg-gradient-to-r from-indigo-600 to-violet-600" /><CardContent className="relative px-6 pb-7 sm:px-8"><Avatar className="-mt-12 h-24 w-24 border-4 border-white shadow-sm"><AvatarFallback className="bg-indigo-100 text-2xl font-semibold text-indigo-700">{initials}</AvatarFallback></Avatar><div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-2xl font-semibold text-slate-950">{member.first_name} {member.last_name}</p><p className="mt-1 text-slate-500">Workspace member</p></div><Badge variant="outline" className="w-fit border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700"><ShieldCheck className="mr-1.5 h-4 w-4" />{member.role || "Member"}</Badge></div></CardContent></Card>
    <div className="grid gap-4 sm:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4 text-indigo-600" />Contact</CardTitle><CardDescription>The email address associated with this account.</CardDescription></CardHeader><CardContent><a className="break-all font-medium text-indigo-700 hover:underline" href={`mailto:${member.email}`}>{member.email}</a></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-indigo-600" />Workspace access</CardTitle><CardDescription>Membership details for this workspace.</CardDescription></CardHeader><CardContent><p className="font-medium text-slate-900">Joined {member.created_at ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(member.created_at)) : "recently"}</p></CardContent></Card></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-indigo-600" />About role management</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-slate-600">Roles determine what members can do in this workspace. Profile information is managed by the member in their own account settings.</CardContent></Card>
  </div>;
}
