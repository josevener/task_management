"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { getWorkspaceMembers, addWorkspaceMember, removeWorkspaceMember, WorkspaceMember } from "@/lib/api/members";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Loader2, Users, UserPlus } from "lucide-react";

export default function WorkspaceMembersPage() {
  const { id } = useParams();
  const router = useRouter();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const { showToast } = useToast();

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add Member State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", role: "member" });

  // Create Member State
  const [createForm, setCreateForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "member"
  });

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
      const res = await getWorkspaceMembers(Number(id));
      setMembers(res.members);
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

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.email.trim()) {
      showToast("Email is required", "error");
      return;
    }

    try {
      setIsAdding(true);
      await addWorkspaceMember(Number(id), addForm.email, addForm.role, 'invite');
      showToast("Member invited successfully", "success");
      setIsAddOpen(false);
      setAddForm({ email: "", role: "member" });
      fetchMembers(); // refresh list
    }
    catch (err: any) {
      showToast(err.message || "Failed to invite member", "error");
    }
    finally {
      setIsAdding(false);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.email.trim() || !createForm.first_name.trim() || !createForm.last_name.trim() || !createForm.password.trim()) {
      showToast("All fields are required to create a new user", "error");
      return;
    }
    if (createForm.password.length < 8) {
      showToast("Password must be at least 8 characters", "error");
      return;
    }

    try {
      setIsAdding(true);
      await addWorkspaceMember(
        Number(id),
        createForm.email,
        createForm.role,
        'create',
        {
          first_name: createForm.first_name,
          last_name: createForm.last_name,
          password: createForm.password
        }
      );
      showToast("New user created and added to workspace!", "success");
      setIsAddOpen(false);
      setCreateForm({ first_name: "", last_name: "", email: "", password: "", role: "member" });
      fetchMembers(); // refresh list
    }
    catch (err: any) {
      showToast(err.message || "Failed to create member", "error");
    }
    finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (membershipId: number) => {
    if (!confirm("Are you sure you want to remove this member from the workspace?")) return;

    try {
      await removeWorkspaceMember(membershipId);
      showToast("Member removed", "success");
      setMembers(prev => prev.filter(m => m.membership_id !== membershipId));
    }
    catch (err: any) {
      showToast(err.message || "Failed to remove member", "error");
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
        <Button
          onClick={() => setIsAddOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto cursor-pointer">
          <Plus className="h-4 w-4 mr-2" /> Add Member
        </Button>
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
                    <Badge variant={member.role === 'admin' ? 'default' : member.role === 'manager' ? 'secondary' : 'outline'} className="capitalize">
                      {member.role}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 cursor-pointer"
                      onClick={() => member.membership_id && handleRemoveMember(member.membership_id)}
                      title="Remove Member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add/Create Member Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Add Workspace Member
            </DialogTitle>
            <DialogDescription>
              Invite someone who already has an account, or create a brand new user profile for them.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="invite" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="invite" className="cursor-pointer">Invite Existing</TabsTrigger>
              <TabsTrigger value="create" className="cursor-pointer">Create New</TabsTrigger>
            </TabsList>

            <TabsContent value="invite" className="mt-4 border rounded-md p-4">
              <form onSubmit={handleAddMember}>
                <div className="grid gap-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">User Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={addForm.email}
                      onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                      placeholder="e.g. jane@example.com"
                      required
                    />
                    <p className="text-xs text-slate-500">The user must have already registered an account using this email.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-sm font-medium">Workspace Role</Label>
                    <Select value={addForm.role} onValueChange={(val) => setAddForm({ ...addForm, role: val })}>
                      <SelectTrigger id="role" className="bg-white">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="guest">Guest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    className="cursor-pointer"
                    onClick={() => setIsAddOpen(false)}
                    disabled={isAdding}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
                    disabled={isAdding}
                  >
                    {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Invite Member
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="create" className="mt-4 border rounded-md p-4">
              <form onSubmit={handleCreateMember}>
                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name" className="text-sm font-medium">First Name</Label>
                      <Input
                        id="first_name"
                        value={createForm.first_name}
                        onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                        placeholder="John"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name" className="text-sm font-medium">Last Name</Label>
                      <Input
                        id="last_name"
                        value={createForm.last_name}
                        onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                        placeholder="Doe"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create_email" className="text-sm font-medium">Email Address</Label>
                    <Input
                      id="create_email"
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      placeholder="john.doe@example.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create_password" className="text-sm font-medium">Temporary Password</Label>
                    <Input
                      id="create_password"
                      type="password"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      placeholder="Minimum 8 characters"
                      required
                      minLength={8}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create_role" className="text-sm font-medium">Workspace Role</Label>
                    <Select value={createForm.role} onValueChange={(val) => setCreateForm({ ...createForm, role: val })}>
                      <SelectTrigger id="create_role" className="bg-white">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="guest">Guest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    className="cursor-pointer"
                    onClick={() => setIsAddOpen(false)}
                    disabled={isAdding}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                    disabled={isAdding}
                  >
                    {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create & Add
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
