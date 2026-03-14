"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { apiGet } from "@/lib/api-client";
import { getWorkspaceMembers, removeWorkspaceMember, WorkspaceMember } from "@/lib/api/members";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Plus, Loader2, Users, Edit2 } from "lucide-react";
import Link from "next/link";

export default function WorkspaceMembersPage() {
  const { id } = useParams();
  const router = useRouter();
  const { activeWorkspace, loading: wsLoading, hasPermission } = useWorkspace();
  const { showToast } = useToast();

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<number | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (!wsLoading && activeWorkspace && activeWorkspace.id.toString() !== id) {
      router.push(`/workspaces/${activeWorkspace.id}/members`);
      return;
    }
  }, [activeWorkspace, id, router, wsLoading]);

  const fetchMembers = async () => {
    if (!id) return;
    try {
      setIsRefreshing(true);
      const [membersRes, rolesRes] = await Promise.all([
        getWorkspaceMembers(Number(id)),
        apiGet<any>(`/workspaces/${id}/roles`)
      ]);
      setMembers(membersRes.members);
      setRoles(rolesRes.roles || []);
    }
    catch (err: any) {
      showToast(err.message || "Failed to load members", "error");
    }
    finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [id]);

  useEffect(() => {
    fetchMembers();
  }, [id]);

  const handleRemoveMemberConfirm = async () => {
    if (!memberToRemove) return;

    try {
      setIsRemoving(true);
      await removeWorkspaceMember(memberToRemove);
      showToast("Member removed", "success");
      setMembers(prev => prev.filter(m => m.membership_id !== memberToRemove));
      setMemberToRemove(null);
    }
    catch (err: any) {
      showToast(err.message || "Failed to remove member", "error");
    }
    finally {
      setIsRemoving(false);
    }
  };

  if (isLoading || wsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-slate-700" />
            Workspace Members
          </h1>
          <p className="text-slate-500 mt-1">Manage who has access to {activeWorkspace?.name}</p>
        </div>
        {hasPermission('members:invite') && (
          <Button
            asChild
            className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto cursor-pointer">
            <Link href={`/workspaces/${id}/members/new`}>
              <Plus className="h-4 w-4 mr-2" /> Add Member
            </Link>
          </Button>
        )}
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Team Roster</CardTitle>
          <CardDescription>All members who have access to this workspace and its projects.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-md border">
            {members.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No members found.</div>
            ) : (
              members.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 border border-slate-200">
                      <AvatarFallback className="bg-slate-100 text-slate-700">
                        {member.first_name ? member.first_name[0] : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-slate-900">{member.first_name} {member.last_name}</p>
                      <p className="text-sm text-slate-500">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={member.role?.toLowerCase() === 'admin' ? 'default' : 'outline'} className="capitalize">
                      {member.role || 'Member'}
                    </Badge>
                    {hasPermission('members:manage_roles') && member.membership_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 h-8 w-8 cursor-pointer"
                        title="Edit Member"
                        asChild
                      >
                        <Link href={`/workspaces/${id}/members/${member.membership_id}/edit`}>
                          <Edit2 className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    {hasPermission('members:remove') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 cursor-pointer"
                        onClick={() => member.membership_id && setMemberToRemove(member.membership_id)}
                        title="Remove Member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={memberToRemove !== null} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this member from the workspace? They will lose access to all projects and tasks within this workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setMemberToRemove(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              onClick={handleRemoveMemberConfirm}
              disabled={isRemoving}
            >
              {isRemoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
