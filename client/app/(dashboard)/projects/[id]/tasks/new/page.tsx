"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createTask } from "@/lib/api/tasks";
import { getProjectEligibleMembers, ProjectMember } from "@/lib/api/members";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/lib/toast";
import { ArrowLeft, ClipboardPlus, Loader2 } from "lucide-react";
import { TaskForm, TaskFormData } from "@/components/forms/TaskForm";

export default function CreateTaskPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const projectId = params.id as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    getProjectEligibleMembers(projectId)
      .then((res) => setMembers(res.members))
      .catch(() => showToast("We couldn't load project members.", "error"))
      .finally(() => setLoadingMembers(false));
  }, [projectId]);

  const handleSubmit = async (data: TaskFormData) => {
    try {
      setIsSubmitting(true);
      await createTask({
        project_public_id: projectId,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date || null,
        assignee_public_id:
          data.assignee_id && data.assignee_id !== "none"
            ? data.assignee_id
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
            <Link href={`/projects/${projectId}`} aria-label="Back to project">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-700">
              <ClipboardPlus className="h-4 w-4" />
              Project task
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Create a task
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              Add focused work to this project and set your team up for a clear
              next step.
            </p>
          </div>
        </div>
      </section>

      {loadingMembers ? (
        <div className="flex h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2
            className="h-8 w-8 animate-spin text-indigo-600"
            aria-label="Loading project members"
          />
        </div>
      ) : (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5 sm:p-7">
            <TaskForm
              initialData={{
                title: "",
                description: "",
                status: "todo",
                priority: "medium",
                due_date: "",
                assignee_id: "none",
                project_id: projectId,
              }}
              members={members}
              onSubmit={handleSubmit}
              onCancel={() => router.push(`/projects/${projectId}`)}
              isSubmitting={isSubmitting}
              submitLabel="Create Task"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
