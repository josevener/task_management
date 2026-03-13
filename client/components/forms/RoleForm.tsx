"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface RoleFormProps {
  initialData?: {
    name: string;
    description: string;
    is_system_role?: boolean;
  };
  onSubmit: (data: { name: string; description: string }) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel: string;
}

export function RoleForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
}: RoleFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Role Name
        </label>
        <Input
          id="name"
          placeholder="e.g. QA Tester, Guest Viewer"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          disabled={initialData?.is_system_role}
          autoFocus={!initialData}
          required
        />
        {!!initialData?.is_system_role && (
          <p className="text-xs text-slate-500">System roles cannot be renamed.</p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">
          Description {!initialData && "(Optional)"}
        </label>
        <Textarea
          id="description"
          placeholder="What can people with this role do?"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
        />
      </div>

      <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
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
          disabled={!formData.name.trim() || isSubmitting}
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
