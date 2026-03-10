"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { createWorkspace } from "@/lib/api/workspaces";
import { apiGet } from "@/lib/api-client";
import type { Organization } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/lib/toast";

export default function NewWorkspacePage() {
  const router = useRouter();
  const { switchWorkspace, refreshWorkspaces } = useWorkspace();
  const { showToast } = useToast();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    organization_id: "",
    color_theme: "#2563eb",
  });

  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const res = await apiGet<{ organizations: Organization[] }>("/organizations");
        setOrganizations(res.organizations || []);
        if (res.organizations?.length > 0) {
          setFormData(prev => ({ ...prev, organization_id: res.organizations[0].id.toString() }));
        }
      }
      catch (error) {
        showToast("Failed to load organizations. Please try again.", "error");
      }
      finally {
        setLoadingOrgs(false);
      }
    }

    fetchOrganizations();
  }, [showToast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast("Workspace name is required", "error");
      return;
    }

    if (!formData.organization_id) {
      showToast("Please select an organization", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await createWorkspace({
        name: formData.name,
        description: formData.description,
        organization_id: parseInt(formData.organization_id),
        color_theme: formData.color_theme,
      });

      await refreshWorkspaces();

      if (response.workspace) {
        switchWorkspace(response.workspace);
      }

      showToast("Workspace created successfully!", "success");
      router.push("/workspaces");
    }
    catch (error: any) {
      showToast(error.message || "Failed to create workspace", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  const presetColors = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed", "#db2777"];

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workspaces">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Workspaces</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create Workspace</h1>
          <p className="text-muted-foreground">
            Set up a new workspace for your team or project.
          </p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Workspace Details</CardTitle>
            <CardDescription>
              Provide the basic information for your new workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingOrgs ? (
              <div className="h-20 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : organizations.length === 0 ? (
              <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
                <p className="text-sm text-amber-800">
                  You need to belong to an organization before creating a workspace.
                  Please ask your admin to invite you or create an organization first.
                </p>
              </div>
            ) : (
              <>
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

                <div className="space-y-2">
                  <Label htmlFor="name">Workspace Name</Label>
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
                        className={`w-8 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 cursor-pointer ${formData.color_theme === color ? "ring-2 ring-offset-2 ring-slate-900" : ""
                          }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color_theme: color })}
                        aria-label={`Select color ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t px-6 py-4">
            <Button variant="outline" asChild>
              <Link href="/workspaces">Cancel</Link>
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
              disabled={isSubmitting || loadingOrgs || organizations.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Workspace"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
