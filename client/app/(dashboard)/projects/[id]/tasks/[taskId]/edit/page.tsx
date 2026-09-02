"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getTask, updateTask, deleteTask } from "@/lib/api/tasks";
import { getProjectEligibleMembers, ProjectMember } from "@/lib/api/members";
import type { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/lib/toast";
import {
  Loader2,
  ArrowLeft,
  ClipboardList,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { TaskForm, TaskFormData } from "@/components/forms/TaskForm";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EditTaskPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { hasPermission } = useWorkspace();
  const { user } = useAuth();
  const projectId = params.id as string;
  const taskId = params.taskId as string;

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!projectId || !taskId) return;

      try {
        const [taskRes, membersRes] = await Promise.all([
          getTask(taskId),
          getProjectEligibleMembers(projectId),
        ]);

        if (taskRes.task) {
          setTask(taskRes.task);
        }
        setMembers(membersRes.members || []);
      } catch (error) {
        showToast("Error loading task data", "error");
        router.push(`/projects/${projectId}`);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [projectId, taskId, router, showToast]);

  const handleSubmit = async (data: TaskFormData) => {
    try {
      setIsSubmitting(true);
      await updateTask(taskId, {
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

      showToast("Task updated successfully", "success");
      router.push(`/projects/${projectId}`);
    } catch (error: any) {
      showToast(error.message || "Failed to update task", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteTask(taskId);
      showToast("Task deleted successfully", "success");
      router.push(`/projects/${projectId}`);
    } catch (error: any) {
      showToast(error.message || "Failed to delete task", "error");
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const canEditTask = Boolean(
    task && (hasPermission("tasks:edit") || task.assignee_id === user?.id),
  );
  const canDeleteTask = hasPermission("tasks:delete");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 pb-12">
      <section className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-sky-50 px-5 py-6 shadow-sm sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-indigo-200/45 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button
              variant="outline"
              size="icon"
              asChild
              className="mt-0.5 shrink-0 border-indigo-200 bg-white/80 cursor-pointer"
            >
              <Link
                href={`/projects/${projectId}`}
                aria-label="Back to project"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-700">
                <ClipboardList className="h-4 w-4" />
                {canEditTask ? "Task editor" : "Task details"}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {canEditTask ? "Edit task" : "View task"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
                {canEditTask
                  ? "Update the work details, ownership, and deadline."
                  : "Review the task details and current delivery plan."}
              </p>
            </div>
          </div>
          {canDeleteTask && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="shrink-0 cursor-pointer"
              disabled={isSubmitting || isDeleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </section>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5 sm:p-7">
          {task && (
            <TaskForm
              initialData={{
                title: task.title,
                description: task.description || "",
                status: task.status || "todo",
                priority: task.priority || "medium",
                due_date: task.due_date ? task.due_date.split("T")[0] : "",
                assignee_id: task.assignee_id || "none",
                project_id: task.project_id || projectId,
              }}
              members={members}
              onSubmit={handleSubmit}
              onCancel={() => router.push(`/projects/${projectId}`)}
              isSubmitting={isSubmitting}
              submitLabel="Save Changes"
              readOnly={!canEditTask}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Are you sure?
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              task.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
