"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrganizations, deleteOrganization } from "@/lib/api/organizations";
import { useWorkspace } from "@/contexts/workspace-context";
import type { Organization } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, Plus, Calendar, Settings, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/lib/toast";

export default function OrganizationsPage() {
  const { hasPermission } = useWorkspace();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchOrgs = async () => {
    try {
      setLoading(true);
      const res = await getOrganizations();
      setOrganizations(res.organizations || []);
    }
    catch (error) {
      console.error("Failed to load organizations", error);
    }
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleDeleteSubmit = async () => {
    if (!deletingOrg) return;

    try {
      setIsSubmitting(true);
      await deleteOrganization(deletingOrg.id);
      showToast("Organization deleted successfully", "success");
      setDeletingOrg(null);
      fetchOrgs();
    }
    catch (error: any) {
      showToast(error.message || "Failed to delete organization", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'enterprise': return <Badge className="bg-purple-600 hover:bg-purple-700">{tier}</Badge>;
      case 'pro': return <Badge className="bg-blue-600 hover:bg-blue-700">{tier}</Badge>;
      default: return <Badge variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-300">{tier}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Organizations</h1>
          <p className="text-muted-foreground mt-1">
            Manage your tenants and subscriptions here.
          </p>
        </div>
        {hasPermission('organizations:create') && (
          <Button asChild className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
              New Organization
            </Link>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      ) : organizations.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed bg-slate-50">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
            <Building2 className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No organizations found</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-sm mb-6">
            You don't belong to any organizations yet. Create one to get started.
          </p>
          {hasPermission('organizations:create') && (
            <Button asChild className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
              <Link href="/organizations/new">Create Organization</Link>
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <Card key={org.id} className="flex flex-col hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border shadow-sm">
                    {org.logo_url && <AvatarImage src={org.logo_url} alt={org.name} />}
                    <AvatarFallback className="bg-slate-100 text-slate-700 font-semibold">
                      {org.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{org.name}</CardTitle>
                    <span className="text-xs text-slate-500 font-mono">@{org.slug}</span>
                  </div>
                </div>
                {(hasPermission('organizations:edit') || hasPermission('organizations:delete')) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
                        <span className="sr-only">Open menu</span>
                        <Settings className="h-4 w-4 text-slate-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {hasPermission('organizations:edit') && (
                        <>
                          <DropdownMenuItem className="cursor-pointer" asChild>
                            <Link href={`/organizations/${org.id}/edit`}>Manage Settings</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer">Billing</DropdownMenuItem>
                        </>
                      )}
                      {hasPermission('organizations:edit') && hasPermission('organizations:delete') && <DropdownMenuSeparator />}
                      {hasPermission('organizations:delete') && (
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                          onClick={() => setDeletingOrg(org)}
                        >
                          Delete Organization
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardHeader>
              <CardContent className="flex-1 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                      Tier
                    </span>
                    {getTierBadge(org.subscription_tier || 'Free')}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Created
                    </span>
                    <span className="text-sm text-slate-700">{new Date(org.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Organization Dialog */}
      <Dialog open={!!deletingOrg} onOpenChange={(open) => !open && setDeletingOrg(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingOrg?.name}</strong>? This action cannot be undone and will permanently delete all associated workspaces, projects, and tasks.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setDeletingOrg(null)}
            >
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
              Delete Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
