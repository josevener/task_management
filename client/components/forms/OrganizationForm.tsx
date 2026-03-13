"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface OrganizationFormProps {
  initialData?: {
    name: string;
    slug: string;
    subscription_tier: string;
  };
  onSubmit: (data: { name: string; slug: string; subscription_tier: string }) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel: string;
}

export function OrganizationForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
}: OrganizationFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    slug: initialData?.slug || "",
    subscription_tier: initialData?.subscription_tier || "Free",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // Auto-generate slug if title is changed and slug hasn't been manually heavily edited
      ...(name === 'name' && prev.slug === prev.name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '')
        ? { slug: value.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '') }
        : {})
    }));
  };

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, subscription_tier: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.slug.trim()) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Organization Name <span className="text-red-500">*</span></Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g. Acme Corp"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">URL Slug <span className="text-red-500">*</span></Label>
        <Input
          id="slug"
          name="slug"
          value={formData.slug}
          onChange={handleChange}
          placeholder="e.g. acme-corp"
          className="font-mono text-sm"
          required
        />
        <p className="text-xs text-muted-foreground">This acts as a unique identifier for API and domain routing.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subscription_tier">Subscription Tier</Label>
        <Select value={formData.subscription_tier} onValueChange={handleSelectChange}>
          <SelectTrigger id="subscription_tier" className="w-full bg-white">
            <SelectValue placeholder="Select a tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Free">Free</SelectItem>
            <SelectItem value="Pro">Pro</SelectItem>
            <SelectItem value="Enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
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
          disabled={isSubmitting || !formData.name.trim() || !formData.slug.trim()}
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
