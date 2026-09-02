"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/workspace-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createOrganization, getOrganizations } from "@/lib/api/organizations";
import { useToast } from "@/lib/toast";
import { Building2, ArrowLeft } from "lucide-react";
import { OrganizationForm } from "@/components/forms/OrganizationForm";

export default function NewOrganizationPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { refreshWorkspaces } = useWorkspace();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(true);

  useEffect(() => {
    getOrganizations()
      .then((response) => {
        if (response.organizations?.length) router.replace("/organizations");
      })
      .catch(() => showToast("Unable to confirm organization setup.", "error"))
      .finally(() => setCheckingEligibility(false));
  }, [router, showToast]);

  const handleSubmit = async (data: { name: string; slug: string; subscription_tier: string }) => {
    try {
      setIsSubmitting(true);
      const response = await createOrganization(data);

      showToast("Organization created successfully", "success");

      // Auto-select the new workspace and sync state
      if (response.workspace) {
        await refreshWorkspaces(response.workspace.id);
        router.push("/dashboard");
      }
      else {
        await refreshWorkspaces();
        router.push("/organizations");
      }
    }
    catch (error: any) {
      showToast(error.message || "Failed to create organization", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  if (checkingEligibility) return <div className="flex h-64 items-center justify-center"><Building2 className="h-8 w-8 animate-pulse text-indigo-600" /></div>;

  return (
    <div className="w-full space-y-4">
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Organization Details
          </CardTitle>
          <CardDescription>
            Provide the core information for your new organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationForm
            onSubmit={handleSubmit}
            onCancel={() => router.push("/organizations")}
            isSubmitting={isSubmitting}
            submitLabel="Create Organization"
          />
        </CardContent>
      </Card>
    </div>
  );
}
