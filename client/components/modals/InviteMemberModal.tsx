"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { MemberForm } from "@/components/forms/MemberForm";
import { addWorkspaceMember } from "@/lib/api/members";
import { apiGet } from "@/lib/api-client";
import { useToast } from "@/lib/toast";
import { UserPlus } from "lucide-react";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: number;
  onSuccess?: () => void;
}

export function InviteMemberModal({
  isOpen,
  onClose,
  workspaceId,
  onSuccess
}: InviteMemberModalProps) {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  useEffect(() => {
    async function fetchRoles() {
      if (!isOpen || !workspaceId) return;

      try {
        setIsLoadingRoles(true);
        const res = await apiGet<any>(`/workspaces/${workspaceId}/roles`);
        setRoles(res.roles || []);
      }
      catch (error) {
        console.log("Failed to load roles", error);
        showToast("Error loading roles", "error");
      }
      finally {
        setIsLoadingRoles(false);
      }
    }
    fetchRoles();
  }, [isOpen, workspaceId, showToast]);

  const handleSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      await addWorkspaceMember(
        workspaceId,
        data.email,
        data.role_id,
        'create', // default to create for richer UI experience
        {
          first_name: data.first_name,
          last_name: data.last_name,
        }
      );

      showToast("Invitation sent! A verification or notification email has been sent to the member.", "success");
      onSuccess?.();
      onClose();
    }
    catch (error: any) {
      if (error.errors && error.errors.email) {
        showToast(error.errors.email, "error");
      }
      else {
        showToast(error.message || "Failed to invite member", "error");
      }
    }
    finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="bg-gradient-to-r from-slate-50 to-white px-6 py-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserPlus className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Invite Team Member</DialogTitle>
              <DialogDescription className="text-slate-500 mt-1">
                Add a new member to your workspace team.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 bg-white">
          {!isLoadingRoles ? (
            <MemberForm
              roles={roles}
              onSubmit={handleSubmit}
              onCancel={onClose}
              isSubmitting={isSubmitting}
              submitLabel="Send Invitation"
            />
          ) : (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
