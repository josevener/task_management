"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlignLeft,
  CalendarIcon,
  LayoutGrid,
  Loader2,
  UserRound,
} from "lucide-react";

export interface TaskFormData {
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  assignee_id: string | number;
  project_id?: string | number;
}

interface TaskFormProps {
  initialData?: {
    title: string;
    description: string;
    status: string;
    priority: string;
    due_date: string;
    assignee_id: string | number;
    project_id?: string | number;
  };
  projects?: { id: number | string; name: string }[];
  members: { id: number | string; first_name: string; last_name: string }[];
  onSubmit: (data: TaskFormData) => Promise<void>;
  onCancel: () => void;
  onProjectChange?: (projectId: string) => void;
  isSubmitting: boolean;
  submitLabel: string;
  readOnly?: boolean;
}

export function TaskForm({
  initialData,
  projects = [],
  members = [],
  onSubmit,
  onCancel,
  onProjectChange,
  isSubmitting,
  submitLabel,
  readOnly = false,
}: TaskFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    status: initialData?.status || "todo",
    priority: initialData?.priority || "medium",
    due_date: initialData?.due_date || "",
    assignee_id: initialData?.assignee_id || "none",
    project_id: initialData?.project_id || "none",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));

    if (name === "project_id" && onProjectChange) {
      onProjectChange(value);
      // Reset assignee when project changes unless it's initial load/specific case
      setFormData((prev) => ({ ...prev, assignee_id: "none" }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const nextErrors: Record<string, string> = {};
    if (!formData.title.trim())
      nextErrors.title = "Give this task a clear title.";

    if (
      projects.length > 0 &&
      (formData.project_id === "none" || !formData.project_id)
    ) {
      nextErrors.project_id = "Choose the project this task belongs to.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    void onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-7" noValidate>
      <fieldset
        disabled={readOnly}
        className="space-y-7 disabled:cursor-not-allowed disabled:opacity-75"
      >
        <section className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Task details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Start with the outcome and enough context for someone else to take
              action.
            </p>
          </div>
          <div className="grid gap-5">
            {/* Project Selection (Conditional) */}
            {projects.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="project_id">
                  Project <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={String(formData.project_id)}
                  onValueChange={(val) => handleSelectChange("project_id", val)}
                >
                  <SelectTrigger
                    id="project_id"
                    className="h-11 w-full border-slate-200 bg-white"
                    aria-invalid={Boolean(errors.project_id)}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4 text-blue-500" />
                      <SelectValue placeholder="Select a project" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>
                      Select a project
                    </SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={String(project.id)}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.project_id && (
                  <p role="alert" className="text-sm text-red-600">
                    {errors.project_id}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Prepare launch checklist"
                required
                aria-invalid={Boolean(errors.title)}
                aria-describedby={
                  errors.title ? "task-title-error" : "task-title-help"
                }
                className="h-11 border-slate-200 bg-white shadow-none"
              />
              {errors.title ? (
                <p
                  id="task-title-error"
                  role="alert"
                  className="text-sm text-red-600"
                >
                  {errors.title}
                </p>
              ) : (
                <p id="task-title-help" className="text-xs text-slate-500">
                  Use a specific, action-oriented title.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="flex items-center gap-2">
                <AlignLeft className="h-4 w-4 text-slate-400" />
                Description{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Add necessary details or acceptance criteria..."
                rows={5}
                className="resize-y border-slate-200 bg-white shadow-none"
              />
            </div>
          </div>
        </section>

        <section className="border-t border-slate-100 pt-6">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">
              Plan and assign
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Set the starting state, urgency, ownership, and deadline.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val) => handleSelectChange("status", val)}
              >
                <SelectTrigger
                  id="status"
                  className="h-11 w-full border-slate-200 bg-white"
                >
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
              <Select
                value={formData.priority}
                onValueChange={(val) => handleSelectChange("priority", val)}
              >
                <SelectTrigger
                  id="priority"
                  className="h-11 w-full border-slate-200 bg-white"
                >
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

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assignee" className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-slate-400" />
                Assignee
              </Label>
              <Select
                value={String(formData.assignee_id)}
                onValueChange={(val) => handleSelectChange("assignee_id", val)}
                disabled={projects.length > 0 && formData.project_id === "none"}
              >
                <SelectTrigger
                  id="assignee"
                  className="h-11 w-full border-slate-200 bg-white"
                >
                  <SelectValue
                    placeholder={
                      projects.length > 0 && formData.project_id === "none"
                        ? "Select project first"
                        : "Unassigned"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map((member) => (
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
                  className="h-11 w-full border-slate-200 bg-white pl-10 text-slate-600 shadow-none"
                />
                <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>
        </section>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
        {readOnly && (
          <p className="mr-auto self-center text-sm text-slate-500">
            You have view-only access to this task.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-11 cursor-pointer"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {readOnly ? "Back to project" : "Cancel"}
        </Button>
        {!readOnly && (
          <Button
            type="submit"
            className="h-11 bg-indigo-600 px-5 text-white hover:bg-indigo-700 cursor-pointer"
            disabled={
              isSubmitting ||
              !formData.title.trim() ||
              (projects.length > 0 && formData.project_id === "none")
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {submitLabel === "Create Task" ? "Creating..." : "Saving..."}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
