"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { updateWorkspace } from "@/lib/api/workspaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/lib/toast";
import { Loader2, ArrowLeft, Briefcase } from "lucide-react";

export default function EditWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { workspaces, refreshWorkspaces, loading } = useWorkspace();
  const workspaceId = Number(params.id);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', color_theme: '' });

  const presetColors = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed", "#db2777"];

  useEffect(() => {
    if (!loading && workspaces.length > 0) {
      const workspace = workspaces.find(w => w.id === workspaceId);
      if (workspace) {
        setEditForm({
          name: workspace.name,
          description: workspace.description || '',
          color_theme: workspace.color_theme || '#2563eb'
        });
      }
      else {
        showToast("Workspace not found", "error");
        router.push("/workspaces");
      }
    }
  }, [loading, workspaces, workspaceId, router, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) return;

    try {
      setIsSubmitting(true);
      await updateWorkspace(workspaceId, editForm);
      showToast("Workspace updated successfully", "success");
      await refreshWorkspaces();
      router.push("/workspaces");
    }
    catch (error: any) {
      showToast(error.message || "Failed to update workspace", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !editForm.name) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="cursor-pointer">
          <Link href="/workspaces">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Edit Workspace</h1>
          <p className="text-muted-foreground">Update the details for this workspace.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-slate-500" />
              Workspace Settings
            </CardTitle>
            <CardDescription>
              Modify your workspace name, description, and theme.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="e.g. Engineering Team"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                placeholder="What is this workspace for?"
              />
            </div>

            <div className="space-y-3">
              <Label>Color Theme</Label>
              <div className="flex gap-3">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-10 h-10 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-transform hover:scale-110 cursor-pointer ${editForm.color_theme === color ? "ring-2 ring-offset-2 ring-slate-900 scale-110" : "opacity-80"
                      }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setEditForm(prev => ({ ...prev, color_theme: color }))}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3 border-t bg-slate-50 p-4">
            <Button type="button" variant="outline" asChild className="cursor-pointer">
              <Link href="/workspaces">Cancel</Link>
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
