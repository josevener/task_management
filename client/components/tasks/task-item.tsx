"use client";

import Link from "next/link";
import { ArrowDown, CalendarDays, CheckCircle2, CircleDot, Flag, Layers3, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Task } from "@/lib/types";

interface TaskItemProps {
  task: Task;
  viewMode: "list" | "grid";
  onStatusChange?: (taskId: number, newStatus: Task["status"]) => void;
  canUpdateStatus?: boolean;
  showProjectName?: boolean;
}

const STATUS_STYLES: Record<Task["status"], string> = {
  todo: "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
  review: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
};

const PRIORITY_STYLES: Record<Task["priority"], string> = {
  urgent: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  medium: "border-blue-200 bg-blue-50 text-blue-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

function getDueState(task: Task) {
  if (!task.due_date) return null;
  const dueDate = new Date(task.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (task.status !== "done" && dueDate < today) return { label: "Overdue", className: "border-rose-200 bg-rose-50 text-rose-700" };
  if (dueDate.getTime() === today.getTime()) return { label: "Due today", className: "border-amber-200 bg-amber-50 text-amber-700" };
  if (dueDate.getTime() === tomorrow.getTime()) return { label: "Due tomorrow", className: "border-sky-200 bg-sky-50 text-sky-700" };
  return { label: dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }), className: "border-slate-200 bg-slate-50 text-slate-600" };
}

export function TaskItem({ task, viewMode, onStatusChange, canUpdateStatus = true, showProjectName = true }: TaskItemProps) {
  const editUrl = `/projects/${task.project_id}/tasks/${task.id}/edit`;
  const dueState = getDueState(task);
  const status = task.status || "todo";
  const priority = task.priority || "medium";
  const assigneeName = task.assignee_first_name ? `${task.assignee_first_name}${task.assignee_last_name ? ` ${task.assignee_last_name}` : ""}` : null;
  const statusChangeAllowed = Boolean(onStatusChange && canUpdateStatus);

  const updateStatus = (newStatus: Task["status"]) => onStatusChange?.(task.id, newStatus);
  const statusMenu = (
    <DropdownMenuContent align="end" className="w-40">
      <DropdownMenuItem onClick={() => updateStatus("todo")}>To do</DropdownMenuItem>
      <DropdownMenuItem onClick={() => updateStatus("in_progress")}>In progress</DropdownMenuItem>
      <DropdownMenuItem onClick={() => updateStatus("review")}>In review</DropdownMenuItem>
      <DropdownMenuItem onClick={() => updateStatus("done")}>Completed</DropdownMenuItem>
      <DropdownMenuItem onClick={() => updateStatus("cancelled")} className="text-rose-600">Cancelled</DropdownMenuItem>
    </DropdownMenuContent>
  );

  return (
    <article className={`group relative rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md ${viewMode === "grid" ? "flex min-h-[14.25rem] flex-col" : "flex flex-col gap-4 sm:flex-row sm:items-center"}`}>
      <div className="flex min-w-0 flex-1 gap-3">
        <div aria-hidden="true" className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${status === "done" ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-slate-300"}`}>
          <CheckCircle2 className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <Link href={editUrl} className="block truncate text-[15px] font-semibold text-slate-900 transition-colors hover:text-indigo-600 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            {task.title}
          </Link>
          {viewMode === "grid" && task.description && <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-slate-500">{task.description}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {showProjectName && task.project_name && <Link href={`/projects/${task.project_id}`} className="inline-flex max-w-full items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"><Layers3 className="h-3 w-3 shrink-0" /><span className="truncate">{task.project_name}</span></Link>}
            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold capitalize ${PRIORITY_STYLES[priority]}`}><PriorityIcon priority={priority} />{priority}</span>
            {dueState && <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${dueState.className}`}><CalendarDays className="h-3.5 w-3.5" />{dueState.label}</span>}
          </div>

          {task.tags && task.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{task.tags.slice(0, 3).map((tag) => <span key={tag.id} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${tag.color}1A`, color: tag.color }}>{tag.name}</span>)}{task.tags.length > 3 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">+{task.tags.length - 3}</span>}</div>}
        </div>
      </div>

      <div className={`flex items-center justify-between gap-3 ${viewMode === "grid" ? "mt-4 border-t border-slate-100 pt-3" : "sm:ml-auto sm:justify-end"}`}>
        {assigneeName ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-700">{task.assignee_first_name?.[0]}{task.assignee_last_name?.[0] || ""}</span><span className="max-w-24 truncate">{assigneeName}</span></span> : <span className="inline-flex items-center gap-1 text-xs text-slate-400"><UserRound className="h-3.5 w-3.5" />Unassigned</span>}
        {statusChangeAllowed ? <DropdownMenu><DropdownMenuTrigger asChild><button aria-label={`Set ${task.title} status`} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><Badge variant="outline" className={`h-6 cursor-pointer rounded-full px-2.5 text-[10px] font-semibold capitalize ${STATUS_STYLES[status]}`}><CircleDot className="h-3 w-3" />{status.replace("_", " ")}</Badge></button></DropdownMenuTrigger>{statusMenu}</DropdownMenu> : <Badge variant="outline" className={`h-6 rounded-full px-2.5 text-[10px] font-semibold capitalize ${STATUS_STYLES[status]}`}><CircleDot className="h-3 w-3" />{status.replace("_", " ")}</Badge>}
      </div>
    </article>
  );
}

function PriorityIcon({ priority }: { priority: Task["priority"] }) {
  if (priority === "low") return <ArrowDown className="h-3 w-3" />;
  return <Flag className={`h-3 w-3 ${priority === "urgent" ? "fill-current" : ""}`} />;
}
