"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { getRoles, getRolePermissions, getAllPermissions, updateRolePermissions, type Role, type Permission } from "@/lib/api/roles";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ShieldCheck, ShieldAlert, Save, Loader2 } from "lucide-react";
import { useToast } from "@/lib/toast";

export default function RolePermissionsPage() {
  const { showToast } = useToast();

  const params = useParams();
  const router = useRouter();
  const workspaceId = parseInt(params.id as string);
  const roleId = parseInt(params.roleId as string);

  const { loading: workspaceLoading } = useWorkspace();

  const [role, setRole] = useState<Role | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [assignedPermissionIds, setAssignedPermissionIds] = useState<Set<number>>(new Set());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workspaceId && roleId) {
      loadData();
    }
  }, [workspaceId, roleId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load the specific role info to get its name/status
      const rolesRes = await getRoles(workspaceId);
      const foundRole = rolesRes.roles.find(r => r.id === roleId);
      if (!foundRole) {
        showToast("Role not found", "error");
        router.push(`/workspaces/${workspaceId}/roles`);
        return;
      }
      setRole(foundRole);

      // 2. Load all available permissions in the system
      const systemPermsRes = await getAllPermissions();
      setAllPermissions(systemPermsRes.permissions);

      // 3. Load currently assigned permissions for this role
      const rolePermsRes = await getRolePermissions(workspaceId, roleId);
      const idSet = new Set(rolePermsRes.permissions.map(p => p.id));
      setAssignedPermissionIds(idSet);

    }
    catch (error: unknown) {
      const apiError = error as { message?: string; status?: number };
      showToast(apiError.message || "Failed to load permissions", "error");
      if (apiError.status === 403) {
        router.push(`/workspaces/${workspaceId}`);
      }
    }
    finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (permissionId: number) => {
    if (role?.name === 'Admin') return; // Admin permissions can't be toggled usually, enforcing here too

    const newSet = new Set(assignedPermissionIds);
    if (newSet.has(permissionId)) {
      newSet.delete(permissionId);
    }
    else {
      newSet.add(permissionId);
    }
    setAssignedPermissionIds(newSet);
  };

  const handleToggleModule = (moduleName: string, isChecked: boolean) => {
    if (role?.name === 'Admin') return;

    const modulePermIds = allPermissions.filter(p => p.module === moduleName).map(p => p.id);
    const newSet = new Set(assignedPermissionIds);

    modulePermIds.forEach(id => {
      if (isChecked) {
        newSet.add(id);
      }
      else {
        newSet.delete(id);
      }
    });

    setAssignedPermissionIds(newSet);
  };

  const handleSave = async () => {
    if (role?.name === 'Admin' && assignedPermissionIds.size === 0) {
      showToast("Cannot remove all permissions from Admin role", "error");
      return;
    }

    setSaving(true);
    try {
      await updateRolePermissions(workspaceId, roleId, Array.from(assignedPermissionIds));
      showToast("Permissions saved successfully", "success");
      router.push(`/workspaces/${workspaceId}/roles`);
    }
    catch (error: unknown) {
      const apiError = error as { message?: string };
      showToast(apiError.message || "Failed to save permissions", "error");
    }
    finally {
      setSaving(false);
    }
  };

  // Group permissions by module for UI display
  const groupedPermissions = allPermissions.reduce((acc, curr) => {
    if (!acc[curr.module]) {
      acc[curr.module] = [];
    }
    acc[curr.module].push(curr);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (workspaceLoading || loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/workspaces/${workspaceId}/roles`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full cursor-pointer">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              {role?.name === 'Admin' ? <ShieldAlert className="h-5 w-5 text-amber-500" /> : <ShieldCheck className="h-5 w-5 text-blue-500" />}
              {role?.name} Permissions
            </h1>
            <p className="text-sm text-slate-500">
              Check boxes to grant {role?.name} access to modules and actions.
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || role?.name === 'Admin'}
          className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px] cursor-pointer"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Matrix
        </Button>
      </div>

      {/* Content Matrix */}
      <main className="flex-1 overflow-y-auto w-full py-6">
        <div className="w-full space-y-6">
          {role?.name === 'Admin' && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Admin Role is Immutable</h3>
                <p className="text-sm mt-1 opacity-90">
                  The primary Admin role permissions cannot be completely removed to prevent lockout.
                  It is recommended to create a new custom role instead of modifying core system roles.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-2 w-full max-h-[calc(100vh-200px)] overflow-y-auto">
            {Object.entries(groupedPermissions).map(([moduleName, modulePerms]) => {
              // Determine if all perms in this module are checked
              const allChecked = modulePerms.every(p => assignedPermissionIds.has(p.id));
              const someChecked = modulePerms.some(p => assignedPermissionIds.has(p.id)) && !allChecked;

              return (
                <div key={moduleName} className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  {/* Module Header */}
                  <div className="bg-slate-50 px-6 py-4 flex items-center gap-3 border-b border-slate-200">
                    <Checkbox
                      id={`module-${moduleName}`}
                      checked={allChecked ? true : (someChecked ? "indeterminate" : false)}
                      onCheckedChange={(checked) => handleToggleModule(moduleName, checked === true)}
                      disabled={role?.name === 'Admin'}
                    />
                    <label
                      htmlFor={`module-${moduleName}`}
                      className="font-bold text-slate-800 capitalize cursor-pointer mb-0 select-none"
                    >
                      {moduleName} Module
                    </label>
                  </div>

                  {/* Module Permissions Grid */}
                  <div className="px-6 py-4 grid sm:grid-cols-2 gap-4">
                    {modulePerms.map((perm) => (
                      <div key={perm.id} className="flex items-start gap-3">
                        <Checkbox
                          id={`perm-${perm.id}`}
                          checked={assignedPermissionIds.has(perm.id)}
                          onCheckedChange={() => handleTogglePermission(perm.id)}
                          disabled={role?.name === 'Admin'}
                          className="mt-1"
                        />
                        <div className="grid gap-1">
                          <label
                            htmlFor={`perm-${perm.id}`}
                            className="text-sm font-medium text-slate-700 cursor-pointer select-none"
                          >
                            {perm.action.split(':')[1].replace('_', ' ')}
                          </label>
                          <p className="text-xs text-slate-500">
                            {perm.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
