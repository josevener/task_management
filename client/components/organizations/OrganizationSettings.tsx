"use client";

import { useEffect, useMemo, useState } from "react";
import type { Organization, OrganizationMember } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Building2, CheckCircle2, Loader2, Save, Trash2 } from "lucide-react";
import { getOrganizationMembers, transferOrganizationOwnership, updateOrganization } from "@/lib/api/organizations";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/contexts/auth-context";

type PreferenceField = "timezone" | "default_language" | "date_format" | "time_format";

interface OrganizationSettingsProps {
  organization: Organization;
  canEdit: boolean;
  onUpdate: (organization: Organization) => void;
  onDeleteRequest: () => void;
}

function organizationFormData(organization: Organization) {
  return {
    name: organization.name,
    slug: organization.slug,
    logo_url: organization.logo_url || "",
    timezone: organization.timezone || "UTC",
    default_language: "en",
    date_format: organization.date_format || "YYYY-MM-DD",
    time_format: organization.time_format || "24h",
  };
}

export function OrganizationSettings({ organization, canEdit, onUpdate, onDeleteRequest }: OrganizationSettingsProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isOwner = user?.id === organization.owner_id;
  const [submitting, setSubmitting] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [newOwnerPublicId, setNewOwnerPublicId] = useState("");
  const [formData, setFormData] = useState(() => organizationFormData(organization));
  const initialData = useMemo(() => organizationFormData(organization), [organization]);
  const isDirty = JSON.stringify(formData) !== JSON.stringify(initialData);

  useEffect(() => setFormData(organizationFormData(organization)), [organization]);

  useEffect(() => {
    if (!isOwner) return;
    getOrganizationMembers(organization.id)
      .then((response) => setMembers(response.members || []))
      .catch(() => showToast("Failed to load organization members.", "error"));
  }, [isOwner, organization.id, showToast]);

  const updateField = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const updatePreference = (name: PreferenceField, value: string) => {
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const save = async () => {
    if (!canEdit || !isDirty) return;

    try {
      setSubmitting(true);
      const response = await updateOrganization(organization.id, formData);
      onUpdate(response.organization);
      setConfirmingSave(false);
      showToast("Organization settings updated.", "success");
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Failed to update organization settings.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const requestSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (canEdit && isDirty) setConfirmingSave(true);
  };

  const transfer = async () => {
    if (!isOwner || !newOwnerPublicId) return;

    try {
      setSubmitting(true);
      await transferOrganizationOwnership(organization.id, newOwnerPublicId);
      onUpdate({ ...organization, owner_id: newOwnerPublicId });
      setNewOwnerPublicId("");
      showToast("Ownership transferred successfully.", "success");
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Failed to transfer ownership.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={requestSave} className="space-y-6">
        {!canEdit && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You can view these settings, but you do not have permission to make changes.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-indigo-600" />Identity</CardTitle>
            <CardDescription>How your organization appears across Zentrix.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Organization name</Label>
              <Input id="name" name="name" value={formData.name} onChange={updateField} disabled={!canEdit || submitting} required />
              <p className="text-xs text-muted-foreground">Use the name your team recognizes.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL slug</Label>
              <Input id="slug" name="slug" className="font-mono" value={formData.slug} onChange={updateField} disabled={!canEdit || submitting} required />
              <p className="text-xs text-muted-foreground">Editable; lowercase letters, numbers, and hyphens only.</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="logo_url">Logo URL <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="logo_url" name="logo_url" type="url" value={formData.logo_url} onChange={updateField} disabled={!canEdit || submitting} placeholder="https://example.com/logo.png" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Set consistent defaults for every workspace in your organization.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={formData.timezone} onValueChange={(value) => updatePreference("timezone", value)} disabled={!canEdit || submitting}>
                <SelectTrigger id="timezone" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Ulaanbaatar">Ulaanbaatar (UTC+8)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">New York</SelectItem>
                  <SelectItem value="America/Los_Angeles">Los Angeles</SelectItem>
                  <SelectItem value="Europe/London">London</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_language">Default language</Label>
              <Select value={formData.default_language} onValueChange={(value) => updatePreference("default_language", value)} disabled={!canEdit || submitting}>
                <SelectTrigger id="default_language" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="en">English</SelectItem></SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">English is currently the only available language.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_format">Date format</Label>
              <Select value={formData.date_format} onValueChange={(value) => updatePreference("date_format", value)} disabled={!canEdit || submitting}>
                <SelectTrigger id="date_format" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="time_format">Time format</Label>
              <Select value={formData.time_format} onValueChange={(value) => updatePreference("time_format", value)} disabled={!canEdit || submitting}>
                <SelectTrigger id="time_format" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="24h">24-hour</SelectItem><SelectItem value="12h">12-hour</SelectItem></SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Subscription</CardTitle><CardDescription>Your current Zentrix plan details.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Plan</p><p className="mt-1 font-medium capitalize text-slate-900">{organization.subscription_tier || "Free"}</p></div>
            <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p><p className="mt-1 flex items-center gap-1.5 font-medium capitalize text-slate-900"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{organization.subscription_status || "Active"}</p></div>
          </CardContent>
        </Card>

        {canEdit && (
          <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur">
            <p className="hidden text-sm text-slate-500 sm:block">{isDirty ? "You have unsaved changes." : "All changes are saved."}</p>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={() => setFormData(initialData)} disabled={!isDirty || submitting}>Reset</Button>
              <Button className="cursor-pointer" disabled={!isDirty || submitting}><Save className="mr-2 h-4 w-4" />Save changes</Button>
            </div>
          </div>
        )}
      </form>

      <ConfirmDialog
        open={confirmingSave}
        onOpenChange={setConfirmingSave}
        title="Save organization changes?"
        description="Your organization identity and preferences will be updated for your team."
        confirmLabel="Save changes"
        isConfirming={submitting}
        onConfirm={save}
      />

      {isOwner && (
        <aside>
          <Card className="border-red-200">
            <CardHeader><CardTitle className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-5 w-5" />Danger zone</CardTitle><CardDescription>Owner-only organization actions.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new_owner">Transfer ownership</Label>
                <Select value={newOwnerPublicId} onValueChange={setNewOwnerPublicId} disabled={submitting}>
                  <SelectTrigger id="new_owner"><SelectValue placeholder="Select a member" /></SelectTrigger>
                  <SelectContent>{members.filter((member) => member.id !== organization.owner_id).map((member) => <SelectItem key={member.id} value={member.id}>{member.first_name} {member.last_name}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" className="w-full" onClick={transfer} disabled={!newOwnerPublicId || submitting}>Transfer ownership</Button>
              </div>
              <div className="border-t border-red-100 pt-5"><p className="font-medium text-red-800">Delete organization</p><p className="mt-1 text-sm text-red-700">Deletes all workspaces and their dependent data.</p><Button type="button" variant="destructive" className="mt-3 w-full" onClick={onDeleteRequest}><Trash2 className="mr-2 h-4 w-4" />Delete organization</Button></div>
            </CardContent>
          </Card>
        </aside>
      )}
    </div>
  );
}
