"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  FilterX,
  Inbox,
  LayoutGrid,
  List,
  ListTodo,
  RotateCcw,
  Search,
} from "lucide-react";
import { getMyTasks, updateTaskStatus } from "@/lib/api/tasks";
import { useWorkspace } from "@/contexts/workspace-context";
import type { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/contexts/auth-context";
import { TaskItem } from "@/components/tasks/task-item";

type ViewMode = "list" | "grid";
type GroupBy = "status" | "project" | "due_date";

const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  review: "In review",
  done: "Completed",
  cancelled: "Cancelled",
};

const STATUS_ACCENTS: Record<string, string> = {
  todo: "border-slate-200 bg-slate-50/70 text-slate-700",
  in_progress: "border-blue-200 bg-blue-50/70 text-blue-700",
  review: "border-violet-200 bg-violet-50/70 text-violet-700",
  done: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50/70 text-rose-700",
};

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isTaskOverdue(task: Task) {
  return Boolean(
    task.due_date &&
    new Date(task.due_date) < startOfToday() &&
    task.status !== "done",
  );
}

export default function MyTasksPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [refreshCooldown, setRefreshCooldown] = useState(0);

  const fetchTasks = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return false;
    }

    try {
      setLoading(true);
      setLoadError(false);
      const response = await getMyTasks(user.id);
      setTasks(response.tasks || []);
      return true;
    } catch (error) {
      console.error("Failed to load assigned tasks", error);
      setLoadError(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchTasks();
  }, [activeWorkspace?.id, fetchTasks]);

  useEffect(() => {
    if (refreshCooldown === 0) return;

    const countdownTimer = window.setInterval(() => {
      setRefreshCooldown((remainingSeconds) => Math.max(remainingSeconds - 1, 0));
    }, 1000);

    return () => window.clearInterval(countdownTimer);
  }, [refreshCooldown]);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesSearch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        (task.description || "").toLowerCase().includes(query) ||
        (task.project_name || "").toLowerCase().includes(query);
      return (
        matchesSearch &&
        (statusFilter === "all" || task.status === statusFilter)
      );
    });
  }, [searchQuery, statusFilter, tasks]);

  const summary = useMemo(() => {
    const today = startOfToday();
    return {
      total: tasks.length,
      overdue: tasks.filter(isTaskOverdue).length,
      dueToday: tasks.filter(
        (task) =>
          task.due_date &&
          new Date(task.due_date).getTime() === today.getTime() &&
          task.status !== "done",
      ).length,
      completed: tasks.filter((task) => task.status === "done").length,
    };
  }, [tasks]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    filteredTasks.forEach((task) => {
      let key: string;
      if (groupBy === "status") key = task.status || "todo";
      else if (groupBy === "project") key = task.project_name || "No project";
      else if (isTaskOverdue(task)) key = "Overdue";
      else if (
        task.due_date &&
        new Date(task.due_date).getTime() === startOfToday().getTime()
      )
        key = "Today";
      else if (task.due_date) key = "Upcoming";
      else key = "No due date";
      groups[key] = [...(groups[key] || []), task];
    });
    return groups;
  }, [filteredTasks, groupBy]);

  const sortedGroupKeys = useMemo(() => {
    if (groupBy === "status")
      return ["todo", "in_progress", "review", "done", "cancelled"].filter(
        (key) => groupedTasks[key],
      );
    if (groupBy === "due_date")
      return ["Overdue", "Today", "Upcoming", "No due date"].filter(
        (key) => groupedTasks[key],
      );
    return Object.keys(groupedTasks).sort();
  }, [groupBy, groupedTasks]);

  const handleStatusChange = async (
    taskId: number,
    newStatus: Task["status"],
  ) => {
    const previousTasks = tasks;
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task,
      ),
    );
    try {
      await updateTaskStatus(taskId, newStatus);
      showToast("Task status updated", "success");
    } catch (error) {
      console.error("Failed to update task status", error);
      setTasks(previousTasks);
      showToast("We couldn't update that task. Please try again.", "error");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };
  const hasActiveFilters =
    Boolean(searchQuery.trim()) || statusFilter !== "all";
  const refreshLabel = refreshCooldown > 0
    ? `Refresh in ${Math.floor(refreshCooldown / 60)}:${String(refreshCooldown % 60).padStart(2, "0")}`
    : "Refresh tasks";

  const handleRefresh = async () => {
    if (loading || refreshCooldown > 0) return;
    if (!user) {
      showToast("Please sign in to refresh your assigned tasks.", "error");
      return;
    }

    setRefreshCooldown(120);
    const refreshed = await fetchTasks();
    showToast(
      refreshed ? "Tasks refreshed. You can refresh again in two minutes." : "We couldn't refresh your tasks. Please try again later.",
      refreshed ? "success" : "error",
    );
  };

  return (
    <div className="space-y-2">
      <section className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-sky-50 px-5 py-6 text-slate-900 shadow-sm sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-indigo-200/45 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-36 w-72 rounded-full bg-sky-200/45 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-700">
              <ListTodo className="h-4 w-4" />
              Personal work queue
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              My tasks
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              Keep your next actions visible, move work forward, and spot
              anything that needs attention.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleRefresh()}
            disabled={loading || refreshCooldown > 0}
            title={refreshCooldown > 0 ? `Refresh available in ${refreshCooldown} seconds` : "Refresh assigned tasks"}
            className="shrink-0 border-indigo-200 bg-white/80 text-slate-700 shadow-sm hover:bg-white hover:text-indigo-700"
          >
            <RotateCcw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            {loading ? "Refreshing tasks…" : refreshLabel}
          </Button>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryMetric label="Assigned" value={summary.total} icon={Inbox} />
          <SummaryMetric
            label="Due today"
            value={summary.dueToday}
            icon={CalendarDays}
            tone="text-amber-200"
          />
          <SummaryMetric
            label="Overdue"
            value={summary.overdue}
            icon={AlertTriangle}
            tone="text-rose-200"
          />
          <SummaryMetric
            label="Completed"
            value={summary.completed}
            icon={CheckCircle2}
            tone="text-emerald-200"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Search my tasks"
              placeholder="Search tasks, descriptions, or projects"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 border-slate-200 bg-slate-50 pl-9 shadow-none focus-visible:bg-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-[142px] border-slate-200 bg-white text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="todo">To do</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="review">In review</SelectItem>
                <SelectItem value="done">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={groupBy}
              onValueChange={(value: GroupBy) => setGroupBy(value)}
            >
              <SelectTrigger className="h-10 w-[160px] border-slate-200 bg-white text-sm">
                <SelectValue placeholder="Group tasks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Group by status</SelectItem>
                <SelectItem value="project">Group by project</SelectItem>
                <SelectItem value="due_date">Group by due date</SelectItem>
              </SelectContent>
            </Select>
            <div
              className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 p-1"
              aria-label="Choose task view"
            >
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={
                  viewMode === "list"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500"
                }
              >
                <List />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={
                  viewMode === "grid"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500"
                }
              >
                <LayoutGrid />
              </Button>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="h-10 text-slate-600"
              >
                <FilterX className="mr-2 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 px-1 pt-3 text-xs text-slate-500">
          <span>
            {filteredTasks.length}{" "}
            {filteredTasks.length === 1 ? "task" : "tasks"} shown
          </span>
          {activeWorkspace?.name && (
            <span className="hidden sm:inline">
              Viewing work assigned to you
            </span>
          )}
        </div>
      </section>

      {loading && tasks.length === 0 ? (
        <TaskSkeletons />
      ) : loadError ? (
        <EmptyState
          icon={AlertTriangle}
          title="We couldn't load your tasks"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void fetchTasks()}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="You're all caught up"
          description="No tasks are assigned to you right now. New work will appear here when it is assigned."
        />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching tasks"
          description="Try changing your search or clearing the current filters."
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      ) : (
        <div
          className={
            viewMode === "grid" ? "grid gap-5 xl:grid-cols-2" : "space-y-6"
          }
        >
          {sortedGroupKeys.map((groupKey) => {
            const groupLabel =
              groupBy === "status" ? STATUS_LABELS[groupKey] : groupKey;
            const accent =
              groupBy === "status"
                ? STATUS_ACCENTS[groupKey]
                : "border-slate-200 bg-slate-50/70 text-slate-700";
            return (
              <section
                key={groupKey}
                className={`rounded-2xl border p-3 sm:p-4 ${accent}`}
              >
                <header className="mb-3 flex items-center justify-between gap-3 px-1">
                  <div>
                    <h2 className="text-sm font-semibold">{groupLabel}</h2>
                    <p className="mt-0.5 text-xs opacity-75">
                      {groupedTasks[groupKey].length}{" "}
                      {groupedTasks[groupKey].length === 1 ? "task" : "tasks"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-current bg-white/60 font-semibold text-inherit"
                  >
                    {groupedTasks[groupKey].length}
                  </Badge>
                </header>
                <div
                  className={
                    viewMode === "grid"
                      ? "grid gap-3 sm:grid-cols-2"
                      : "grid gap-3"
                  }
                >
                  {groupedTasks[groupKey].map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      viewMode={viewMode}
                      onStatusChange={handleStatusChange}
                      showProjectName={groupBy !== "project"}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  icon: Icon,
  tone = "text-indigo-600",
}: {
  label: string;
  value: number;
  icon: typeof Inbox;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/75 p-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof Inbox;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="flex min-h-72 flex-col items-center justify-center border-dashed border-slate-300 bg-slate-50/70 p-8 text-center shadow-none">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="outline" onClick={onAction} className="mt-5">
          {actionLabel}
        </Button>
      )}
    </Card>
  );
}

function TaskSkeletons() {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
        >
          <div className="mb-4 h-5 w-24 animate-pulse rounded bg-slate-200" />
          <div className="space-y-3">
            <div className="h-32 animate-pulse rounded-xl bg-white" />
            <div className="h-32 animate-pulse rounded-xl bg-white" />
          </div>
        </div>
      ))}
    </div>
  );
}
