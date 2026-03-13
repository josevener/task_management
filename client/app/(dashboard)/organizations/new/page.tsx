"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createOrganization } from "@/lib/api/organizations";
import { useToast } from "@/lib/toast";
import { Building2, ArrowLeft } from "lucide-react";
import { OrganizationForm } from "@/components/forms/OrganizationForm";

export default function NewOrganizationPage() {
  const router = useRouter();
  const { showToast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: { name: string; slug: string; subscription_tier: string }) => {
    try {
      setIsSubmitting(true);
      await createOrganization(data);
      
      showToast("Organization created successfully", "success");
      router.push("/organizations");
      router.refresh(); // Reflect new orgs
    } 
    catch (error: any) {
      showToast(error.message || "Failed to create organization", "error");
    } 
    finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
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
