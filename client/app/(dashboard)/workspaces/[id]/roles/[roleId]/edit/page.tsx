"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getRoles, updateRole, type Role } from "@/lib/api/roles";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/lib/toast";
import { RoleForm } from "@/components/forms/RoleForm";

export default function EditRolePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const roleId = params.roleId as string;

  const { showToast } = useToast();

  const [role, setRole] = useState<Role | null>(null);
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
    }
    catch (error: unknown) {
      const apiError = error as { message?: string };
      showToast(apiError.message || "Failed to load role", "error");
      router.push(`/workspaces/${workspaceId}/roles`);
    }
    finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: { name: string; description: string }) => {
    if (!role) return;

    setSubmitting(true);
    try {
      await updateRole(workspaceId, role.id, {
        name: data.name,
        description: data.description
      });
      showToast("Role updated successfully", "success");
      router.push(`/workspaces/${workspaceId}/roles`);
    }
    catch (error: unknown) {
      const apiError = error as { message?: string; errors?: { name?: string } };
      showToast(apiError.message || apiError.errors?.name || "Failed to update role", "error");
    }
    finally {
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
      <div className="flex items-center gap-4">
        <Link href={`/workspaces/${workspaceId}/roles`}>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Edit Role
          </h1>
          <p className="text-sm text-slate-500">
            Update details for {role?.name}
          </p>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto w-full p-6">
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          {role && (
            <RoleForm
              initialData={{
                name: role.name,
                description: role.description || "",
                is_system_role: role.is_system_role
              }}
              onSubmit={handleSubmit}
              onCancel={() => router.push(`/workspaces/${workspaceId}/roles`)}
              isSubmitting={submitting}
              submitLabel="Save Changes"
            />
          )}
        </div>
      </main>
    </div>
  );
}
