"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, User, ShieldCheck } from "lucide-react";

interface MemberFormProps {
  initialData?: {
    first_name: string;
    last_name: string;
    email: string;
    role_id: string;
  };
  roles: { id: number | string; name: string }[];
  onSubmit: (data: {
    first_name: string;
    last_name: string;
    email: string;
    role_id: string;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel: string;
  isEdit?: boolean;
}

export function MemberForm({
  initialData,
  roles = [],
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
  isEdit = false,
}: MemberFormProps) {
  const [formData, setFormData] = useState({
    first_name: initialData?.first_name || "",
    last_name: initialData?.last_name || "",
    email: initialData?.email || "",
    role_id: initialData?.role_id || (roles.length > 0 ? roles[0].id.toString() : ""),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!isEdit && (!formData.first_name.trim() || !formData.email.trim())) || !formData.role_id) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="first_name">First Name <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Input
              id="first_name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              placeholder="e.g. John"
              className="pl-10"
              required
              disabled={isEdit}
            />
            <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="last_name">Last Name</Label>
          <div className="relative">
            <Input
              id="last_name"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              placeholder="e.g. Doe"
              className="pl-10"
              disabled={isEdit}
            />
            <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>
      {isEdit && <p className="text-xs text-muted-foreground">Profile details are read-only here to avoid changing the user's global account information from a workspace screen.</p>}

      <div className="space-y-2">
        <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
        <div className="relative">
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="e.g. john.doe@example.com"
            className="pl-10"
            required
            disabled={isEdit}
          />
          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        </div>
        {isEdit && <p className="text-xs text-muted-foreground">Email cannot be changed after creation.</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="role_id">Workspace Role <span className="text-red-500">*</span></Label>
        <div className="relative">
          <Select
            value={formData.role_id}
            onValueChange={(val) => handleSelectChange('role_id', val)}
          >
            <SelectTrigger id="role_id" className="pl-10 bg-white">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id.toString()}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 z-10" />
        </div>
        <p className="text-xs text-muted-foreground">Assign a role to define what the user can do in this workspace.</p>
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
          disabled={isSubmitting || (!isEdit && (!formData.first_name.trim() || !formData.email.trim())) || !formData.role_id}
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
