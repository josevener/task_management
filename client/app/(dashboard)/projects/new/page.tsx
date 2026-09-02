"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { createProject } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, FolderPlus } from "lucide-react";
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
    <div className="mx-auto w-full max-w-4xl space-y-5 pb-12">
      <section className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-sky-50 px-5 py-6 shadow-sm sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-indigo-200/45 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <Button variant="outline" size="icon" asChild className="mt-0.5 shrink-0 border-indigo-200 bg-white/80 cursor-pointer">
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Projects</span>
          </Link>
        </Button>
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-700"><FolderPlus className="h-4 w-4" />New project</div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Create a project</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">Set the project’s scope, timeline, and current state for <span className="font-medium text-slate-800">{activeWorkspace.name}</span>.</p>
        </div>
        </div>
      </section>

      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5 sm:p-7">
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
