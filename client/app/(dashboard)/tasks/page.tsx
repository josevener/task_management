"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getWorkspaceTasks, updateTaskStatus } from "@/lib/api/tasks";
import { useWorkspace } from "@/contexts/workspace-context";
import type { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, CheckCircle2, ListTodo, Search, FilterX, RotateCcw, User, LayoutGrid, List } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/lib/toast";
import { TaskItem } from "@/components/tasks/task-item";

export default function WorkspaceTasksPage() {
  const { activeWorkspace } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [groupBy, setGroupBy] = useState("project");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");

  const fetchTasks = async () => {
    if (!activeWorkspace) return;

    try {
      setLoading(true);
      const res = await getWorkspaceTasks(activeWorkspace.id);
      setTasks(res.tasks || []);
    }
    catch (error) {
      console.error("Failed to load tasks", error);
    }
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [activeWorkspace]);

  // Derive filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.assignee_first_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.assignee_last_name || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter]);

  // Group tasks
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};

    if (groupBy === 'status') {
      filteredTasks.forEach(task => {
        const key = task.status || 'todo';
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
      });
    }
    else if (groupBy === 'project') {
      filteredTasks.forEach(task => {
        const key = task.project_name || 'No Project';
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
      });
    }
    else if (groupBy === 'priority') {
      filteredTasks.forEach(task => {
        const key = task.priority || 'No Priority';
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
      });
    }
    else if (groupBy === 'assignee') {
      filteredTasks.forEach(task => {
        const key = task.assignee_first_name ? `${task.assignee_first_name} ${task.assignee_last_name}` : 'Unassigned';
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
      });
    }

    return groups;
  }, [filteredTasks, groupBy]);

  const handleStatusChange = async (taskId: number, newStatus: Task["status"]) => {
    try {
      // Optimistic update
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      await updateTaskStatus(taskId, newStatus);
      showToast("Task status updated", "success");
    }
    catch (error: any) {
      showToast("Failed to update status", "error");
      fetchTasks(); // Revert on failure
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'review': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'done': return 'bg-green-100 text-green-700 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <span className="text-red-600 font-bold">!!!</span>;
      case 'high': return <span className="text-orange-500 font-bold">!!</span>;
      case 'medium': return <span className="text-blue-500 font-bold">!</span>;
      case 'low': return <span className="text-slate-400 font-bold">↓</span>;
      default: return null;
    }
  }

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
  };

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all" || priorityFilter !== "all";

  const groupOrder = {
    'status': ['todo', 'in_progress', 'review', 'done', 'cancelled'],
    'priority': ['urgent', 'high', 'medium', 'low']
  };

  const getSortedGroupKeys = () => {
    if (groupBy === 'status') {
      return groupOrder['status'].filter(k => groupedTasks[k]);
    }
    else if (groupBy === 'priority') {
      return groupOrder['priority'].filter(k => groupedTasks[k]);
    }
    return Object.keys(groupedTasks).sort();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Workspace Tasks</h1>
          <p className="text-muted-foreground mt-1">
            Track all tasks across <span className="font-medium text-slate-900">{activeWorkspace?.name}</span> in one place. Use filters and grouping to manage your workflow effectively.
          </p>
        </div>
        <Button variant="outline" onClick={fetchTasks} disabled={loading} className="shrink-0 cursor-pointer">
          <RotateCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search tasks, descriptions, or assignees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-white text-sm">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px] bg-white text-sm">
              <SelectValue placeholder="All Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-[140px] bg-white text-sm">
              <SelectValue placeholder="Group By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project">Group by Project</SelectItem>
              <SelectItem value="status">Group by Status</SelectItem>
              <SelectItem value="priority">Group by Priority</SelectItem>
              <SelectItem value="assignee">Group by Assignee</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex border rounded-lg bg-white overflow-hidden h-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("list")}
              className={`rounded-none h-full px-3 ${viewMode === "list" ? "bg-slate-100 text-blue-600" : "text-slate-500"}`}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("grid")}
              className={`rounded-none h-full px-3 ${viewMode === "grid" ? "bg-slate-100 text-blue-600" : "text-slate-500"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="text-slate-500 hover:text-slate-700 px-3 h-10" title="Clear Filters">
              <FilterX className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {loading && tasks.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      ) : tasks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed bg-slate-50">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
            <ListTodo className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No tasks in this workspace</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-sm mb-6">
            Get started by creating a project and adding your first tasks.
          </p>
          <Button asChild>
            <Link href="/projects/new">Create Project</Link>
          </Button>
        </Card>
      ) : filteredTasks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed bg-slate-50">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
            <Search className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No tasks found</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-sm mb-6">
            No tasks match your current filters.
          </p>
          <Button variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
        </Card>
      ) : (
        <div className={viewMode === 'list' ? "space-y-8" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1700px]:grid-cols-6 gap-6 items-start"}>
          {getSortedGroupKeys().map(groupKey => (
            <div key={groupKey} className={viewMode === 'list' ? "space-y-4" : "space-y-4 flex flex-col h-full bg-slate-50/50 p-4 rounded-xl border border-slate-200/60"}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                <span className="truncate pr-2">{groupKey.replace('_', ' ')}</span>
                <Badge variant="secondary" className="font-normal text-xs bg-slate-100 text-slate-600 shrink-0">{groupedTasks[groupKey].length}</Badge>
              </h3>
              <div className={viewMode === 'list' ? "grid gap-3" : "grid gap-4"}>
                {groupedTasks[groupKey].map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    viewMode={viewMode}
                    onStatusChange={handleStatusChange}
                    showProjectName={groupBy !== 'project'}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
