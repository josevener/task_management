"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CalendarIcon } from "lucide-react";

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Project Name <span className="text-red-500">*</span></Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="e.g. Website Redesign"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            placeholder="What is this project about?"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(val) => handleSelectChange('status', val)}
            >
              <SelectTrigger id="status" className="bg-white">
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
              <Label htmlFor="health">Health Status</Label>
              <Select
                value={formData.health_status}
                onValueChange={(val) => handleSelectChange('health_status', val)}
              >
                <SelectTrigger id="health" className="bg-white">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="grid gap-2">
            <Label htmlFor="start_date">Start Date</Label>
            <div className="relative">
              <Input
                id="start_date"
                name="start_date"
                type="date"
                value={formData.start_date}
                onChange={handleChange}
                className="bg-white block w-full pl-10"
              />
              <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="end_date">End Date</Label>
            <div className="relative">
              <Input
                id="end_date"
                name="end_date"
                type="date"
                value={formData.end_date}
                onChange={handleChange}
                className="bg-white block w-full pl-10"
              />
              <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-8 pt-6 border-t px-6 py-4 bg-slate-50/50 rounded-b-xl">
        <Button 
          type="button" 
          variant="outline" 
          className="cursor-pointer"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer" 
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
