"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { createRole } from "@/lib/api/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus } from "lucide-react";
import { useToast } from "@/lib/toast";

export default function CreateRolePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = parseInt(params.id as string);

  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({ name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      await createRole(workspaceId, {
        name: formData.name,
        description: formData.description
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
        <div className="max-w-7xl mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Role Name</label>
              <Input
                id="name"
                placeholder="e.g. QA Tester, Guest Viewer"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">Description (Optional)</label>
              <Textarea
                id="description"
                placeholder="What can people with this role do?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <Link href={`/workspaces/${workspaceId}/roles`}>
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                disabled={!formData.name.trim() || submitting}
              >
                {submitting ? "Creating..." : "Create Role"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
