"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { getProject, updateProject } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/lib/toast";
import { Loader2, ArrowLeft, FolderKanban } from "lucide-react";
import { ProjectForm } from "@/components/forms/ProjectForm";

export default function EditProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const projectId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [project, setProject] = useState<any>(null);

  useEffect(() => {
    async function fetchProjectData() {
      if (wsLoading) return;
      if (!activeWorkspace) {
        showToast("No active workspace selected", "error");
        router.push("/projects");
        return;
      }
      if (isNaN(projectId)) return;

      try {
        const res = await getProject(activeWorkspace.id, projectId);
        if (res.project) {
          setProject(res.project);
        }
      }
      catch (error) {
        showToast("Error loading project", "error");
        router.push("/projects");
      }
      finally {
        setLoading(false);
      }
    }
    fetchProjectData();
  }, [projectId, activeWorkspace, wsLoading, router, showToast]);

  const handleSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      const dataToSubmit: any = { ...data };

      // Cleanup empty dates so backend receives null
      if (!dataToSubmit.start_date) delete dataToSubmit.start_date;
      if (!dataToSubmit.end_date) delete dataToSubmit.end_date;

      await updateProject(projectId, dataToSubmit);
      showToast("Project updated successfully", "success");
      router.push("/projects");
    }
    catch (error: any) {
      showToast(error.message || "Failed to update project", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  if (loading || wsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="cursor-pointer">
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Edit Project</h1>
          <p className="text-muted-foreground">Modify your project details and tracking information.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-slate-500" />
            Project Details
          </CardTitle>
          <CardDescription>
            Update the settings and status of this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {project && (
            <ProjectForm
              initialData={{
                name: project.name,
                description: project.description || '',
                status: project.status || 'active',
                health_status: project.health_status || 'not_set',
                start_date: project.start_date ? project.start_date.split('T')[0] : '',
                end_date: project.end_date ? project.end_date.split('T')[0] : ''
              }}
              onSubmit={handleSubmit}
              onCancel={() => router.push("/projects")}
              isSubmitting={isSubmitting}
              submitLabel="Save Changes"
              isEdit={true}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
