"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { getProjects, deleteProject } from "@/lib/api/projects";
import { filterProjects } from "@/lib/project-filters";
import type { Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderKanban,
  Plus,
  Calendar,
  MoreHorizontal,
  Search,
  FilterX,
  Loader2,
  ArrowRight,
  UserRound,
  SlidersHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/lib/toast";

export default function ProjectsPage() {
  const router = useRouter();
  const { activeWorkspace, hasPermission } = useWorkspace();
  const { user } = useAuth();
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
    } catch (error) {
      console.error("Failed to load projects", error);
    } finally {
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
    } catch (error: any) {
      showToast(error.message || "Failed to delete project", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProjects = useMemo(
    () => filterProjects(projects, searchQuery, statusFilter, healthFilter),
    [projects, searchQuery, statusFilter, healthFilter],
  );

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setHealthFilter("all");
  };

  const hasActiveFilters =
    searchQuery !== "" || statusFilter !== "all" || healthFilter !== "all";

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="bg-slate-100 p-4 rounded-full">
          <FolderKanban className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold">No Workspace Selected</h2>
        <p className="text-muted-foreground max-w-md">
          Please select a workspace from the sidebar or create a new one to view
          and manage your projects.
        </p>
        <Button
          asChild
          className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
        >
          <Link href="/workspaces/new">Create Workspace</Link>
        </Button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "on_hold":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "archived":
        return "bg-slate-100 text-slate-800 border-slate-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case "on_track":
        return "bg-green-500";
      case "at_risk":
        return "bg-amber-500";
      case "off_track":
        return "bg-red-500";
      default:
        return "bg-slate-300";
    }
  };

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Projects
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 sm:text-base">
            Organize work and keep every project moving in{" "}
            <span className="font-medium text-slate-800">
              {activeWorkspace.name}
            </span>
            .
          </p>
        </div>
        {hasPermission("projects:create") && (
          <Button
            asChild
            className="h-10 shrink-0 bg-indigo-600 px-4 text-sm text-white hover:bg-indigo-700 cursor-pointer"
          >
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 border-slate-200 bg-slate-50 pl-9 text-sm shadow-none focus-visible:bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-[145px] border-slate-200 bg-white text-sm">
              <SlidersHorizontal className="mr-2 h-4 w-4 text-slate-500" />
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
            <SelectTrigger className="h-10 w-[145px] border-slate-200 bg-white text-sm">
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
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="h-10 text-slate-500 hover:bg-slate-100 hover:text-slate-700 px-3 cursor-pointer"
              title="Clear Filters"
            >
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
          <h3 className="text-lg font-semibold text-slate-900">
            No projects yet
          </h3>
          <p className="mt-2 text-sm text-slate-500 max-w-sm mb-6">
            Get started by creating your first project in this workspace.
          </p>
          {hasPermission("projects:create") && (
            <Button
              asChild
              className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
            >
              <Link href="/projects/new">Create First Project</Link>
            </Button>
          )}
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed bg-slate-50">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
            <Search className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            No projects found
          </h3>
          <p className="mt-2 text-sm text-slate-500 max-w-sm mb-6">
            We couldn't find any projects matching your current filters.
          </p>
          <Button
            variant="outline"
            onClick={clearFilters}
            className="cursor-pointer"
          >
            Clear Filters
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map((project) => {
            const canEditProject =
              project.owner_id === user?.id || hasPermission("projects:edit");
            const canDeleteProject =
              project.owner_id === user?.id || hasPermission("projects:delete");

            return (
              <article
                key={project.id}
                className="group rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:border-indigo-200 hover:shadow-md"
              >
                <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(8rem,.7fr)_minmax(7rem,.6fr)_minmax(7rem,.6fr)_minmax(7.5rem,.65fr)_auto] lg:items-center lg:gap-4">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2
                        className="truncate text-base font-semibold text-slate-900 transition-colors group-hover:text-indigo-700"
                        title={project.name}
                      >
                        {project.name}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                        {project.description || "No description provided."}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 lg:border-l lg:border-slate-100 lg:pl-4">
                    <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                      Owner
                    </span>
                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white">
                        {project.owner_first_name ? (
                          `${project.owner_first_name[0]}${project.owner_last_name?.[0] || ""}`.toUpperCase()
                        ) : (
                          <UserRound className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <span className="truncate">
                        {project.owner_first_name
                          ? `${project.owner_first_name} ${project.owner_last_name || ""}`
                          : "Project owner"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 lg:border-l lg:border-slate-100 lg:pl-4">
                    <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                      Due date
                    </span>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                      <span>
                        {project.end_date
                          ? new Date(project.end_date).toLocaleDateString()
                          : "No due date"}
                      </span>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1.5 lg:border-l lg:border-slate-100 lg:pl-4">
                    <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                      Tasks
                    </span>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="shrink-0 font-medium text-slate-700">
                        {project.completed_tasks ?? 0}/
                        {project.total_tasks ?? 0}
                      </span>
                    </div>
                    <Progress
                      value={project.progress_percentage || 0}
                      className="h-1.5"
                    />
                  </div>

                  <div className="space-y-1.5 lg:border-l lg:border-slate-100 lg:pl-4">
                    <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </span>
                    <Badge
                      variant="outline"
                      className={`${getStatusColor(project.status)} capitalize whitespace-nowrap`}
                    >
                      <span
                        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${getHealthColor(project.health_status)}`}
                      />
                      {project.status.replace("_", " ")}
                    </Badge>
                  </div>

                  <div
                    className="flex items-center justify-end gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 cursor-pointer"
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      Open <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-9 w-9 p-0 text-slate-500 hover:bg-slate-100 cursor-pointer"
                          >
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEditProject && (
                            <DropdownMenuItem
                              className="cursor-pointer"
                              asChild
                            >
                              <Link href={`/projects/${project.id}/edit`}>
                                Edit project
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {canDeleteProject && (
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600 cursor-pointer"
                              onClick={() => setDeletingProject(project)}
                            >
                              Delete project
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Delete Project Dialog */}
      <Dialog
        open={!!deletingProject}
        onOpenChange={(open) => !open && setDeletingProject(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deletingProject?.name}</strong>? This action cannot be
              undone and will permanently delete all associated tasks, comments,
              and files.
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
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
