"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CheckCircle2, Clock, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { getAllProjects } from "@/lib/api/projects";
import { getMyTasks } from "@/lib/api/tasks";
import type { Project, Task } from "@/lib/types";
import { useToast } from "@/lib/toast";

export default function DashboardPage() {
  const { user } = useAuth();
  const { hasPermission } = useWorkspace();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    async function fetchData() {
      if (!user?.id) return;

      try {
        setIsLoading(true);
        // Fetch projects and tasks concurrently
        const [projectsRes, tasksRes] = await Promise.all([
          getAllProjects(),
          getMyTasks(user.id)
        ]);

        setProjects(projectsRes.projects || []);
        setTasks(tasksRes.tasks || []);
      }
      catch (error: any) {
        showToast("Failed to load dashboard data", "error");
        console.log(error);
      }
      finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [user?.id, showToast]);

  // Compute Metrics
  const now = new Date();

  const overdueTasks = tasks.filter(t =>
    t.status !== 'done' &&
    t.due_date &&
    new Date(t.due_date) < now
  ).length;

  const next7Days = new Date();
  next7Days.setDate(now.getDate() + 7);

  const dueSoonTasks = tasks.filter(t =>
    t.status !== 'done' &&
    t.due_date &&
    new Date(t.due_date) >= now &&
    new Date(t.due_date) <= next7Days
  ).length;

  const completedTasks = tasks.filter(t => t.status === 'done').length;

  // Recent Projects (sort by updated_at or created_at, take top 5)
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // Upcoming Tasks (sort by due_date ascending, exclude done)
  const upcomingTasks = [...tasks]
    .filter(t => t.status !== 'done')
    .sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    })
    .slice(0, 5);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'done': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'review': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'on_hold': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'todo':
      case 'active':
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Welcome back, {user?.first_name || "User"}
        </h1>
        <p className="text-muted-foreground mt-2">
          Here's an overview of your workspaces and upcoming tasks.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="text-3xl font-bold text-slate-900">{overdueTasks}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {overdueTasks > 0 ? "Requires attention!" : "Keep it up!"}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Due Soon</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="text-3xl font-bold text-slate-900">{dueSoonTasks}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Due within 7 days</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="text-3xl font-bold text-slate-900">{completedTasks}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total completed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Projects Card */}
        <Card className="col-span-1 flex flex-col shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Projects</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-blue-600 hover:text-blue-800 cursor-pointer">
                <Link href="/projects">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 h-full">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 border border-slate-200">
                  <Plus className="h-6 w-6 text-slate-500" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">No projects yet</h3>
                <p className="mt-1 text-sm text-slate-500 max-w-[200px] mx-auto">
                  Get started by creating a new project.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-semibold border border-blue-200">
                      {project.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                        {project.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {/* @ts-ignore - project may have workspace_name joined in depending on API */}
                        {project.workspace_name || 'Project'}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <Badge variant="outline" className={`capitalize ${getStatusColor(project.status)}`}>
                        {project.status.replace('_', ' ')}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
          {recentProjects.length > 0 && hasPermission('projects:create') && (
            <CardFooter className="p-4 border-t bg-slate-50 mt-auto">
              <Button asChild className="w-full bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 cursor-pointer shadow-sm">
                <Link href="/projects/new">
                  <Plus className="mr-2 h-4 w-4" /> Create New Project
                </Link>
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* My Upcoming Tasks Card */}
        <Card className="col-span-1 flex flex-col shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Upcoming Tasks</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-blue-600 hover:text-blue-800 cursor-pointer">
                <Link href="/my-tasks">My Tasks</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-4 w-4 rounded" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : upcomingTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 h-full">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 border border-slate-200">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">You're all caught up!</h3>
                <p className="mt-1 text-sm text-slate-500 max-w-[200px] mx-auto">
                  There are no tasks assigned to you right now.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {upcomingTasks.map((task) => {
                  const isOverdue = task.due_date && new Date(task.due_date) < now;
                  return (
                    <Link
                      key={task.id}
                      href={`/projects/${task.project_id}/tasks/${task.id}/edit`}
                      className="flex items-start gap-3 p-4 hover:bg-slate-50 transition-colors group cursor-pointer"
                    >
                      <div className="mt-0.5 shrink-0">
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${getStatusColor(task.status).replace('bg-', 'border-').replace('100', '400')} bg-white`}>
                          {task.status === 'done' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate transition-colors group-hover:text-blue-700 ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </Badge>
                          {/* @ts-ignore - joined project name from API */}
                          {task.project_name && (
                            <span className="text-[11px] text-slate-500 flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                              {task.project_name}
                            </span>
                          )}
                          {task.due_date && (
                            <span className={`text-[11px] flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                              <Clock className="h-3 w-3" />
                              {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              {isOverdue && ' (Overdue)'}
                            </span>
                          )}
                          {task.assigner_first_name ? (
                            <span className="text-[11px] text-slate-400">
                              • Assigned by {task.assigned_by === task.assignee_id ? "Me" : `${task.assigner_first_name} ${task.assigner_last_name ? task.assigner_last_name[0] + '.' : ''}`}
                            </span>
                          ) : task.creator_first_name ? (
                            <span className="text-[11px] text-slate-400">
                              • Created by {task.creator_first_name} {task.creator_last_name ? task.creator_last_name[0] + '.' : ''}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
