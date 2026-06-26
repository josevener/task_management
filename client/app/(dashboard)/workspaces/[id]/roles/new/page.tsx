"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { createRole } from "@/lib/api/roles";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/lib/toast";
import { RoleForm } from "@/components/forms/RoleForm";

export default function CreateRolePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = parseInt(params.id as string);

  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (data: { name: string; description: string }) => {
    setSubmitting(true);
    try {
      await createRole(workspaceId, {
        name: data.name,
        description: data.description
      });

      showToast("Role created successfully", "success");
      router.push(`/workspaces/${workspaceId}/roles`);
    }
    catch (error: unknown) {
      const apiError = error as { message?: string; errors?: { name?: string } };
      showToast(apiError.message || apiError.errors?.name || "Failed to create role", "error");
    }
    finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="flex items-center gap-4">
        <Link href={`/workspaces/${workspaceId}/roles`}>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Role
          </h1>
          <p className="text-sm text-slate-500">
            Create new role for {activeWorkspace?.name || 'the workspace'}
          </p>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto w-full py-6">
        <div className="w-full bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <RoleForm 
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/workspaces/${workspaceId}/roles`)}
            isSubmitting={submitting}
            submitLabel="Create Role"
          />
        </div>
      </main>
    </div>
  );
}
