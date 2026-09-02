"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { getProject } from "@/lib/api/projects";
import { getTasks } from "@/lib/api/tasks";
import type { Project, Task } from "@/lib/types";
import { KanbanBoard } from "@/components/projects/kanban-board";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban, Plus, Clock, Users, ArrowLeft, Pencil, ListTodo } from "lucide-react";
import Link from "next/link";

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { activeWorkspace, hasPermission } = useWorkspace();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjectData() {
      if (!activeWorkspace || !projectId) return;

      try {
        setLoading(true);
        const [projectRes, tasksRes] = await Promise.all([
          getProject(projectId),
          getTasks(projectId)
        ]);

        setProject(projectRes.project);
        setTasks(tasksRes.tasks || []);
        setError(null);
      }
      catch (err: any) {
        console.error("Failed to load project details", err);
        setError("Could not load project information. Please try again.");
      }
      finally {
        setLoading(false);
      }
    }

    loadProjectData();
  }, [activeWorkspace, projectId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="bg-red-50 p-4 rounded-full">
          <FolderKanban className="h-10 w-10 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Error Loading Project</h2>
        <p className="text-slate-600">{error}</p>
        <Button asChild variant="outline" className="cursor-pointer">
          <Link href="/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex gap-6 mt-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[500px] w-80 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) return null;
  const canCreateTasks = hasPermission('tasks:create');
  const canEditProject = hasPermission('projects:edit');

  return (
    <div className="flex w-full flex-col gap-4">
      <section className="relative shrink-0 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-sky-50 px-5 py-5 shadow-sm sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-200/45 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-3xl lg:pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{project.name}</h1>
              <Badge variant="outline" className="border-indigo-200 bg-white/70 capitalize text-indigo-700">{project.status.replace('_', ' ')}</Badge>
            </div>
            {project.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{project.description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
              {project.end_date && <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-indigo-500" />Due {new Date(project.end_date).toLocaleDateString()}</span>}
              <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-indigo-500" />{project.owner_first_name} {project.owner_last_name}</span>
              <span className="inline-flex items-center gap-1.5"><ListTodo className="h-4 w-4 text-indigo-500" />{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</span>
            </div>
          </div>

          <div className="flex w-full flex-wrap gap-2 border-t border-indigo-100 pt-4 lg:w-auto lg:shrink-0 lg:flex-nowrap lg:border-t-0 lg:pt-0">
            <Button variant="outline" className="h-10 border-indigo-200 bg-white/80 text-slate-700 hover:bg-white" asChild>
              <Link href="/projects"><ArrowLeft className="mr-2 h-4 w-4" />Projects</Link>
            </Button>
            {canEditProject && <Button variant="outline" className="h-10 border-indigo-200 bg-white/80 text-slate-700 hover:bg-white" asChild><Link href={`/projects/${project.id}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit project</Link></Button>}
            {canCreateTasks ? (
              <Button className="h-10 bg-indigo-600 text-white hover:bg-indigo-700" asChild><Link href={`/projects/${project.id}/tasks/new`}><Plus className="mr-2 h-4 w-4" />Add task</Link></Button>
            ) : (
              <Button className="h-10" disabled title="You do not have permission to create tasks in this workspace"><Plus className="mr-2 h-4 w-4" />Add task</Button>
            )}
          </div>
        </div>
      </section>

      <section className="min-h-[34rem] overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <KanbanBoard
          initialTasks={tasks}
          projectId={project.id}
          onTaskClick={(task) => router.push(`/projects/${project.id}/tasks/${task.id}/edit`)}
        />
      </section>
    </div>
  );
}
