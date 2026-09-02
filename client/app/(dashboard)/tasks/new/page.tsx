"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createTask } from "@/lib/api/tasks";
import { getAllProjects } from "@/lib/api/projects";
import { getProjectEligibleMembers, ProjectMember } from "@/lib/api/members";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/lib/toast";
import { ArrowLeft, ClipboardPlus, Loader2 } from "lucide-react";
import { TaskForm, TaskFormData } from "@/components/forms/TaskForm";
import { Project } from "@/lib/types";

export default function GlobalCreateTaskPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await getAllProjects();
        setProjects(res.projects || []);
      } catch (error) {
        console.log("Failed to fetch projects", error);
        showToast("Failed to load projects", "error");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProjects();
  }, [showToast]);

  const handleProjectChange = async (projectId: string) => {
    const id = Number(projectId);
    if (isNaN(id)) {
      setMembers([]);
      setSelectedProjectId(null);
      return;
    }

    setSelectedProjectId(id);
    try {
      const res = await getProjectEligibleMembers(id);
      setMembers(res.members || []);
    } catch (error) {
      console.log("Failed to fetch eligible members", error);
      showToast("Failed to load project members", "error");
      setMembers([]);
    }
  };

  const handleSubmit = async (data: TaskFormData) => {
    const projectId = Number(data.project_id);
    if (isNaN(projectId)) {
      showToast("Please select a project", "error");
      return;
    }

    try {
      setIsSubmitting(true);

      await createTask({
        project_id: projectId,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date || null,
        assignee_id:
          data.assignee_id && data.assignee_id !== "none"
            ? Number(data.assignee_id)
            : null,
      });

      showToast("Task created successfully", "success");
      router.push(`/projects/${projectId}`);
    } catch (error: any) {
      showToast(error.message || "Failed to create task", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <Loader2
          className="h-8 w-8 animate-spin text-indigo-600"
          aria-label="Loading projects"
        />
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
            <Link href="/dashboard" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-700">
              <ClipboardPlus className="h-4 w-4" />
              New workspace task
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Create a task
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              Capture the work, choose its project, and make the next step clear
              for your team.
            </p>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5 sm:p-7">
          <TaskForm
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            members={members}
            onSubmit={handleSubmit}
            onCancel={() => router.push("/dashboard")}
            onProjectChange={handleProjectChange}
            isSubmitting={isSubmitting}
            submitLabel="Create Task"
          />
        </CardContent>
      </Card>
    </div>
  );
}
