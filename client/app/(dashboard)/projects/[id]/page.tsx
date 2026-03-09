"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { getProject } from "@/lib/api/projects";
import { getTasks } from "@/lib/api/tasks";
import type { Project, Task } from "@/lib/types";
import { KanbanBoard } from "@/components/projects/kanban-board";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { TaskDetailSheet } from "@/components/projects/task-detail-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban, Plus, Clock, Users, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ProjectDetailsPage() {
  const params = useParams();
  const projectId = parseInt(params.id as string);
  const { activeWorkspace } = useWorkspace();
  
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Sheet State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    async function loadProjectData() {
      if (!activeWorkspace || isNaN(projectId)) return;
      
      try {
        setLoading(true);
        const [projectRes, tasksRes] = await Promise.all([
          getProject(activeWorkspace.id, projectId),
          getTasks(projectId)
        ]);
        
        setProject(projectRes.project);
        setTasks(tasksRes.tasks || []);
        setError(null);
      } catch (err: any) {
        console.error("Failed to load project details", err);
        setError("Could not load project information. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadProjectData();
  }, [activeWorkspace, projectId]);

  const handleTaskCreated = (newTask: Task) => {
    setTasks(prev => [...prev, newTask]);
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    setSelectedTask(updatedTask); // refresh sheet data
  };

  const handleTaskDeleted = (deletedId: number) => {
    setTasks(prev => prev.filter(t => t.id !== deletedId));
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="bg-red-50 p-4 rounded-full">
          <FolderKanban className="h-10 w-10 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Error Loading Project</h2>
        <p className="text-slate-600">{error}</p>
        <Button asChild variant="outline">
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
      <div className="space-y-6">
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

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Project Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{project.name}</h1>
            <Badge variant="secondary" className="capitalize">
              {project.status.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            {project.end_date && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Due {new Date(project.end_date).toLocaleDateString()}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {project.owner_first_name} {project.owner_last_name}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" className="hidden sm:flex" asChild>
            <Link href="/projects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Projects
            </Link>
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard 
            initialTasks={tasks} 
            projectId={project.id} 
            onTaskClick={(task) => setSelectedTask(task)}
        />
      </div>

      <CreateTaskDialog 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        projectId={project.id}
        onTaskCreated={handleTaskCreated}
      />

      <TaskDetailSheet
        isOpen={!!selectedTask}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />
    </div>
  );
}
