"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { createOrganization } from "@/lib/api/organizations";
import { useToast } from "@/lib/toast";
import { Building2, Loader2, ArrowLeft } from "lucide-react";

export default function NewOrganizationPage() {
  const router = useRouter();
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    subscription_tier: "Free",
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      showToast("Organization name is required", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await createOrganization(formData);
      
      showToast("Organization created successfully", "success");
      router.push("/organizations");
      router.refresh(); // Reflect new orgs
    } catch (error: any) {
      showToast(error.message || "Failed to create organization", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/organizations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create New Organization</h1>
          <p className="text-muted-foreground text-sm">
            Set up a new tenant to manage workspaces and users.
          </p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Organization Details
            </CardTitle>
            <CardDescription>
              Provide the core information for your new organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                placeholder="e.g. acme-corp"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">This acts as a unique identifier for API and domain routing.</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="subscription_tier">Subscription Tier</Label>
                <Select value={formData.subscription_tier} onValueChange={(val) => handleSelectChange('subscription_tier', val)}>
                  <SelectTrigger id="subscription_tier" className="w-full">
                    <SelectValue placeholder="Select a tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Free">Free (Standard limits)</SelectItem>
                    <SelectItem value="Pro">Pro (Advanced features)</SelectItem>
                    <SelectItem value="Enterprise">Enterprise (Unlimited payload)</SelectItem>
                  </SelectContent>
                </Select>
            </div>
            
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t pt-6">
            <Button type="button" variant="outline" asChild disabled={isSubmitting}>
              <Link href="/organizations">Cancel</Link>
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Organization
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
