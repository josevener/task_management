"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { getProjects, updateProject, deleteProject } from "@/lib/api/projects";
import type { Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderKanban, Plus, Calendar, Clock, MoreHorizontal, Search, FilterX, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/lib/toast";

export default function ProjectsPage() {
  const { activeWorkspace } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");

  // Delete state
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProjects = async () => {
    if (!activeWorkspace) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await getProjects(activeWorkspace.id);
      setProjects(res.projects || []);
    }
    catch (error) {
      console.error("Failed to load projects", error);
    }
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [activeWorkspace]);

  const handleDeleteSubmit = async () => {
    if (!deletingProject) return;

    try {
      setIsSubmitting(true);
      await deleteProject(deletingProject.id);
      showToast("Project deleted successfully", "success");
      setDeletingProject(null);
      fetchProjects();
    }
    catch (error: any) {
      showToast(error.message || "Failed to delete project", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };



  // Derive filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      // Search matching
      const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.description || "").toLowerCase().includes(searchQuery.toLowerCase());

      // Status matching
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;

      // Health matching
      const matchesHealth = healthFilter === "all" || project.health_status === healthFilter;

      return matchesSearch && matchesStatus && matchesHealth;
    });
  }, [projects, searchQuery, statusFilter, healthFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setHealthFilter("all");
  };

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all" || healthFilter !== "all";

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="bg-slate-100 p-4 rounded-full">
          <FolderKanban className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold">No Workspace Selected</h2>
        <p className="text-muted-foreground max-w-md">
          Please select a workspace from the sidebar or create a new one to view and manage your projects.
        </p>
        <Button asChild className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
          <Link href="/workspaces/new">Create Workspace</Link>
        </Button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'on_hold': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'archived': return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'on_track': return 'bg-green-500';
      case 'at_risk': return 'bg-amber-500';
      case 'off_track': return 'bg-red-500';
      default: return 'bg-slate-300';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Projects</h1>
          <p className="text-muted-foreground">
            Manage projects for <span className="font-semibold">{activeWorkspace.name}</span>
          </p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700 shrink-0 cursor-pointer">
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-50 py-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <div className="flex gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-white text-sm">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select value={healthFilter} onValueChange={setHealthFilter}>
            <SelectTrigger className="w-[140px] bg-white text-sm">
              <SelectValue placeholder="All Health" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Health</SelectItem>
              <SelectItem value="on_track">On Track</SelectItem>
              <SelectItem value="at_risk">At Risk</SelectItem>
              <SelectItem value="off_track">Off Track</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="text-slate-500 hover:text-slate-700 px-3 cursor-pointer" title="Clear Filters">
              <FilterX className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      ) : projects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed bg-slate-50">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
            <FolderKanban className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No projects yet</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-sm mb-6">
            Get started by creating your first project in this workspace.
          </p>
          <Button asChild className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
            <Link href="/projects/new">Create First Project</Link>
          </Button>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed bg-slate-50">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
            <Search className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No projects found</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-sm mb-6">
            We couldn't find any projects matching your current filters.
          </p>
          <Button variant="outline" onClick={clearFilters} className="cursor-pointer">
            Clear Filters
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="flex flex-col hover:shadow-md transition-shadow">
              {/* Existing Card Content mapped over filteredProjects */}
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg truncate pr-4" title={project.name}>
                      <Link href={`/projects/${project.id}`} className="hover:text-blue-600 transition-colors">
                        {project.name}
                      </Link>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${getStatusColor(project.status)} capitalize`}>
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 -mr-2 cursor-pointer">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer"
                      >
                        <Link href={`/projects/${project.id}`}>View details</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        asChild
                      >
                        <Link href={`/projects/${project.id}/edit`}>Edit project</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600 cursor-pointer"
                        onClick={() => setDeletingProject(project)}
                      >
                        Delete project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                <p className="text-sm text-slate-600 line-clamp-2 mb-4 h-10">
                  {project.description || "No description provided."}
                </p>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Progress</span>
                      <span>{project.progress_percentage || 0}%</span>
                    </div>
                    <Progress value={project.progress_percentage || 0} className="h-2" />
                  </div>

                  <div className="flex flex-col gap-2 text-xs text-slate-500">
                    {project.end_date && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Due {new Date(project.end_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block bg-slate-200 relative">
                        <span className={`absolute inset-0 rounded-full ${getHealthColor(project.health_status)}`}></span>
                      </span>
                      <span className="capitalize">{project.health_status.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Project Dialog */}
      <Dialog open={!!deletingProject} onOpenChange={(open) => !open && setDeletingProject(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingProject?.name}</strong>? This action cannot be undone and will permanently delete all associated tasks, comments, and files.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setDeletingProject(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              onClick={handleDeleteSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
