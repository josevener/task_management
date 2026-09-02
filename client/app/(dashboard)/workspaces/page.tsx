"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { deleteWorkspace } from "@/lib/api/workspaces";
import type { Workspace } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase, ChevronRight, Settings, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/lib/toast";

export default function WorkspacesPage() {
  const { workspaces, activeWorkspace, switchWorkspace, refreshWorkspaces, loading, hasPermission } = useWorkspace();
  const { showToast } = useToast();

  // Edit form state no longer needed here as it's extracted to a separate page
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDeleteSubmit = async () => {
    if (!deletingWorkspace) return;

    try {
      setIsSubmitting(true);
      await deleteWorkspace(deletingWorkspace.id);
      showToast("Workspace deleted successfully", "success");
      setDeletingWorkspace(null);
      await refreshWorkspaces();

      // If we deleted the active workspace, we should clear it or switch to another
      if (activeWorkspace?.id === deletingWorkspace.id) {
        // The context might handle this automatically on refresh, but just in case
        // we might need a deselectWorkspace function. For now, a hard reload works too.
        window.location.reload();
      }
    }
    catch (error: any) {
      showToast(error.message || "Failed to delete workspace", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Workspaces</h1>
          <p className="text-muted-foreground">
            Manage your workspaces and navigate between different environments.
          </p>
        </div>
        {hasPermission('workspaces:create') && (
          <Button asChild className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
            <Link href="/workspaces/new">
              <Plus className="mr-2 h-4 w-4" />
              New Workspace
            </Link>
          </Button>
        )}
      </div>

      {workspaces.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed bg-slate-50">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
            <Briefcase className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No workspaces found</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-sm mb-6">
            You don't belong to any workspaces yet. Create one to start managing projects and tasks.
          </p>
          {hasPermission('workspaces:create') && (
            <Button asChild className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
              <Link href="/workspaces/new">Create First Workspace</Link>
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <Card key={workspace.id} className={`flex flex-col ${activeWorkspace?.id === workspace.id ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}>
              <CardHeader className="flex flex-row items-center gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-md text-white font-bold"
                  style={{ backgroundColor: workspace.color_theme || '#0f766e' }}
                >
                  {workspace.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <CardTitle className="text-lg">{workspace.name}</CardTitle>
                  <CardDescription>
                    {workspace.organization_name || 'Organization'}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-slate-600 line-clamp-3">
                  {workspace.description || "No description provided."}
                </p>
              </CardContent>
              <CardFooter className="flex justify-between border-t bg-slate-50/50 p-4">
                {activeWorkspace?.id === workspace.id ? (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                    Active
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-600 hover:text-slate-900 cursor-pointer"
                    onClick={() => switchWorkspace(workspace)}
                  >
                    Switch to
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
                {(hasPermission('workspaces:edit') || hasPermission('workspaces:delete')) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 cursor-pointer">
                        <span className="sr-only">Workspace settings</span>
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {hasPermission('workspaces:edit') && (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          asChild
                        >
                          <Link href={`/workspaces/${workspace.id}/edit`}>Edit Workspace</Link>
                        </DropdownMenuItem>
                      )}
                      {hasPermission('workspaces:edit') && hasPermission('workspaces:delete') && <DropdownMenuSeparator />}
                      {hasPermission('workspaces:delete') && (
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                          onClick={() => setDeletingWorkspace(workspace)}
                        >
                          Delete Workspace
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Workspace Dialog */}
      <Dialog open={!!deletingWorkspace} onOpenChange={(open) => !open && setDeletingWorkspace(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingWorkspace?.name}</strong>? This action cannot be undone and will permanently delete all associated projects and tasks.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setDeletingWorkspace(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              onClick={handleDeleteSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
