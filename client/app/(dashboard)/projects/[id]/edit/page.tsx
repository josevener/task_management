"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { getProject, updateProject } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/lib/toast";
import { Loader2, ArrowLeft, FolderKanban } from "lucide-react";

export default function EditProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const projectId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    status: '',
    health_status: '',
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    async function fetchProjectData() {
      if (wsLoading) return;
      if (!activeWorkspace) {
        showToast("No active workspace selected", "error");
        router.push("/projects");
        return;
      }
      if (isNaN(projectId)) return;

      try {
        const res = await getProject(activeWorkspace.id, projectId);
        if (res.project) {
          setEditForm({
            name: res.project.name,
            description: res.project.description || '',
            status: res.project.status || 'active',
            health_status: res.project.health_status || 'not_set',
            start_date: res.project.start_date ? res.project.start_date.split('T')[0] : '',
            end_date: res.project.end_date ? res.project.end_date.split('T')[0] : ''
          });
        }
      }
      catch (error) {
        showToast("Error loading project", "error");
        router.push("/projects");
      }
      finally {
        setLoading(false);
      }
    }
    fetchProjectData();
  }, [projectId, activeWorkspace, wsLoading, router, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) return;

    try {
      setIsSubmitting(true);
      const dataToSubmit: any = { ...editForm };

      // Cleanup empty dates so backend receives null
      if (!dataToSubmit.start_date) delete dataToSubmit.start_date;
      if (!dataToSubmit.end_date) delete dataToSubmit.end_date;

      await updateProject(projectId, dataToSubmit);
      showToast("Project updated successfully", "success");
      router.push("/projects");
    }
    catch (error: any) {
      showToast(error.message || "Failed to update project", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  if (loading || wsLoading) {
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
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Edit Project</h1>
          <p className="text-muted-foreground">Modify your project details and tracking information.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-slate-500" />
              Project Details
            </CardTitle>
            <CardDescription>
              Update the settings and status of this project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Project Name <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="e.g. Website Redesign"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  placeholder="What is this project about?"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(val) => setEditForm({ ...editForm, status: val })}
                  >
                    <SelectTrigger id="status" className="bg-white">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="health">Health Status</Label>
                  <Select
                    value={editForm.health_status}
                    onValueChange={(val) => setEditForm({ ...editForm, health_status: val })}
                  >
                    <SelectTrigger id="health" className="bg-white">
                      <SelectValue placeholder="Select health" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_set">Not Set</SelectItem>
                      <SelectItem value="on_track">On Track</SelectItem>
                      <SelectItem value="at_risk">At Risk</SelectItem>
                      <SelectItem value="off_track">Off Track</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="bg-white block w-full"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={editForm.end_date}
                    onChange={(e) => setEditForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="bg-white block w-full"
                  />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3 border-t bg-slate-50 p-4">
            <Button type="button" variant="outline" asChild className="cursor-pointer">
              <Link href="/projects">Cancel</Link>
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
