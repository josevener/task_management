"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface WorkspaceFormProps {
  initialData?: {
    name: string;
    description: string;
    organization_id: string;
    color_theme: string;
  };
  organizations?: { id: number | string; name: string }[];
  onSubmit: (data: { name: string; description: string; organization_id: string; color_theme: string }) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel: string;
}

export function WorkspaceForm({
  initialData,
  organizations = [],
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
}: WorkspaceFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    organization_id: initialData?.organization_id || (organizations.length > 0 ? organizations[0].id.toString() : ""),
    color_theme: initialData?.color_theme || "#0f766e",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.organization_id) return;
    onSubmit(formData);
  };

  const presetColors = ["#0f766e", "#14b8a6", "#16a34a", "#d97706", "#7c3aed", "#db2777"];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {organizations.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="organization_id">Organization</Label>
          <select
            id="organization_id"
            name="organization_id"
            value={formData.organization_id}
            onChange={handleChange}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            required
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Workspace Name <span className="text-red-500">*</span></Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. Engineering Team, Marketing Campaign Q3"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="What is the purpose of this workspace?"
          value={formData.description}
          onChange={handleChange}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Color Theme</Label>
        <div className="flex gap-2 mt-2">
          {presetColors.map((color) => (
            <button
              key={color}
              type="button"
              className={`w-8 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 cursor-pointer transition-transform hover:scale-110 ${formData.color_theme === color ? "ring-2 ring-offset-2 ring-slate-900 scale-110" : "opacity-80"
                }`}
              style={{ backgroundColor: color }}
              onClick={() => setFormData({ ...formData, color_theme: color })}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-8 pt-6 border-t px-6 py-4 bg-slate-50/50">
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
          disabled={isSubmitting || !formData.name.trim() || !formData.organization_id}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}
