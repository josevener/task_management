"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { getProject, updateProject } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/lib/toast";
import { Loader2, ArrowLeft, Pencil } from "lucide-react";
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
      } catch (error) {
        showToast("Error loading project", "error");
        router.push("/projects");
      } finally {
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
    } catch (error: any) {
      showToast(error.message || "Failed to update project", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || wsLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 pb-12">
      <section className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-sky-50 px-5 py-6 shadow-sm sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-indigo-200/45 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <Button
            variant="outline"
            size="icon"
            asChild
            className="mt-0.5 shrink-0 border-indigo-200 bg-white/80 cursor-pointer"
          >
            <Link href="/projects" aria-label="Back to projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-700">
              <Pencil className="h-4 w-4" />
              Edit project
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {project?.name || "Edit project"}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              Update the project’s details, timeline, status, and health
              information.
            </p>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5 sm:p-7">
          {project && (
            <ProjectForm
              initialData={{
                name: project.name,
                description: project.description || "",
                status: project.status || "active",
                health_status: project.health_status || "not_set",
                start_date: project.start_date
                  ? project.start_date.split("T")[0]
                  : "",
                end_date: project.end_date
                  ? project.end_date.split("T")[0]
                  : "",
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
