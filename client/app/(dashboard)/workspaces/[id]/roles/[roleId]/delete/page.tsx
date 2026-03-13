"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getRoles, deleteRole, type Role } from "@/lib/api/roles";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useToast } from "@/lib/toast";

export default function DeleteRolePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = parseInt(params.id as string);
  const roleId = parseInt(params.roleId as string);
  
  const { showToast } = useToast();
  
  const [role, setRole] = useState<Role | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fallbackRoleId, setFallbackRoleId] = useState<number | "">("");

  useEffect(() => {
    if (workspaceId && roleId) {
      loadData();
    }
  }, [workspaceId, roleId]);

  const loadData = async () => {
    try {
      const resp = await getRoles(workspaceId);
      setRoles(resp.roles);
      const found = resp.roles.find(r => r.id === roleId);
      if (!found) {
        showToast("Role not found", "error");
        router.push(`/workspaces/${workspaceId}/roles`);
        return;
      }
      if (found.is_system_role) {
        showToast("System roles cannot be deleted", "error");
        router.push(`/workspaces/${workspaceId}/roles`);
        return;
      }
      setRole(found);
    } catch (error: unknown) {
      const apiError = error as { message?: string };
      showToast(apiError.message || "Failed to load roles", "error");
      router.push(`/workspaces/${workspaceId}/roles`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    
    setSubmitting(true);
    try {
      await deleteRole(workspaceId, role.id, fallbackRoleId ? Number(fallbackRoleId) : undefined);
      showToast("Role deleted successfully", "success");
      router.push(`/workspaces/${workspaceId}/roles`);
    } catch (error: unknown) {
      const apiError = error as { message?: string };
      showToast(apiError.message || "Failed to delete role", "error");
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
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Role
            </h1>
            <p className="text-sm text-slate-500">
              Permanently remove {role?.name} from the workspace
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto w-full p-6">
        <div className="max-w-2xl mx-auto bg-white border border-red-200 rounded-xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-red-600">Are you sure you want to delete the role &quot;{role?.name}&quot;?</h2>
              <p className="text-sm text-slate-600">
                This action cannot be undone. All users with this role will lose their current permissions unless assigned to a new role.
              </p>
            </div>
            
            {(role?.default_user_count || 0) > 0 && (
               <div className="space-y-4">
                 <div className="p-4 bg-amber-50 text-amber-800 rounded-md border border-amber-200 text-sm">
                   <strong>Warning:</strong> There are {role?.default_user_count} members currently assigned to this role. You must select a fallback role to reassign them to before deleting.
                 </div>
                 <div className="space-y-2">
                   <label htmlFor="fallback" className="text-sm font-medium">Fallback Role</label>
                   <select 
                      id="fallback" 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={fallbackRoleId}
                      onChange={(e) => setFallbackRoleId(Number(e.target.value))}
                      required
                   >
                     <option value="" disabled>Select a fallback role...</option>
                     {roles.filter(r => r.id !== role?.id).map(r => (
                       <option key={r.id} value={r.id}>{r.name}</option>
                     ))}
                   </select>
                 </div>
               </div>
            )}
            
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <Link href={`/workspaces/${workspaceId}/roles`}>
                <Button type="button" variant="outline" disabled={submitting}>Cancel</Button>
              </Link>
              <Button 
                type="submit" 
                variant="destructive"
                disabled={submitting || ((role?.default_user_count || 0) > 0 && !fallbackRoleId)}
              >
                {submitting ? "Deleting..." : "Delete Role"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
