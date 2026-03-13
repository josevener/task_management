"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { getRoles, createRole, updateRole, deleteRole, type Role } from "@/lib/api/roles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Shield,
  Plus,
  ArrowLeft,
  Users,
  Settings2,
  Edit2,
  Trash2
} from "lucide-react";
import { useToast } from "@/lib/toast";

export default function RolesPage() {
  const { showToast } = useToast();
  const params = useParams();
  const router = useRouter();
  const workspaceId = parseInt(params.id as string);

  const { activeWorkspace, loading: workspaceLoading, hasPermission } = useWorkspace();

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workspaceId) {
      loadRoles();
    }
  }, [workspaceId]);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const response = await getRoles(workspaceId);
      setRoles(response.roles);
    }
    catch (error: unknown) {
      const apiError = error as { message?: string; status?: number };
      showToast(apiError.message || "Failed to load roles", "error");
      if (apiError.status === 403) {
        router.push(`/workspaces/${workspaceId}`);
      }
    }
    finally {
      setLoading(false);
    }
  };

  if (workspaceLoading || loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Roles
          </h1>
          <p className="text-slate-500 mt-1">
            Manage access rights and roles for {activeWorkspace?.name}
          </p>
        </div>
        {hasPermission('roles:create') && (
          <Button
            asChild
            className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto cursor-pointer">
            <Link href={`/workspaces/${workspaceId}/roles/new`}>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Link>
          </Button>
        )}
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto w-full">
        <div className="max-w-5xl mx-auto py-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm font-medium">
                  <th className="px-6 py-4">Role Name</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Members</th>
                  {(hasPermission('roles:edit') || hasPermission('roles:delete')) && (
                    <th className="px-6 py-4 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        {role.name}
                        {!!role.is_system_role && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-500">
                            Default
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                      {role.description || <span className="text-slate-400 italic">No description</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {role.is_system_role ? "System" : "Custom"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 flex items-center gap-1">
                      <Users className="h-4 w-4 text-slate-400" />
                      {role.default_user_count || 0}
                    </td>
                    {(hasPermission('roles:edit') || hasPermission('roles:delete')) && (
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 cursor-pointer">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {hasPermission('roles:edit') && (
                              <>
                                <Link href={`/workspaces/${workspaceId}/roles/${role.id}/permissions`}>
                                  <DropdownMenuItem className="cursor-pointer">
                                    <Settings2 className="h-4 w-4 mr-2" />
                                    Configure Permissions
                                  </DropdownMenuItem>
                                </Link>
                                <Link href={`/workspaces/${workspaceId}/roles/${role.id}/edit`}>
                                  <DropdownMenuItem className="cursor-pointer">
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Edit Details
                                  </DropdownMenuItem>
                                </Link>
                              </>
                            )}
                            {!role.is_system_role && hasPermission('roles:delete') && (
                              <>
                                {hasPermission('roles:edit') && <DropdownMenuSeparator />}
                                <Link href={`/workspaces/${workspaceId}/roles/${role.id}/delete`}>
                                  <DropdownMenuItem className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Role
                                  </DropdownMenuItem>
                                </Link>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    )}
                  </tr>
                ))}
                {roles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No roles found for this workspace.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
