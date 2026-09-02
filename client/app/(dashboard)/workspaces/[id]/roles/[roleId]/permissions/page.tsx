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
  const workspaceId = params.id as string;
  const roleId = params.roleId as string;

  const { loading: workspaceLoading } = useWorkspace();

  const [role, setRole] = useState<Role | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [assignedPermissionIds, setAssignedPermissionIds] = useState<Set<string>>(new Set());
  const [initialPermissionIds, setInitialPermissionIds] = useState<Set<string>>(new Set());

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
      setInitialPermissionIds(new Set(idSet));

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

  const handleTogglePermission = (permissionId: string) => {
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

  const selectedPermissionCount = assignedPermissionIds.size;
  const isSystemRole = role?.is_system_role ?? false;
  const sensitivePermissionChanged = allPermissions.some((permission) => {
    const isSensitive = permission.action.startsWith("roles:") || ["members:manage_roles", "members:remove", "workspaces:delete", "organizations:edit"].includes(permission.action);
    return isSensitive && assignedPermissionIds.has(permission.id) !== initialPermissionIds.has(permission.id);
  });

  const formatPermissionAction = (action: string) => {
    const [, actionName = action] = action.split(":");
    return actionName.replaceAll("_", " ");
  };

  if (workspaceLoading || loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-slate-200 bg-white px-1 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/workspaces/${workspaceId}/roles`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full cursor-pointer">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Roles / Permissions</p>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              {role?.name === 'Admin' ? <ShieldAlert className="h-5 w-5 text-amber-500" /> : <ShieldCheck className="h-5 w-5 text-blue-500" />}
              {role?.name} Permissions
            </h1>
            <p className="text-sm text-slate-500">
              Check boxes to grant {role?.name} access to modules and actions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right sm:block">
            <p className="text-xs text-slate-500">Enabled permissions</p>
            <p className="text-sm font-semibold text-slate-900">{selectedPermissionCount} of {allPermissions.length}</p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || role?.name === 'Admin'}
            className="min-w-[132px] cursor-pointer bg-blue-600 text-white hover:bg-blue-700"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </header>

      {/* Content Matrix */}
      <main className="w-full flex-1 overflow-y-auto pb-6">
        <div className="w-full space-y-5">
          <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Permission matrix</p>
              <p className="mt-1 text-sm text-slate-500">Select the actions this role can perform in each area of the workspace.</p>
            </div>
            <div className="flex items-center sm:justify-end">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isSystemRole ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>
                {isSystemRole ? "System role" : "Custom role"}
              </span>
            </div>
          </section>

          {role?.name === 'Admin' && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold">Admin permissions are protected</h3>
                <p className="text-sm mt-1 opacity-90">
                  This role keeps its full access to prevent an administrator lockout. Create a custom role when you need a tailored permission set.
                </p>
              </div>
            </div>
          )}

          {sensitivePermissionChanged && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">This change affects sensitive access</p>
              <p className="mt-1 leading-6">Review role management, member administration, workspace deletion, and organization settings permissions before saving.</p>
            </div>
          )}

          <div className="grid w-full gap-3">
            {Object.entries(groupedPermissions).map(([moduleName, modulePerms]) => {
              // Determine if all perms in this module are checked
              const allChecked = modulePerms.every(p => assignedPermissionIds.has(p.id));
              const someChecked = modulePerms.some(p => assignedPermissionIds.has(p.id)) && !allChecked;
              const selectedInModule = modulePerms.filter(p => assignedPermissionIds.has(p.id)).length;

              return (
                <div key={moduleName} className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  {/* Module Header */}
                  <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <Checkbox
                      id={`module-${moduleName}`}
                      checked={allChecked ? true : (someChecked ? "indeterminate" : false)}
                      onCheckedChange={(checked) => handleToggleModule(moduleName, checked === true)}
                      disabled={role?.name === 'Admin'}
                    />
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={`module-${moduleName}`}
                        className="mb-0 cursor-pointer select-none font-bold capitalize text-slate-800"
                      >
                        {moduleName} module
                      </label>
                      <p className="mt-0.5 text-xs text-slate-500">{selectedInModule} of {modulePerms.length} permissions enabled</p>
                    </div>
                  </div>

                  {/* Module Permissions Grid */}
                  <div className="grid gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2">
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
                            className="cursor-pointer select-none text-sm font-medium capitalize text-slate-700"
                          >
                            {formatPermissionAction(perm.action)}
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
