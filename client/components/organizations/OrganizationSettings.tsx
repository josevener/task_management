"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Organization, OrganizationMember } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, Building2, CreditCard,
  Trash2, AlertTriangle
} from "lucide-react";
import {
  updateOrganization,
  getOrganizationMembers,
  transferOrganizationOwnership
} from "@/lib/api/organizations";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/contexts/auth-context";

interface OrganizationSettingsProps {
  organization: Organization;
  onUpdate: (updatedOrg: Organization) => void;
  onDeleteRequest: () => void;
}

export function OrganizationSettings({
  organization,
  onUpdate,
  onDeleteRequest
}: OrganizationSettingsProps) {
  const { showToast } = useToast();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("general");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState<string>("");

  const isOwner = user?.id === organization.owner_id;

  const [formData, setFormData] = useState({
    name: organization.name,
    slug: organization.slug,
    logo_url: organization.logo_url || "",
    subscription_tier: organization.subscription_tier || "Free",
    subscription_status: organization.subscription_status || "active",
  });

  useEffect(() => {
    if (activeTab === "danger") {
      fetchMembers();
    }
  }, [activeTab]);

  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const res = await getOrganizationMembers(organization.id);
      setMembers(res.members || []);
    }
    catch (error) {
      console.log("Failed to load members", error);
    }
    finally {
      setLoadingMembers(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await updateOrganization(organization.id, formData);
      if (res.organization) {
        onUpdate(res.organization);
        showToast("Settings updated successfully", "success");
      }
    }
    catch (error: any) {
      showToast(error.message || "Failed to update settings", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!newOwnerId || !isOwner) return;
    try {
      setIsSubmitting(true);
      await transferOrganizationOwnership(organization.id, parseInt(newOwnerId));
      showToast("Ownership transferred successfully", "success");
      onUpdate({ ...organization, owner_id: parseInt(newOwnerId) });
      setNewOwnerId("");
    }
    catch (error: any) {
      showToast(error.message || "Failed to transfer ownership", "error");
    }
    finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Subscription</span>
          </TabsTrigger>
          <TabsTrigger value="danger" className="flex items-center gap-2 text-red-500 data-[state=active]:text-red-500">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Danger Zone</span>
          </TabsTrigger>
        </TabsList>

        <form onSubmit={handleSave}>
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Manage your organization identity and logo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Organization Name</Label>
                    <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input id="slug" name="slug" value={formData.slug} onChange={handleChange} required className="font-mono text-sm" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo_url">Logo URL</Label>
                  <Input id="logo_url" name="logo_url" value={formData.logo_url} onChange={handleChange} placeholder="https://example.com/logo.png" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="subscription" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Plan and Billing</CardTitle>
                <CardDescription>View and manage organization subscription.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Subscription Tier</Label>
                    <Input value={formData.subscription_tier} disabled className="bg-slate-50 capitalize" />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Input value={formData.subscription_status} disabled className="bg-slate-50 capitalize" />
                  </div>
                </div>
                <div className="pt-4">
                  <Button variant="outline" type="button" onClick={() => showToast("Billing portal coming soon", "info")}>
                    Manage Billing
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {activeTab !== "danger" && (
            <div className="flex justify-end gap-3 mt-6">
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 cursor-pointer" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          )}
        </form>

        <TabsContent value="danger" className="space-y-6">
          {!isOwner && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3 text-amber-800 mb-4">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm">Only organization owner can manage critical settings.</p>
            </div>
          )}

          <Card className={cn("border-red-200", !isOwner && "opacity-60 grayscale-[0.5]")}>
            <CardHeader>
              <CardTitle className="text-red-600">Transfer Ownership</CardTitle>
              <CardDescription>Nominate a new owner for this organization. You will lose owner permissions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new_owner">New Owner</Label>
                <div className="flex gap-2">
                  <Select value={newOwnerId} onValueChange={setNewOwnerId} disabled={!isOwner || loadingMembers}>
                    <SelectTrigger id="new_owner" className="flex-1">
                      <SelectValue placeholder={loadingMembers ? "Loading members..." : "Select a member"} />
                    </SelectTrigger>
                    <SelectContent>
                      {members.filter(m => m.id !== organization.owner_id).map((member) => (
                        <SelectItem key={member.id} value={member.id.toString()}>
                          {member.first_name} {member.last_name} ({member.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleTransferOwnership}
                    disabled={!newOwnerId || isSubmitting || !isOwner}
                  >
                    Transfer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("border-red-600 bg-red-50/50", !isOwner && "opacity-60 grayscale-[0.5]")}>
            <CardHeader>
              <CardTitle className="text-red-700">Delete Organization</CardTitle>
              <CardDescription className="text-red-600">
                Permanently remove this organization and all its data. This action is irreversible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={onDeleteRequest} disabled={!isOwner}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Organization
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
