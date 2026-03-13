"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getRoles, updateRole, type Role } from "@/lib/api/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Edit2 } from "lucide-react";
import { useToast } from "@/lib/toast";

export default function EditRolePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = parseInt(params.id as string);
  const roleId = parseInt(params.roleId as string);
  
  const { showToast } = useToast();
  
  const [role, setRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (workspaceId && roleId) {
      loadRole();
    }
  }, [workspaceId, roleId]);

  const loadRole = async () => {
    try {
      const resp = await getRoles(workspaceId);
      const found = resp.roles.find(r => r.id === roleId);
      if (!found) {
        showToast("Role not found", "error");
        router.push(`/workspaces/${workspaceId}/roles`);
        return;
      }
      setRole(found);
      setFormData({ name: found.name, description: found.description || "" });
    } catch (error: unknown) {
      const apiError = error as { message?: string };
      showToast(apiError.message || "Failed to load role", "error");
      router.push(`/workspaces/${workspaceId}/roles`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !role) return;
    
    setSubmitting(true);
    try {
      await updateRole(workspaceId, role.id, {
        name: formData.name,
        description: formData.description
      });
      showToast("Role updated successfully", "success");
      router.push(`/workspaces/${workspaceId}/roles`);
    } catch (error: unknown) {
      const apiError = error as { message?: string; errors?: { name?: string } };
      showToast(apiError.message || apiError.errors?.name || "Failed to update role", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
     return (
       <div className="flex h-full items-center justify-center bg-slate-50">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
       </div>
     );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <header className="flex-none bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-4 max-w-2xl mx-auto">
          <Link href={`/workspaces/${workspaceId}/roles`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-blue-500" />
              Edit Role
            </h1>
            <p className="text-sm text-slate-500">
              Update details for {role?.name}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto w-full p-6">
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Role Name</label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={role?.is_system_role}
                required
              />
              {role?.is_system_role && (
                <p className="text-xs text-slate-500">System roles cannot be renamed.</p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">Description</label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>
            
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <Link href={`/workspaces/${workspaceId}/roles`}>
                <Button type="button" variant="outline" disabled={submitting}>Cancel</Button>
              </Link>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!formData.name.trim() || submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
