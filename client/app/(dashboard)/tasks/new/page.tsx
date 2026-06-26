"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createTask } from "@/lib/api/tasks";
import { getAllProjects } from "@/lib/api/projects";
import { getProjectEligibleMembers, ProjectMember } from "@/lib/api/members";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/lib/toast";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { TaskForm } from "@/components/forms/TaskForm";
import { Project } from "@/lib/types";

export default function GlobalCreateTaskPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await getAllProjects();
        setProjects(res.projects || []);
      }
      catch (error) {
        console.log("Failed to fetch projects", error);
        showToast("Failed to load projects", "error");
      }
      finally {
        setIsLoading(false);
      }
    }
    fetchProjects();
  }, [showToast]);

  const handleProjectChange = async (projectId: string) => {
    const id = Number(projectId);
    if (isNaN(id)) {
      setMembers([]);
      setSelectedProjectId(null);
      return;
    }

    setSelectedProjectId(id);
    try {
      const res = await getProjectEligibleMembers(id);
      setMembers(res.members || []);
    }
    catch (error) {
      console.log("Failed to fetch eligible members", error);
      showToast("Failed to load project members", "error");
      setMembers([]);
    }
  };

  const handleSubmit = async (data: any) => {
    const projectId = Number(data.project_id);
    if (isNaN(projectId)) {
      showToast("Please select a project", "error");
      return;
    }

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

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="cursor-pointer">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create New Task</h1>
          <p className="text-muted-foreground">Select a project and provide task details.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl bg-white/70 backdrop-blur-sm overflow-hidden">
        <CardContent className="pt-6">
          <TaskForm
            projects={projects.map(p => ({ id: p.id, name: p.name }))}
            members={members}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/dashboard')}
            onProjectChange={handleProjectChange}
            isSubmitting={isSubmitting}
            submitLabel="Create Task"
          />
        </CardContent>
      </Card>
    </div>
  );
}
