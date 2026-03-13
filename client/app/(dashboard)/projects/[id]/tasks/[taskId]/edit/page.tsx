"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getTask, updateTask, deleteTask } from "@/lib/api/tasks";
import { getProjectEligibleMembers, ProjectMember } from "@/lib/api/members";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/lib/toast";
import { Loader2, ArrowLeft, ClipboardList, Trash2, AlertCircle } from "lucide-react";
import { TaskForm } from "@/components/forms/TaskForm";
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
  const projectId = Number(params.id);
  const taskId = Number(params.taskId);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [task, setTask] = useState<any>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (isNaN(projectId) || isNaN(taskId)) return;

      try {
        const [taskRes, membersRes] = await Promise.all([
          getTask(projectId, taskId),
          getProjectEligibleMembers(projectId)
        ]);

        if (taskRes.task) {
          setTask(taskRes.task);
        }
        setMembers(membersRes.members || []);
      }
      catch (error) {
        showToast("Error loading task data", "error");
        router.push(`/projects/${projectId}`);
      }
      finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [projectId, taskId, router, showToast]);

  const handleSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      await updateTask(taskId, {
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date || null,
        assignee_id: data.assignee_id && data.assignee_id !== "none" ? Number(data.assignee_id) : null,
      });

      showToast("Task updated successfully", "success");
      router.push(`/projects/${projectId}`);
    }
    catch (error: any) {
      showToast(error.message || "Failed to update task", "error");
    }
    finally {
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

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="cursor-pointer">
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Edit Task</h1>
          <p className="text-muted-foreground">Adjust task details, priority, and assignment.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-slate-500" />
              Task Details
            </CardTitle>
            <CardDescription>
              Modify the task information.
            </CardDescription>
          </div>
          <Button 
            type="button" 
            variant="destructive" 
            size="sm" 
            onClick={() => setShowDeleteConfirm(true)} 
            className="cursor-pointer" 
            disabled={isSubmitting || isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </CardHeader>
        <CardContent>
          {task && (
            <TaskForm
              initialData={{
                title: task.title,
                description: task.description || '',
                status: task.status || 'todo',
                priority: task.priority || 'medium',
                due_date: task.due_date ? task.due_date.split('T')[0] : '',
                assignee_id: task.assignee_id || 'none'
              }}
              members={members}
              onSubmit={handleSubmit}
              onCancel={() => router.push(`/projects/${projectId}`)}
              isSubmitting={isSubmitting}
              submitLabel="Save Changes"
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
              This action cannot be undone. This will permanently delete the task.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
