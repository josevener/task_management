"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Users,
  Bell,
  History,
  UserPlus,
  LayoutGrid,
  TrendingUp,
  Briefcase
} from "lucide-react";
import Link from "next/link";
import { getAllProjects } from "@/lib/api/projects";
import { getMyTasks } from "@/lib/api/tasks";
import { getWorkspaceMembers, type WorkspaceMember } from "@/lib/api/members";
import { notificationApi, type Notification } from "@/lib/api/notifications";
import { InviteMemberModal } from "@/components/modals/InviteMemberModal";
import type { Project, Task } from "@/lib/types";
import { useToast } from "@/lib/toast";

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeWorkspace, hasPermission } = useWorkspace();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!user?.id || !activeWorkspace?.id) return;

      try {
        setIsLoading(true);
        // Fetch base data concurrently
        const fetchPromises: Promise<any>[] = [
          getAllProjects(),
          getMyTasks(user.id),
          notificationApi.getNotifications()
        ];

        // Only fetch members if user has permission
        if (hasPermission('members:read')) {
          fetchPromises.push(getWorkspaceMembers(activeWorkspace.id));
        }

        const results = await Promise.all(fetchPromises);

        const projectsRes = results[0];
        const tasksRes = results[1];
        const notificationsRes = results[2];
        const membersRes = results[3];

        setProjects(projectsRes.projects || []);
        setTasks(tasksRes.tasks || []);

        if (notificationsRes.success) {
          setRecentNotifications(notificationsRes.data.notifications.slice(0, 5) || []);
        }

        if (membersRes) {
          setMembers(membersRes.members || []);
        }
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
  }, [user?.id, activeWorkspace?.id, showToast, hasPermission]);

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
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Welcome & Quick Actions Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Welcome back, {user?.first_name || "User"}
          </h1>
          <p className="text-muted-foreground mt-2">
            Workspace: <span className="font-semibold text-slate-700">{activeWorkspace?.name || "Loading..."}</span> • Here's what's happening today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {hasPermission('projects:create') && (
            <Button asChild variant="outline" className="bg-white border-slate-200 hover:bg-slate-50 shadow-sm transition-all hover:translate-y-[-1px]">
              <Link href="/projects/new">
                <LayoutGrid className="mr-2 h-4 w-4 text-blue-600" />
                New Project
              </Link>
            </Button>
          )}
          {hasPermission('members:invite') && (
            <Button 
              onClick={() => setIsInviteModalOpen(true)}
              variant="outline" 
              className="bg-white border-slate-200 hover:bg-slate-50 shadow-sm transition-all hover:translate-y-[-1px] cursor-pointer"
            >
              <UserPlus className="mr-2 h-4 w-4 text-indigo-600" />
              Invite Team
            </Button>
          )}
          <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all hover:translate-y-[-2px] active:translate-y-0 text-slate-50">
            <Link href="/tasks/new">
              <Plus className="mr-2 h-4 w-4" />
              Quick Task
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Metrics Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-none shadow-sm bg-gradient-to-br from-white to-slate-50 group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-1 group-hover:scale-110 transition-transform">
            <AlertCircle size={64} color="red" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Overdue Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-16 mb-1" />
            ) : (
              <div className="text-3xl font-bold text-slate-900">{overdueTasks}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {overdueTasks > 0 ? (
                <span className="text-red-500 font-medium">Requires attention</span>
              ) : (
                <span className="text-green-600 font-medium">Clear for now</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-sm bg-gradient-to-br from-white to-slate-50 group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-1 group-hover:scale-110 transition-transform">
            <Clock size={64} color="orange" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Due Soon</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-16 mb-1" />
            ) : (
              <div className="text-3xl font-bold text-slate-900">{dueSoonTasks}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Due within 7 days</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-sm bg-gradient-to-br from-white to-slate-50 group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-1 group-hover:scale-110 transition-transform">
            <CheckCircle2 size={64} color="green" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-16 mb-1" />
            ) : (
              <div className="text-3xl font-bold text-slate-900">{completedTasks}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              Total accomplished
            </p>
          </CardContent>
        </Card>

        {hasPermission('members:read') && (
          <Card className="relative overflow-hidden border-none shadow-sm bg-gradient-to-br from-white to-slate-50 group hover:shadow-md transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-1 group-hover:scale-110 transition-transform">
              <Users size={64} color="blue" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Team Size</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-9 w-16 mb-1" />
              ) : (
                <div className="text-3xl font-bold text-slate-900">{members.length}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Active workspace members</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-6 lg:grid-cols-12">
        {/* Recent Projects Section */}
        <Card className="md:col-span-6 lg:col-span-8 flex flex-col shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Recent Projects</CardTitle>
                  <CardDescription className="text-xs">Projects you've worked on recently</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors">
                <Link href="/projects" className="flex items-center gap-1">
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
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
              <div className="flex flex-col items-center justify-center p-12 text-center bg-white h-full">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 shadow-sm text-slate-400">
                  <LayoutGrid className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">No projects found</h3>
                <p className="mt-2 text-sm text-slate-500 max-w-[240px] mx-auto">
                  Start by creating your first project to organize your team's tasks.
                </p>
                {hasPermission('projects:create') && (
                  <Button asChild variant="outline" size="sm" className="mt-4 border-dashed">
                    <Link href="/projects/new">Create Project</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center gap-4 p-5 hover:bg-slate-50 transition-all group relative overflow-hidden"
                  >
                    <div className="h-12 w-12 shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold shadow-md shadow-blue-100 group-hover:scale-105 transition-transform duration-300">
                      {project.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                          {project.name}
                        </p>
                        <Badge variant="outline" className={`text-[10px] h-4.5 px-1.5 font-normal capitalize ${getStatusColor(project.status)}`}>
                          {project.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {project.workspace_name || 'Project Team'}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <div className="flex -space-x-2 overflow-hidden px-1">
                        {/* Placeholder for project members avatars */}
                        <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-200"></div>
                        <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-300 font-medium text-[8px] flex items-center justify-center">+2</div>
                      </div>
                      <p className="text-[10px] text-slate-400">Updated {new Date(project.updated_at || project.created_at).toLocaleDateString()}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workspace Activity / Notifications Section */}
        <Card className="md:col-span-6 lg:col-span-4 flex flex-col shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <History className="h-5 w-5 text-indigo-600" />
              </div>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex space-x-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-white h-full grayscale opacity-60">
                <Bell className="h-10 w-10 text-slate-300 mb-3" />
                <h3 className="text-sm font-medium text-slate-500">No recent activity</h3>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {recentNotifications.map((notif) => (
                  <div key={notif.id} className="p-4 hover:bg-slate-50/80 transition-colors">
                    <div className="flex gap-3">
                      <div className={`mt-0.5 h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${notif.type === 'task_assigned' ? 'bg-blue-50 text-blue-600' :
                        notif.type === 'comment' ? 'bg-purple-50 text-purple-600' : 'bg-slate-50 text-slate-600'
                        }`}>
                        {notif.type === 'task_assigned' ? <Briefcase className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-900 font-medium leading-tight mb-0.5">
                          {notif.title}
                        </p>
                        <p className="text-xs text-slate-500 line-clamp-1 mb-1">
                          {notif.message}
                        </p>
                        <time className="text-[10px] text-slate-400">
                          {new Date(notif.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                        </time>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <CardFooter className="p-3 border-t bg-slate-50/30">
              <Button variant="link" size="sm" asChild className="w-full text-slate-500 text-xs h-auto py-0">
                <Link href="/notifications">View all notifications</Link>
              </Button>
            </CardFooter>
          </CardContent>
        </Card>

        {/* Upcoming Tasks Section */}
        <Card className="md:col-span-6 lg:col-span-8 flex flex-col shadow-sm border-slate-200 overflow-hidden lg:order-last xl:order-none">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <CardTitle className="text-lg">Upcoming Tasks</CardTitle>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-amber-700 hover:text-amber-800 hover:bg-amber-50">
                <Link href="/my-tasks" className="flex items-center gap-1">
                  My Tasks <ArrowRight className="h-3.5 w-3.5" />
                </Link>
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
              <div className="flex flex-col items-center justify-center p-12 text-center bg-white h-full">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 border border-green-100 shadow-sm text-green-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">You're all caught up!</h3>
                <p className="mt-2 text-sm text-slate-500 max-w-[240px] mx-auto">
                  No upcoming tasks are currently assigned to you. Enjoy the peace or start something new!
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href="/tasks/new">Add Task</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingTasks.map((task) => {
                  const isOverdue = task.due_date && new Date(task.due_date) < now;
                  return (
                    <Link
                      key={task.id}
                      href={`/projects/${task.project_id}/tasks/${task.id}/edit`}
                      className="flex items-start gap-4 p-5 hover:bg-slate-50 transition-all group"
                    >
                      <div className="mt-0.5 shrink-0">
                        <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === 'done' ? 'bg-green-100 border-green-500' : 'bg-white border-slate-300 group-hover:border-blue-500 shadow-sm'
                          }`}>
                          {task.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate transition-colors group-hover:text-blue-700 ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] h-4.5 px-2 py-0 font-medium capitalize border-none ${getPriorityColor(task.priority)} shadow-sm`}>
                            {task.priority}
                          </Badge>
                          {task.project_name && (
                            <span className="text-[11px] text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              {task.project_name}
                            </span>
                          )}
                          {task.due_date && (
                            <span className={`text-[11px] flex items-center gap-1 px-2 py-0.5 rounded-full border ${isOverdue ? 'bg-red-50 text-red-600 border-red-100 font-medium' : 'bg-slate-50 text-slate-500 border-slate-200'
                              }`}>
                              <Clock className="h-3 w-3" />
                              {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              {isOverdue && ' (Overdue)'}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Section (Visible to Admins/Managers) */}
        {hasPermission('members:read') && (
          <Card className="md:col-span-6 lg:col-span-4 flex flex-col shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="pb-3 border-b bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-lg">Team Overview</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center space-x-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-2 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {members.slice(0, 6).map((member) => (
                    <div key={member.user_id} className="p-4 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-medium text-xs shadow-sm">
                        {member.first_name[0]}{member.last_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {member.first_name} {member.last_name}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                          {member.role}
                        </p>
                      </div>
                      <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {hasPermission('members:invite') && (
              <CardFooter className="p-3 border-t bg-slate-50/30">
                <Button variant="ghost" size="sm" asChild className="w-full text-blue-600 text-xs hover:bg-blue-50">
                  <Link href={`/workspaces/${activeWorkspace?.id}/members`}>Manage Team Members</Link>
                </Button>
              </CardFooter>
            )}
          </Card>
        )}
      </div>

      {activeWorkspace && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          workspaceId={activeWorkspace.id}
          onSuccess={() => {
            // Optionally refresh members list in dashboard
            if (activeWorkspace) {
              getWorkspaceMembers(activeWorkspace.id).then(res => setMembers(res.members || []));
            }
          }}
        />
      )}
    </div>
  );
}
