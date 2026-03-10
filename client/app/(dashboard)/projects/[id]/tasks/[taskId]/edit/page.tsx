"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getTask, updateTask, deleteTask } from "@/lib/api/tasks";
import { getProjectEligibleMembers, ProjectMember } from "@/lib/api/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/lib/toast";
import { Loader2, ArrowLeft, CalendarIcon, Edit3, Trash2 } from "lucide-react";

export default function EditTaskPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const projectId = Number(params.id);
  const taskId = Number(params.taskId);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "",
    priority: "",
    due_date: "",
    assignee_id: "" as string | number,
  });

  useEffect(() => {
    async function init() {
      if (isNaN(projectId) || isNaN(taskId)) return;

      try {
        const [taskRes, membersRes] = await Promise.all([
          getTask(projectId, taskId),
          getProjectEligibleMembers(projectId)
        ]);

        const task = taskRes.task;
        setMembers(membersRes.members);
        setFormData({
          title: task.title,
          description: task.description || "",
          status: task.status,
          priority: task.priority,
          due_date: task.due_date ? task.due_date.split('T')[0] : "",
          assignee_id: task.assignee_id ? String(task.assignee_id) : "none"
        });
      }
      catch (error) {
        showToast("Error loading task", "error");
        router.push(`/projects/${projectId}`);
      }
      finally {
        setIsLoading(false);
      }
    }

    init();
  }, [projectId, taskId, router, showToast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast("Title is required", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await updateTask(taskId, {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        due_date: formData.due_date || null,
        assignee_id: formData.assignee_id && formData.assignee_id !== "none" ? Number(formData.assignee_id) : null,
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

  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true);
      await deleteTask(taskId);
      showToast("Task deleted", "success");
      router.push(`/projects/${projectId}`);
    }
    catch (error: any) {
      showToast(error.message || "Failed to delete task", "error");
    }
    finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (isLoading) {
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
          <p className="text-muted-foreground">Update the details and properties of this task.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-slate-500" />
                Task Details
              </CardTitle>
              <CardDescription>
                Modify descriptions, status, assignments, and due dates.
              </CardDescription>
            </div>
            <Button type="button" variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} className="cursor-pointer" disabled={isSubmitting || isDeleting}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Task title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Add necessary details..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(val) => handleSelectChange('status', val)}>
                    <SelectTrigger id="status" className="bg-white">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="review">In Review</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(val) => handleSelectChange('priority', val)}>
                    <SelectTrigger id="priority" className="bg-white">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="assignee">Assignee</Label>
                  <Select value={String(formData.assignee_id)} onValueChange={(val) => handleSelectChange('assignee_id', val)}>
                    <SelectTrigger id="assignee" className="bg-white">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {members.map(member => (
                        <SelectItem key={member.id} value={String(member.id)}>
                          {member.first_name} {member.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <div className="relative">
                    <Input
                      type="date"
                      id="due_date"
                      name="due_date"
                      value={formData.due_date}
                      onChange={handleChange}
                      className="pl-10 text-slate-600 block w-full bg-white"
                    />
                    <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3 border-t bg-slate-50 p-4">
            <Button type="button" variant="outline" asChild className="cursor-pointer">
              <Link href={`/projects/${projectId}`}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone and will permanently remove this record from the project board.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              onClick={handleDeleteConfirm}
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
