"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { updateWorkspace } from "@/lib/api/workspaces";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/lib/toast";
import { Loader2, ArrowLeft, Briefcase } from "lucide-react";
import { WorkspaceForm } from "@/components/forms/WorkspaceForm";

export default function EditWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { workspaces, refreshWorkspaces, loading } = useWorkspace();
  const workspaceId = params.id as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workspace, setWorkspace] = useState<any>(null);

  useEffect(() => {
    if (!loading && workspaces.length > 0) {
      const found = workspaces.find(w => w.id === workspaceId);
      if (found) {
        setWorkspace(found);
      }
      else {
        showToast("Workspace not found", "error");
        router.push("/workspaces");
      }
    }
  }, [loading, workspaces, workspaceId, router, showToast]);

  const handleSubmit = async (data: { name: string; description: string; organization_id: string; color_theme: string }) => {
    try {
      setIsSubmitting(true);
      await updateWorkspace(workspaceId, data);
      showToast("Workspace updated successfully", "success");
      await refreshWorkspaces();
      router.push("/workspaces");
    }
    catch (error: any) {
      showToast(error.message || "Failed to update workspace", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !workspace) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="cursor-pointer">
          <Link href="/workspaces">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Edit Workspace</h1>
          <p className="text-muted-foreground">Update the details for this workspace.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-slate-500" />
            Workspace Settings
          </CardTitle>
          <CardDescription>
            Modify your workspace name, description, and theme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceForm
            initialData={{
              name: workspace.name,
              description: workspace.description || '',
              organization_id: String(workspace.organization_id),
              color_theme: workspace.color_theme || '#0f766e'
            }}
            onSubmit={handleSubmit}
            onCancel={() => router.push("/workspaces")}
            isSubmitting={isSubmitting}
            submitLabel="Save Changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
