"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { getWorkspaceMembers, removeWorkspaceMember, WorkspaceMember } from "@/lib/api/members";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit2, Loader2, Plus, RefreshCw, Search, ShieldCheck, Trash2, UserRound } from "lucide-react";

const roleClasses: Record<string, string> = { admin: "border-indigo-200 bg-indigo-50 text-indigo-700", manager: "border-sky-200 bg-sky-50 text-sky-700", member: "border-slate-200 bg-slate-50 text-slate-700", guest: "border-amber-200 bg-amber-50 text-amber-700" };
const memberInitials = (member: WorkspaceMember) => `${member.first_name?.[0] || ""}${member.last_name?.[0] || ""}`.toUpperCase() || "?";

export default function WorkspaceMembersPage() {
  const { id } = useParams();
  const workspaceId = typeof id === "string" ? id : "";
  const router = useRouter();
  const { activeWorkspace, loading: workspaceLoading, hasPermission } = useWorkspace();
  const { showToast } = useToast();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (!workspaceLoading && activeWorkspace && activeWorkspace.id !== workspaceId) router.replace(`/workspaces/${activeWorkspace.id}/members`);
  }, [activeWorkspace, router, workspaceId, workspaceLoading]);

  const loadMembers = useCallback(async (refresh = false) => {
    if (!workspaceId) return;
    try {
      refresh ? setIsRefreshing(true) : setIsLoading(true);
      const response = await getWorkspaceMembers(workspaceId);
      setMembers(response.members || []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load workspace members", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast, workspaceId]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  const filteredMembers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? members.filter((member) => `${member.first_name} ${member.last_name} ${member.email} ${member.role}`.toLowerCase().includes(term)) : members;
  }, [members, query]);
  const roleCounts = useMemo(() => members.reduce<Record<string, number>>((counts, member) => {
    const role = member.role?.toLowerCase() || "member";
    counts[role] = (counts[role] || 0) + 1;
    return counts;
  }, {}), [members]);

  const removeMember = async () => {
    if (!memberToRemove?.membership_id) return;
    try {
      setIsRemoving(true);
      await removeWorkspaceMember(memberToRemove.membership_id);
      setMembers((current) => current.filter((member) => member.membership_id !== memberToRemove.membership_id));
      showToast(`${memberToRemove.first_name} was removed from this workspace.`, "success");
      setMemberToRemove(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to remove member", "error");
    } finally { setIsRemoving(false); }
  };

  if (isLoading || workspaceLoading) return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div><h1 className="text-2xl font-semibold tracking-tight text-slate-950">Team members</h1><p className="mt-1 text-sm text-slate-500">Manage access and roles for {activeWorkspace?.name || "this workspace"}.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" className="gap-2" onClick={() => void loadMembers(true)} disabled={isRefreshing}><RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />Refresh</Button>{hasPermission("members:invite") && <Button asChild size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700"><Link href={`/workspaces/${workspaceId}/members/new`}><Plus className="h-4 w-4" />Invite member</Link></Button>}</div>
    </section>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Card><CardContent className="p-4"><p className="text-sm text-slate-500">Total members</p><p className="mt-1 text-2xl font-semibold text-slate-950">{members.length}</p></CardContent></Card>{["admin", "manager", "member"].map((role) => <Card key={role}><CardContent className="p-4"><p className="text-sm capitalize text-slate-500">{role}s</p><p className="mt-1 text-2xl font-semibold text-slate-950">{roleCounts[role] || 0}</p></CardContent></Card>)}</div>
    <Card className="overflow-hidden border-slate-200 shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-slate-950">Directory</h2><p className="mt-1 text-sm text-slate-500">{filteredMembers.length} of {members.length} members shown</p></div><div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or role" className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none ring-indigo-500 transition focus:ring-2" /></div></div><CardContent className="p-0">{filteredMembers.length === 0 ? <div className="flex flex-col items-center px-6 py-16 text-center"><div className="rounded-full bg-slate-100 p-3"><UserRound className="h-6 w-6 text-slate-500" /></div><h3 className="mt-4 font-semibold text-slate-900">{members.length ? "No matching members" : "No members yet"}</h3><p className="mt-1 max-w-sm text-sm text-slate-500">{members.length ? "Try a different search term." : "Invite a teammate to give them access to this workspace."}</p>{!members.length && hasPermission("members:invite") && <Button asChild className="mt-5 bg-indigo-600 hover:bg-indigo-700"><Link href={`/workspaces/${workspaceId}/members/new`}>Invite the first member</Link></Button>}</div> : <div className="divide-y divide-slate-100">{filteredMembers.map((member) => { const role = member.role?.toLowerCase() || "member"; return <div key={member.membership_id || member.user_id} className="flex flex-col gap-4 px-5 py-4 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"><Link href={`/workspaces/${workspaceId}/members/${member.membership_id}`} className="flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><Avatar className="h-10 w-10 border border-slate-200"><AvatarFallback className="bg-indigo-50 font-medium text-indigo-700">{memberInitials(member)}</AvatarFallback></Avatar><span className="min-w-0"><span className="block truncate font-medium text-slate-900">{member.first_name} {member.last_name}</span><span className="block truncate text-sm text-slate-500">{member.email}</span></span></Link><div className="flex items-center justify-between gap-3 sm:justify-end"><Badge variant="outline" className={roleClasses[role] || roleClasses.member}><ShieldCheck className="mr-1 h-3.5 w-3.5" />{member.role || "Member"}</Badge><div className="flex items-center gap-1">{hasPermission("members:manage_roles") && member.membership_id && <Button variant="ghost" size="icon" title="Edit role" asChild><Link href={`/workspaces/${workspaceId}/members/${member.membership_id}/edit`}><Edit2 className="h-4 w-4" /></Link></Button>}{hasPermission("members:remove") && member.membership_id && <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-red-50 hover:text-red-600" title="Remove member" onClick={() => setMemberToRemove(member)}><Trash2 className="h-4 w-4" /></Button>}</div></div></div>; })}</div>}</CardContent></Card>
    <Dialog open={Boolean(memberToRemove)} onOpenChange={(open) => !open && setMemberToRemove(null)}><DialogContent><DialogHeader><DialogTitle>Remove {memberToRemove?.first_name}?</DialogTitle><DialogDescription>This removes their workspace access and project memberships. Their account will not be deleted.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setMemberToRemove(null)} disabled={isRemoving}>Cancel</Button><Button variant="destructive" onClick={() => void removeMember()} disabled={isRemoving}>{isRemoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Remove member</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
