"use client";

import React from "react";
import Link from "next/link";
import { Calendar, CheckCircle2, User, Building } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Task } from "@/lib/types";

interface TaskItemProps {
  task: Task;
  viewMode: "list" | "grid";
  onStatusChange?: (taskId: number, newStatus: Task["status"]) => void;
  showProjectName?: boolean;
}

export function TaskItem({
  task,
  viewMode,
  onStatusChange,
  showProjectName = true,
}: TaskItemProps) {
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "todo":
        return "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/80";
      case "in_progress":
        return "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100/80";
      case "review":
        return "bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100/80";
      case "done":
        return "bg-green-50 text-green-700 border-green-100 hover:bg-green-100/80";
      case "cancelled":
        return "bg-red-50 text-red-700 border-red-100 hover:bg-red-100/80";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <span className="text-red-500 font-bold tracking-tight">!!!</span>;
      case "high":
        return <span className="text-orange-500 font-bold tracking-tight">!!</span>;
      case "medium":
        return <span className="text-blue-500 font-bold tracking-tight">!</span>;
      case "low":
        return <span className="text-slate-400 font-bold tracking-tight">↓</span>;
      default:
        return null;
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-50 text-red-700 border-red-100";
      case "high":
        return "bg-orange-50 text-orange-700 border-orange-100";
      case "medium":
        return "bg-blue-50 text-blue-700 border-blue-100";
      case "low":
        return "bg-slate-50 text-slate-600 border-slate-150";
      default:
        return "bg-slate-50 text-slate-600 border-slate-150";
    }
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

  // Build edit URL
  const editUrl = `/projects/${task.project_id}/tasks/${task.id}/edit`;

  const taskTitleAndDetails = (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1.5">
        <Link
          href={editUrl}
          className="font-semibold text-slate-800 hover:text-blue-600 transition-colors block truncate text-[15px] focus:outline-none focus:underline"
        >
          {task.title}
        </Link>
      </div>
      
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-xs text-slate-500 font-medium">
        {showProjectName && task.project_name && (
          <Link
            href={`/projects/${task.project_id}`}
            className="flex items-center gap-1 text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200/80 px-2 py-0.5 rounded-md transition-colors truncate max-w-[140px]"
          >
            <Building className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{task.project_name}</span>
          </Link>
        )}
        
        {task.priority && (
          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] uppercase font-bold tracking-wider ${getPriorityBadgeClass(task.priority)}`}>
            {getPriorityIcon(task.priority)}
            <span>{task.priority}</span>
          </span>
        )}
        
        {task.due_date && (
          <span
            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md border ${
              isOverdue
                ? "bg-red-50 text-red-600 border-red-150 font-bold"
                : "bg-slate-50 text-slate-500 border-slate-150"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            {isOverdue && <span className="text-[10px] uppercase tracking-wider">(Overdue)</span>}
          </span>
        )}
        
        {task.assignee_first_name && (
          <span className="flex items-center gap-1 text-slate-600 bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded-md">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{task.assignee_first_name} {task.assignee_last_name?.[0]}.</span>
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`premium-card-hover relative group bg-white border border-slate-200/85 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex ${
        viewMode === "list" ? "flex-col sm:flex-row sm:items-center" : "flex-col"
      } gap-4 w-full`}
    >
      {/* Checkbox / Status Quick Dropdown */}
      <div className="flex-shrink-0 pt-0.5 sm:pt-0">
        {onStatusChange ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`w-6.5 h-6.5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-200 button-pop ${
                  task.status === "done"
                    ? "bg-green-500 border-green-500 text-white shadow-sm shadow-green-200"
                    : "border-slate-300 bg-white hover:border-blue-500 hover:bg-blue-50 text-transparent hover:text-blue-500"
                }`}
                title="Change status"
              >
                <CheckCircle2 className="w-4.5 h-4.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "todo")} className="cursor-pointer">
                To Do
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "in_progress")} className="cursor-pointer">
                In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "review")} className="cursor-pointer">
                Review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "done")} className="cursor-pointer">
                Done
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "cancelled")} className="cursor-pointer text-red-650">
                Cancelled
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div
            className={`w-6.5 h-6.5 rounded-full border-2 flex items-center justify-center ${
              task.status === "done"
                ? "bg-green-500 border-green-500 text-white"
                : "border-slate-300 bg-slate-50 text-slate-300"
            }`}
          >
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
        )}
      </div>

      {/* Task Details */}
      {taskTitleAndDetails}

      {/* Status Badge */}
      <div
        className={`flex items-center gap-2 ${
          viewMode === "list" ? "sm:ml-auto" : "mt-2 pt-2 border-t border-slate-100"
        }`}
      >
        {onStatusChange ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="focus:outline-none cursor-pointer">
                <Badge
                  variant="outline"
                  className={`text-[10px] h-5.5 px-2.5 py-0 font-semibold uppercase tracking-wider border rounded-full shadow-sm capitalize transition-colors ${getStatusColor(
                    task.status || "todo"
                  )}`}
                >
                  {(task.status || "todo").replace("_", " ")}
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "todo")} className="cursor-pointer">
                To Do
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "in_progress")} className="cursor-pointer">
                In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "review")} className="cursor-pointer">
                Review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "done")} className="cursor-pointer">
                Done
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "cancelled")} className="cursor-pointer text-red-650">
                Cancelled
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Badge
            variant="outline"
            className={`text-[10px] h-5.5 px-2.5 py-0 font-semibold uppercase tracking-wider border rounded-full shadow-sm capitalize ${getStatusColor(
              task.status || "todo"
            )}`}
          >
            {(task.status || "todo").replace("_", " ")}
          </Badge>
        )}
      </div>
    </div>
  );
}
