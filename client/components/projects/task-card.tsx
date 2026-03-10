"use client";

import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarIcon, MessageSquare, Paperclip } from "lucide-react";
import type { Task } from "@/lib/types";

interface TaskCardProps {
  task: Task;
  index: number;
  onClick?: () => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'low': return 'bg-slate-100 text-slate-800 border-slate-200';
    default: return 'bg-slate-100 text-slate-800 border-slate-200';
  }
};

export function TaskCard({ task, index, onClick }: TaskCardProps) {
  // Generate initials for avatar fallback
  const getInitials = () => {
    if (task.assignee_first_name && task.assignee_last_name) {
      return `${task.assignee_first_name[0]}${task.assignee_last_name[0]}`;
    }
    return "?";
  };

  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-3 transition-transform ${snapshot.isDragging ? 'z-50' : ''}`}
          style={{
            ...provided.draggableProps.style,
            // Slightly rotate when dragging for a nice effect
            transform: snapshot.isDragging
              ? `${provided.draggableProps.style?.transform} rotate(2deg)`
              : provided.draggableProps.style?.transform,
          }}
        >
          <Card
            className={`shadow-sm border border-slate-200 cursor-pointer ${snapshot.isDragging ? 'shadow-lg ring-1 ring-blue-500' : 'hover:border-slate-300 hover:shadow-md'}`}
            onClick={onClick}
          >
            <CardContent className="p-3 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border ${getPriorityColor(task.priority)} uppercase font-semibold`}>
                  {task.priority}
                </Badge>
                {/* We can add a simple more-options dropdown icon here if needed */}
              </div>

              <div className="font-medium text-sm text-slate-900 leading-tight line-clamp-2">
                {task.title}
              </div>

              {task.tags && task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {task.tags.map(tag => (
                    <span
                      key={tag.id}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-1 mt-1 border-t border-slate-100">
                <div className="flex items-center gap-3 text-slate-500 text-xs">
                  {task.due_date && (
                    <div className={`flex items-center gap-1.5 ${new Date(task.due_date) < new Date() ? 'text-red-500 font-medium' : ''}`}>
                      <CalendarIcon className="h-3 w-3" />
                      <span>{new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                  )}
                  {/* Mock counters for attachments and comments */}
                  {/* <div className="flex items-center gap-1"><MessageSquare className="h-3 w-3"/> 2</div> */}
                </div>

                {task.assignee_id && (
                  <Avatar className="h-6 w-6 border border-slate-200 text-[10px]">
                    <AvatarFallback className="bg-slate-100 text-slate-600">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
}
