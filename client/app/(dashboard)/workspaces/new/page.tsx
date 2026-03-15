"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { createWorkspace } from "@/lib/api/workspaces";
import { apiGet } from "@/lib/api-client";
import type { Organization } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/lib/toast";
import { WorkspaceForm } from "@/components/forms/WorkspaceForm";

export default function NewWorkspacePage() {
  const router = useRouter();
  const { switchWorkspace, refreshWorkspaces } = useWorkspace();
  const { showToast } = useToast();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const res = await apiGet<{ organizations: Organization[] }>("/organizations");
        setOrganizations(res.organizations || []);
      }
      catch (error) {
        showToast("Failed to load organizations. Please try again.", "error");
      }
      finally {
        setLoadingOrgs(false);
      }
    }

    fetchOrganizations();
  }, [showToast]);

  const handleSubmit = async (data: { name: string; description: string; organization_id: string; color_theme: string }) => {
    try {
      setIsSubmitting(true);
      const response = await createWorkspace({
        name: data.name,
        description: data.description,
        organization_id: parseInt(data.organization_id),
        color_theme: data.color_theme,
      });

      if (response.workspace) {
        await refreshWorkspaces(response.workspace.id);
        showToast("Workspace created successfully!", "success");
        router.push("/dashboard");
      }
      else {
        await refreshWorkspaces();
        showToast("Workspace created successfully!", "success");
        router.push("/workspaces");
      }
    }
    catch (error: any) {
      showToast(error.message || "Failed to create workspace", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workspaces">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Workspaces</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create Workspace</h1>
          <p className="text-muted-foreground">
            Set up a new workspace for your team or project.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace Details</CardTitle>
          <CardDescription>
            Provide the basic information for your new workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingOrgs ? (
            <div className="h-20 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : organizations.length === 0 ? (
            <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
              <p className="text-sm text-amber-800">
                You need to belong to an organization before creating a workspace.
                Please ask your admin to invite you or create an organization first.
              </p>
            </div>
          ) : (
            <WorkspaceForm
              organizations={organizations}
              onSubmit={handleSubmit}
              onCancel={() => router.push("/workspaces")}
              isSubmitting={isSubmitting}
              submitLabel="Create Workspace"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
