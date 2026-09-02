"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  getOrganization,
  deleteOrganization
} from "@/lib/api/organizations";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { OrganizationSettings } from "@/components/organizations/OrganizationSettings";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";

export default function EditOrganizationPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { refreshWorkspaces } = useWorkspace();
  const organizationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);

  useEffect(() => {
    async function fetchOrg() {
      if (!organizationId) return;
      try {
        const res = await getOrganization(organizationId);
        if (res.organization) {
          setOrgData(res.organization);
        }
      }
      catch (error) {
        showToast("Failed to load organization", "error");
        router.push("/organizations");
      }
      finally {
        setLoading(false);
      }
    }
    fetchOrg();
  }, [organizationId, router, showToast]);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteOrganization(organizationId);
      showToast("Organization deleted successfully", "success");
      await refreshWorkspaces();
      router.push("/organizations");
    }
    catch (error: any) {
      showToast(error.message || "Failed to delete organization", "error");
      setShowDeleteDialog(false);
    }
    finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="cursor-pointer">
          <Link href="/organizations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {orgData?.name} Settings
          </h1>
          <p className="text-muted-foreground">Manage your organization details and preferences.</p>
        </div>
      </div>

      <div className="grid gap-6">
        {orgData && (
          <OrganizationSettings
            organization={orgData}
            onUpdate={(updated) => setOrgData(updated)}
            onDeleteRequest={() => setShowDeleteDialog(true)}
          />
        )}
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{orgData?.name}</strong>? This action cannot be undone and will permanently delete all associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
