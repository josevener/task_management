"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getMyTasks, updateTaskStatus } from "@/lib/api/tasks";
import { useWorkspace } from "@/contexts/workspace-context";
import type { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, CheckCircle2, ListTodo, Search, FilterX, RotateCcw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/contexts/auth-context";

export default function MyTasksPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupBy, setGroupBy] = useState("status");

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await getMyTasks(user!.id);
      // Only show tasks relevant to the active workspace (since getMyTasks fetches globally)
      // The backend could be updated to filter by workspace, or we do it here.
      // Easiest is to just filter locally if we have workspace info, but the backend doesn't return workspace ID in the Task object currently. 
      // For now, My Tasks implies "All my tasks across everything". We'll just display them all.
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
                            (task.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tasks, searchQuery, statusFilter]);

  // Group tasks
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    
    if (groupBy === 'status') {
      filteredTasks.forEach(task => {
        const status = task.status || 'todo';
        if (!groups[status]) groups[status] = [];
        groups[status].push(task);
      });
    } 
    else if (groupBy === 'project') {
      filteredTasks.forEach(task => {
        const project = task.project_name || 'No Project';
        if (!groups[project]) groups[project] = [];
        groups[project].push(task);
      });
    } 
    else if (groupBy === 'due_date') {
      filteredTasks.forEach(task => {
        let dateGroup = 'No Due Date';
        if (task.due_date) {
          const due = new Date(task.due_date);
          const today = new Date();
          today.setHours(0,0,0,0);
          
          if (due < today) {
            dateGroup = 'Overdue';
          } 
          else if (due.getTime() === today.getTime()) {
            dateGroup = 'Today';
          } 
          else {
            dateGroup = 'Upcoming';
          }
        }
        if (!groups[dateGroup]) groups[dateGroup] = [];
        groups[dateGroup].push(task);
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
    switch(priority) {
      case 'urgent': return <span className="text-red-600 font-bold" title="Urgent">!!!</span>;
      case 'high': return <span className="text-orange-500 font-bold" title="High">!!</span>;
      case 'medium': return <span className="text-blue-500 font-bold" title="Medium">!</span>;
      case 'low': return <span className="text-slate-400 font-bold" title="Low">↓</span>;
      default: return null;
    }
  }

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all";

  const groupOrder = {
    'status': ['todo', 'in_progress', 'review', 'done', 'cancelled'],
    'due_date': ['Overdue', 'Today', 'Upcoming', 'No Due Date']
  };

  const getSortedGroupKeys = () => {
    if (groupBy === 'status') {
      // Return keys sorted by our predefined array, only if they exist in `groupedTasks`
      return groupOrder['status'].filter(k => groupedTasks[k]);
    } 
    else if (groupBy === 'due_date') {
      return groupOrder['due_date'].filter(k => groupedTasks[k]);
    }
    
    // Alphabetical for generic strings like project names
    return Object.keys(groupedTasks).sort();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Tasks</h1>
          <p className="text-muted-foreground mt-1">
            View all tasks assigned to you across all projects.
          </p>
        </div>
        <Button variant="outline" onClick={fetchTasks} disabled={loading} className="shrink-0 cursor-pointer">
          <RotateCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-50 py-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search your tasks..."
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
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>

          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-[140px] bg-white text-sm">
              <SelectValue placeholder="Group By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="status">Group by Status</SelectItem>
              <SelectItem value="project">Group by Project</SelectItem>
              <SelectItem value="due_date">Group by Due Date</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="text-slate-500 hover:text-slate-700 px-3" title="Clear Filters">
              <FilterX className="h-4 w-4" />
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
          <h3 className="text-lg font-semibold text-slate-900">You're all caught up!</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-sm mb-6">
            You don't have any tasks assigned to you right now. Enjoy your free time.
          </p>
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
        <div className="space-y-8">
          {getSortedGroupKeys().map(groupKey => (
            <div key={groupKey} className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 flex items-center gap-2 capitalize">
                {groupKey.replace('_', ' ')}
                <Badge variant="secondary" className="font-normal text-xs">{groupedTasks[groupKey].length}</Badge>
              </h3>
              <div className="grid gap-3">
                {groupedTasks[groupKey].map(task => (
                  <div key={task.id} className="relative group bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center gap-4">
                      
                    <div className="flex-shrink-0 pt-1 sm:pt-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${task.status === 'done' ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-blue-500 text-transparent hover:text-blue-500'}`}>
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'todo')}>To Do</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'in_progress')}>In Progress</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'review')}>Review</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'done')}>Done</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'cancelled')}>Cancelled</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/projects/${task.project_id}`} className="font-medium text-slate-900 hover:text-blue-600 truncate">
                            {task.title}
                          </Link>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1 font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {task.project_name}
                          </span>
                          {task.priority && (
                            <span className="flex items-center gap-1 uppercase tracking-wider text-[10px]">
                              {getPriorityIcon(task.priority)} {task.priority}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:ml-auto">
                        <Badge variant="outline" className={`${getStatusColor(task.status || 'todo')} capitalize text-[10px]`}>
                          {(task.status || 'todo').replace('_', ' ')}
                        </Badge>
                      </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
