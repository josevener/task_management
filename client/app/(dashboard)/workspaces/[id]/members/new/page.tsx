"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { addWorkspaceMember } from "@/lib/api/members";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, UserPlus } from "lucide-react";

export default function AddWorkspaceMemberPage() {
  const { id } = useParams();
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [isAdding, setIsAdding] = useState(false);

  // Invite Existing User Form State
  const [addForm, setAddForm] = useState({ email: "", role: "member" });

  // Create New User Form State
  const [createForm, setCreateForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "member"
  });

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
      router.push(`/workspaces/${id}/members`);
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
      router.push(`/workspaces/${id}/members`);
    }
    catch (err: any) {
      showToast(err.message || "Failed to create member", "error");
    }
    finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 flex flex-col w-full">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="cursor-pointer">
          <Link href={`/workspaces/${id}/members`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Add Workspace Member</h1>
          <p className="text-muted-foreground">Invite users to collaborate in {activeWorkspace?.name || 'this workspace'}.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            New Member Details
          </CardTitle>
          <CardDescription>
            Invite someone who already has an account, or create a brand new user profile for them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="invite" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="invite" className="cursor-pointer">Invite Existing User</TabsTrigger>
              <TabsTrigger value="create" className="cursor-pointer">Create New User</TabsTrigger>
            </TabsList>

            <TabsContent value="invite" className="mt-4 border rounded-md p-6 bg-white">
              <form onSubmit={handleAddMember}>
                <div className="grid gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-sm font-medium">User Email Address <span className="text-red-500">*</span></Label>
                    <Input
                      id="email"
                      type="email"
                      value={addForm.email}
                      onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                      placeholder="e.g. jane@example.com"
                      required
                      className="bg-white"
                    />
                    <p className="text-xs text-slate-500">The user must have already registered an account using this email.</p>
                  </div>
                  <div className="space-y-3">
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
                    className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
                    disabled={isAdding}
                  >
                    {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Invite Member
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="create" className="mt-4 border rounded-md p-6 bg-white">
              <form onSubmit={handleCreateMember}>
                <div className="grid gap-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="first_name" className="text-sm font-medium">First Name <span className="text-red-500">*</span></Label>
                      <Input
                        id="first_name"
                        value={createForm.first_name}
                        onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                        placeholder="John"
                        required
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="last_name" className="text-sm font-medium">Last Name <span className="text-red-500">*</span></Label>
                      <Input
                        id="last_name"
                        value={createForm.last_name}
                        onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                        placeholder="Doe"
                        required
                        className="bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="create_email" className="text-sm font-medium">Email Address <span className="text-red-500">*</span></Label>
                    <Input
                      id="create_email"
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      placeholder="john.doe@example.com"
                      required
                      className="bg-white"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="create_password" className="text-sm font-medium">Temporary Password <span className="text-red-500">*</span></Label>
                    <Input
                      id="create_password"
                      type="password"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      placeholder="Minimum 8 characters"
                      required
                      minLength={8}
                      className="bg-white"
                    />
                  </div>

                  <div className="space-y-3">
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
                    className="bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                    disabled={isAdding}
                  >
                    {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create & Add Member
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
