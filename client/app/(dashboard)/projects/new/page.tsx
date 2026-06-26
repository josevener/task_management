"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { createProject } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/lib/toast";
import { ProjectForm } from "@/components/forms/ProjectForm";

export default function NewProjectPage() {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: any) => {
    if (!activeWorkspace) {
      showToast("No active workspace selected.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await createProject({
        workspace_id: activeWorkspace.id,
        name: data.name,
        description: data.description,
        status: data.status,
        start_date: data.start_date || undefined,
        end_date: data.end_date || undefined
      });

      showToast("Project created successfully!", "success");
      router.push("/projects");
    }
    catch (error: any) {
      showToast(error.message || "Failed to create project", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <h2 className="text-2xl font-bold">No Workspace Selected</h2>
        <p className="text-muted-foreground max-w-md">
          Please select a workspace first to create a project within it.
        </p>
        <Button asChild>
          <Link href="/workspaces">Go to Workspaces</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Projects</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create Project</h1>
          <p className="text-muted-foreground mt-1">
            Add a new project to <span className="font-semibold">{activeWorkspace.name}</span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>
            Set up the core information for your new project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm
            onSubmit={handleSubmit}
            onCancel={() => router.push("/projects")}
            isSubmitting={isSubmitting}
            submitLabel="Create Project"
          />
        </CardContent>
      </Card>
    </div>
  );
}
