"use client";

import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, DropResult, DroppableProps } from "@hello-pangea/dnd";

// Custom Droppable wrapper to resolve Next.js Strict Mode hydration/double-render freeze issues
function StrictModeDroppable({ children, ...props }: DroppableProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return <Droppable {...props}>{children}</Droppable>;
}
import { TaskCard } from "./task-card";
import type { Task } from "@/lib/types";
import { updateTaskStatus } from "@/lib/api/tasks";
import { useToast } from "@/lib/toast";

export type BoardData = {
  [status: string]: Task[];
};

export const COLUMNS = [
  { id: "todo", title: "To Do", bg: "bg-slate-100 border-slate-200" },
  { id: "in_progress", title: "In Progress", bg: "bg-blue-50 border-blue-100" },
  { id: "review", title: "In Review", bg: "bg-amber-50 border-amber-100" },
  { id: "done", title: "Done", bg: "bg-green-50 border-green-100" },
];

interface KanbanBoardProps {
  initialTasks: Task[];
  projectId: string;
  onTaskClick?: (task: Task) => void;
}

export function KanbanBoard({ initialTasks, projectId, onTaskClick }: KanbanBoardProps) {
  const { showToast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [boardData, setBoardData] = useState<BoardData>({
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize board columns on mount or when tasks change
  useEffect(() => {
    const newBoard: BoardData = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
      cancelled: [], // Hidden or handle if needed
    };

    // Group tasks by status and sort by position
    initialTasks.forEach((task) => {
      const status = task.status;
      if (newBoard[status]) {
        newBoard[status].push(task);
      }
      else {
        newBoard[status] = [task];
      }
    });

    // Sort each column by position initially
    Object.keys(newBoard).forEach((key) => {
      newBoard[key].sort((a, b) => a.position - b.position);
    });

    setBoardData(newBoard);
  }, [initialTasks]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Dropped outside a valid droppable area
    if (!destination) return;

    // Dropped back where it started
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceColumnId = source.droppableId;
    const destColumnId = destination.droppableId;

    // Optimistic UI update
    const newBoardData = { ...boardData };

    const sourceTasks = Array.from(newBoardData[sourceColumnId]);
    const [movedTask] = sourceTasks.splice(source.index, 1);

    // If moving within the same column
    if (sourceColumnId === destColumnId) {
      sourceTasks.splice(destination.index, 0, movedTask);
      newBoardData[sourceColumnId] = sourceTasks;

      // Update local state immediately
      setBoardData(newBoardData);

      // We might need an API to persist pure positional re-ordering in the same column
      try {
        await updateTaskStatus(movedTask.id, destColumnId, destination.index);
      }
      catch (error) {
        showToast("Failed to save reorder. Please refresh.", "error");
      }
      return;
    }

    // Moving between columns
    const destTasks = Array.from(newBoardData[destColumnId] || []);
    const updatedTask = { ...movedTask, status: destColumnId as Task['status'] };
    destTasks.splice(destination.index, 0, updatedTask);

    newBoardData[sourceColumnId] = sourceTasks;
    newBoardData[destColumnId] = destTasks;

    // Update local state immediately (optimistic)
    setBoardData(newBoardData);

    try {
      // Fire API call in background
      await updateTaskStatus(updatedTask.id, destColumnId, destination.index);
    }
    catch (error) {
      // Revert on failure
      setBoardData(boardData);
      showToast("Failed to update task status.", "error");
    }
  };

  if (!isMounted) {
    return (
      <div className="grid min-h-[32rem] w-full grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Desktop keeps every status visible; smaller screens reflow the columns instead of scrolling sideways. */}
        {COLUMNS.map((col) => {
          const tasks = boardData[col.id] || [];

          return (
            <div key={col.id} className="flex min-h-[30rem] min-w-0 flex-col pb-2">
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1.5 shrink-0">
                <h3 className="font-semibold text-sm text-slate-700">{col.title}</h3>
                <span className="bg-slate-200/80 text-slate-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {tasks.length}
                </span>
              </div>

              {/* Droppable Area Placeholder */}
              <div className={`flex-1 rounded-xl p-3 min-h-[150px] border ${col.bg}`}></div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid min-h-[32rem] w-full grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Desktop keeps every status visible; smaller screens reflow the columns instead of scrolling sideways. */}
        {COLUMNS.map((col) => {
          const tasks = boardData[col.id] || [];

          return (
            <div key={col.id} className="flex min-h-[30rem] min-w-0 flex-col pb-2">
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1.5 shrink-0">
                <h3 className="font-semibold text-sm text-slate-700">{col.title}</h3>
                <span className="bg-slate-200/80 text-slate-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {tasks.length}
                </span>
              </div>

              {/* Droppable Area */}
              <StrictModeDroppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 min-h-[150px] rounded-xl border p-3 ${col.bg} transition-all duration-200 ${
                      snapshot.isDraggingOver
                        ? "ring-2 ring-blue-400 ring-inset bg-blue-50/40 border-blue-200 border-dashed"
                        : ""
                    }`}
                  >
                    {tasks.map((task, index) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        index={index}
                        onClick={() => onTaskClick?.(task)}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </StrictModeDroppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
