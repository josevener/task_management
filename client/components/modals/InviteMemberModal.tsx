"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { InviteMemberForm } from "@/components/forms/invite-member-form";
import { addWorkspaceMember } from "@/lib/api/members";
import { ApiClientError } from "@/lib/api-client";
import { useToast } from "@/lib/toast";
import { UserPlus } from "lucide-react";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
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
  const handleSubmit = async (email: string) => {
    try {
      setIsSubmitting(true);
      const response = await addWorkspaceMember(workspaceId, email);

      showToast(`${response.message} Sent to ${response.invitation.email}.`, "success");
      onSuccess?.();
      onClose();
    }
    catch (error) {
      if (error instanceof ApiClientError && error.errors?.email) {
        showToast(error.errors.email, "error");
      }
      else {
        showToast(error instanceof Error ? error.message : "Failed to send invitation", "error");
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
                Enter an email address. The invitation expires in 48 hours.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 bg-white">
          <InviteMemberForm onSubmit={handleSubmit} onCancel={onClose} isSubmitting={isSubmitting} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
