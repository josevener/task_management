"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createTask } from "@/lib/api/tasks";
import { getProjectEligibleMembers, ProjectMember } from "@/lib/api/members";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/lib/toast";
import { ArrowLeft, Plus } from "lucide-react";
import { TaskForm } from "@/components/forms/TaskForm";

export default function CreateTaskPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const projectId = Number(params.id);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);

  useEffect(() => {
    if (isNaN(projectId)) return;
    getProjectEligibleMembers(projectId)
      .then(res => setMembers(res.members))
      .catch(console.error);
  }, [projectId]);

  const handleSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      await createTask({
        project_id: projectId,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date || null,
        assignee_id: data.assignee_id && data.assignee_id !== "none" ? Number(data.assignee_id) : null,
      });

      showToast("Task created successfully", "success");
      router.push(`/projects/${projectId}`);
    }
    catch (error: any) {
      showToast(error.message || "Failed to create task", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="cursor-pointer">
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create Task</h1>
          <p className="text-muted-foreground">Add a new task to your project board.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-slate-500" />
            Task Details
          </CardTitle>
          <CardDescription>
            Provide clear and concise details for what needs to be done.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaskForm
            initialData={{
              title: "",
              description: "",
              status: "todo",
              priority: "medium",
              due_date: "",
              assignee_id: "none",
              project_id: projectId
            }}
            members={members}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/projects/${projectId}`)}
            isSubmitting={isSubmitting}
            submitLabel="Create Task"
          />
        </CardContent>
      </Card>
    </div>
  );
}
