"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getOrganization, updateOrganization } from "@/lib/api/organizations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/lib/toast";
import { Loader2, ArrowLeft, Building2 } from "lucide-react";

export default function EditOrganizationPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const organizationId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', slug: '', subscription_tier: '' });

  useEffect(() => {
    async function fetchOrg() {
      if (isNaN(organizationId)) return;
      try {
        const res = await getOrganization(organizationId);
        if (res.organization) {
          setEditForm({
            name: res.organization.name,
            slug: res.organization.slug,
            subscription_tier: res.organization.subscription_tier || 'Free'
          });
        }
      }
      catch (error) {
        showToast("Error loading organization", "error");
        router.push("/organizations");
      }
      finally {
        setLoading(false);
      }
    }
    fetchOrg();
  }, [organizationId, router, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.slug.trim()) return;

    try {
      setIsSubmitting(true);
      await updateOrganization(organizationId, editForm);
      showToast("Organization updated successfully", "success");
      router.push("/organizations");
    }
    catch (error: any) {
      showToast(error.message || "Failed to update organization", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
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
          <Link href="/organizations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Edit Organization</h1>
          <p className="text-muted-foreground">Manage your organization settings and details.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-500" />
              Organization Settings
            </CardTitle>
            <CardDescription>
              Update the profile and subscription details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                placeholder="e.g. Acme Corp"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug <span className="text-red-500">*</span></Label>
              <Input
                id="slug"
                value={editForm.slug}
                onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                required
                placeholder="e.g. acme-corp"
              />
              <p className="text-xs text-slate-500">This is used for your unique organization URL.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tier">Subscription Tier</Label>
              <Select
                value={editForm.subscription_tier}
                onValueChange={(val) => setEditForm({ ...editForm, subscription_tier: val })}
              >
                <SelectTrigger id="tier" className="bg-white">
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Free">Free</SelectItem>
                  <SelectItem value="Pro">Pro</SelectItem>
                  <SelectItem value="Enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3 border-t bg-slate-50 p-4">
            <Button type="button" variant="outline" asChild className="cursor-pointer">
              <Link href="/organizations">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
