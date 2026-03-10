"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { updateTask, deleteTask } from "@/lib/api/tasks";
import { useToast } from "@/lib/toast";
import { CalendarIcon, Loader2, MessageSquare, Trash2, CheckCircle2 } from "lucide-react";
import { getProjectEligibleMembers, ProjectMember } from "@/lib/api/members";
import type { Task } from "@/lib/types";

interface TaskDetailSheetProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: (task: Task) => void;
  onTaskDeleted: (taskId: number) => void;
}

export function TaskDetailSheet({ task, isOpen, onClose, onTaskUpdated, onTaskDeleted }: TaskDetailSheetProps) {
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "",
    priority: "",
    due_date: "",
    assignee_id: "" as string | number,
  });

  const [members, setMembers] = useState<ProjectMember[]>([]);

  useEffect(() => {
    if (isOpen && task?.project_id) {
      getProjectEligibleMembers(task.project_id)
        .then(res => setMembers(res.members))
        .catch(console.error);
    }
  }, [isOpen, task?.project_id]);

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || "",
        status: task.status,
        priority: task.priority,
        // formatted for typical html date input if present
        due_date: task.due_date ? task.due_date.split('T')[0] : "",
        assignee_id: task.assignee_id ? String(task.assignee_id) : "none"
      });
      setIsEditing(false); // Default to view mode
    }
  }, [task]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // If not editing title/desc, save immediate updates for dropdowns
    if (!isEditing && task) {
      saveChanges({ [name]: value });
    }
  };

  const saveChanges = async (updates: any = {}) => {
    if (!task) return;

    // Merge standard form data with specific immediate updates
    const dataToSave = {
      title: formData.title,
      description: formData.description,
      status: formData.status,
      priority: formData.priority,
      due_date: formData.due_date || null,
      assignee_id: formData.assignee_id && formData.assignee_id !== "none" ? Number(formData.assignee_id) : null,
      ...updates
    };

    if (!dataToSave.title.trim()) {
      showToast("Title is required", "error");
      return;
    }

    try {
      setIsSaving(true);
      const res = await updateTask(task.id, dataToSave);

      showToast("Task updated", "success");
      onTaskUpdated(res.task);
      setIsEditing(false);
    }
    catch (error: any) {
      showToast(error.message || "Failed to update task", "error");
    }
    finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    // Simple confirmation for MVP
    if (!task) return;
    if (!window.confirm("Are you sure you want to delete this task? This action cannot be undone.")) return;

    try {
      setIsSaving(true);
      await deleteTask(task.id);
      showToast("Task deleted", "success");
      onTaskDeleted(task.id);
      onClose();
    }
    catch (error: any) {
      showToast(error.message || "Failed to delete task", "error");
    }
    finally {
      setIsSaving(false);
    }
  };


  if (!task) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[600px] overflow-y-auto w-full p-0 flex flex-col h-full bg-slate-50">

        {/* Header Ribbon */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="uppercase">{task.status.replace('_', ' ')}</Badge>
            <Badge variant="secondary" className="uppercase bg-slate-100">{task.priority}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDelete} title="Delete Task">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 px-6 py-6 space-y-8">
          {/* Title Section */}
          <div>
            {isEditing ? (
              <Input
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="text-xl font-bold bg-white border-blue-200 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <h2 onClick={() => setIsEditing(true)} className="text-2xl font-bold text-slate-900 cursor-pointer hover:underline underline-offset-4 decoration-slate-300 decoration-2 transition">
                {formData.title}
              </h2>
            )}
            <div className="text-sm text-slate-500 mt-2 flex items-center gap-4">
              Added by {task.creator_first_name || 'User'} on {new Date(task.created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Quick Properties Grid */}
          <div className="grid grid-cols-2 gap-y-4 gap-x-8 p-4 bg-white border rounded-lg shadow-sm">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500 uppercase tracking-wider">Status</Label>
              <Select value={formData.status} onValueChange={(val) => handleSelectChange('status', val)}>
                <SelectTrigger className="h-8 text-sm focus:ring-0 focus:ring-offset-0 border-transparent hover:bg-slate-50 px-2 -ml-2 font-medium">
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

            <div className="space-y-1">
              <Label className="text-xs text-slate-500 uppercase tracking-wider">Priority</Label>
              <Select value={formData.priority} onValueChange={(val) => handleSelectChange('priority', val)}>
                <SelectTrigger className="h-8 text-sm focus:ring-0 focus:ring-offset-0 border-transparent hover:bg-slate-50 px-2 -ml-2 font-medium">
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

            <div className="space-y-1">
              <Label className="text-xs text-slate-500 uppercase tracking-wider">Due Date</Label>
              {isEditing ? (
                <div className="relative mt-1">
                  <Input
                    type="date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleChange}
                    className="h-8 text-sm pl-8"
                  />
                  <CalendarIcon className="absolute left-2.5 top-1.5 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              ) : (
                <div
                  onClick={() => setIsEditing(true)}
                  className={`h-8 flex items-center gap-2 cursor-pointer hover:bg-slate-50 -ml-2 px-2 rounded-md ${formData.due_date && new Date(formData.due_date) < new Date() ? 'text-red-600 font-medium' : 'text-slate-700 font-medium'}`}
                >
                  <CalendarIcon className="h-4 w-4" />
                  {formData.due_date ? new Date(formData.due_date).toLocaleDateString() : "Set due date"}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-500 uppercase tracking-wider">Assignee</Label>
              <Select
                value={String(formData.assignee_id)}
                onValueChange={(val) => {
                  setFormData(prev => ({ ...prev, assignee_id: val }));
                  if (!isEditing && task) {
                    saveChanges({ assignee_id: val === "none" ? null : Number(val) });
                  }
                }}
              >
                <SelectTrigger className="h-8 text-sm focus:ring-0 focus:ring-offset-0 border-transparent hover:bg-slate-50 px-2 -ml-2 font-medium">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5 border">
                      <AvatarFallback className="text-[9px] bg-slate-200">
                        {task.assignee_first_name ? task.assignee_first_name[0] : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <SelectValue placeholder="Unassigned" />
                  </div>
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
          </div>

          {/* Description Section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-slate-500" />
              Description
            </Label>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Add a more detailed description..."
                  className="bg-white min-h-[150px] resize-y"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => saveChanges()} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Save
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setIsEditing(true)}
                className="text-sm text-slate-700 bg-white border rounded-lg p-4 min-h-[100px] cursor-text hover:bg-slate-50 border-transparent hover:border-slate-200 transition-colors whitespace-pre-wrap"
              >
                {formData.description ? formData.description : <span className="text-slate-400 italic">Click to add description...</span>}
              </div>
            )}
          </div>

          {/* Mock Activity/Comments Feed -> Could be wired up in later versions */}
          <div className="pt-6 border-t space-y-4">
            <h3 className="font-semibold text-sm">Activity</h3>
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-100 text-blue-700">M</AvatarFallback>
              </Avatar>
              <div className="flex-1 border rounded-lg bg-white overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
                <Textarea className="border-0 focus-visible:ring-0 min-h-[80px] text-sm resize-none" placeholder="Write a comment..." />
                <div className="bg-slate-50 px-3 py-2 border-t flex justify-end">
                  <Button size="sm" variant="secondary" className="opacity-50 cursor-not-allowed">Comment</Button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </SheetContent>
    </Sheet>
  );
}
