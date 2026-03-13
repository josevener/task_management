"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getOrganization, updateOrganization } from "@/lib/api/organizations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/lib/toast";
import { Loader2, ArrowLeft, Building2 } from "lucide-react";
import { OrganizationForm } from "@/components/forms/OrganizationForm";

export default function EditOrganizationPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const organizationId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);

  useEffect(() => {
    async function fetchOrg() {
      if (isNaN(organizationId)) return;
      try {
        const res = await getOrganization(organizationId);
        if (res.organization) {
          setOrgData(res.organization);
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

  const handleSubmit = async (data: { name: string; slug: string; subscription_tier: string }) => {
    try {
      setIsSubmitting(true);
      await updateOrganization(organizationId, data);
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-500" />
            Organization Settings
          </CardTitle>
          <CardDescription>
            Update the profile and subscription details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgData && (
            <OrganizationForm
              initialData={{
                name: orgData.name,
                slug: orgData.slug,
                subscription_tier: orgData.subscription_tier || 'Free'
              }}
              onSubmit={handleSubmit}
              onCancel={() => router.push("/organizations")}
              isSubmitting={isSubmitting}
              submitLabel="Save Changes"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
