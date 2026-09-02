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
  Flag,
  FolderKanban,
  Loader2,
} from "lucide-react";

interface ProjectFormProps {
  initialData?: {
    name: string;
    description: string;
    status: string;
    health_status?: string;
    start_date: string;
    end_date: string;
  };
  onSubmit: (data: {
    name: string;
    description: string;
    status: string;
    health_status?: string;
    start_date: string;
    end_date: string;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel: string;
  isEdit?: boolean;
}

export function ProjectForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
  isEdit = false,
}: ProjectFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    status: initialData?.status || "active",
    health_status: initialData?.health_status || "not_set",
    start_date: initialData?.start_date || "",
    end_date: initialData?.end_date || "",
  });

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) =>
    setFormData((previous) => ({ ...previous, [name]: value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (formData.name.trim()) onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FolderKanban className="h-4 w-4 text-indigo-600" />
            Project details
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Give your team enough context to recognize this work at a glance.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="name" className="text-sm font-medium text-slate-700">
            Project name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="e.g. Website Redesign"
            className="h-11 border-slate-200 bg-slate-50 px-3 shadow-none focus-visible:bg-white"
          />
        </div>
        <div className="grid gap-2">
          <Label
            htmlFor="description"
            className="text-sm font-medium text-slate-700"
          >
            Description
          </Label>
          <div className="relative">
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={5}
              placeholder="What is this project about?"
              className="resize-y border-slate-200 bg-slate-50 pl-10 pt-3 shadow-none focus-visible:bg-white"
            />
            <AlignLeft className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          </div>
          <p className="text-xs text-slate-500">
            Briefly describe the outcome, audience, or key deliverables.
          </p>
        </div>
      </section>

      <section className="border-t border-slate-100 pt-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Flag className="h-4 w-4 text-indigo-600" />
            Plan and status
          </div>
          <p className="mt-1 text-sm text-slate-500">
            You can update these details as the project progresses.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="grid gap-2">
            <Label
              htmlFor="status"
              className="text-sm font-medium text-slate-700"
            >
              Status
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleSelectChange("status", value)}
            >
              <SelectTrigger
                id="status"
                className="h-11 w-full border-slate-200 bg-slate-50 text-sm shadow-none"
              >
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                {isEdit && <SelectItem value="archived">Archived</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div className="grid gap-2">
              <Label
                htmlFor="health"
                className="text-sm font-medium text-slate-700"
              >
                Health status
              </Label>
              <Select
                value={formData.health_status}
                onValueChange={(value) =>
                  handleSelectChange("health_status", value)
                }
              >
                <SelectTrigger
                  id="health"
                  className="h-11 w-full border-slate-200 bg-slate-50 text-sm shadow-none"
                >
                  <SelectValue placeholder="Select health" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_set">Not Set</SelectItem>
                  <SelectItem value="on_track">On Track</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="off_track">Off Track</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="grid gap-2">
            <Label
              htmlFor="start_date"
              className="text-sm font-medium text-slate-700"
            >
              Start date
            </Label>
            <div className="relative">
              <Input
                id="start_date"
                name="start_date"
                type="date"
                value={formData.start_date}
                onChange={handleChange}
                className="block h-11 w-full border-slate-200 bg-slate-50 pl-10 shadow-none focus-visible:bg-white"
              />
              <CalendarIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label
              htmlFor="end_date"
              className="text-sm font-medium text-slate-700"
            >
              Target end date
            </Label>
            <div className="relative">
              <Input
                id="end_date"
                name="end_date"
                type="date"
                value={formData.end_date}
                onChange={handleChange}
                className="block h-11 w-full border-slate-200 bg-slate-50 pl-10 shadow-none focus-visible:bg-white"
              />
              <CalendarIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            </div>
          </div>
        </div>
      </section>

      <div className="-mx-5 -mb-5 flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:-mx-7 sm:-mb-7 sm:flex-row sm:items-center sm:justify-end sm:px-7">
        <Button
          type="button"
          variant="outline"
          className="h-10 border-slate-200 bg-white cursor-pointer"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="h-10 bg-indigo-600 px-5 text-white hover:bg-indigo-700 cursor-pointer"
          disabled={isSubmitting || !formData.name.trim()}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEdit ? "Saving..." : "Creating..."}
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}
