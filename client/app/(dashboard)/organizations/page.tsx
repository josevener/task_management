"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrganizations } from "@/lib/api/organizations";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import type { Organization } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, Calendar, Loader2, Settings } from "lucide-react";
import { useToast } from "@/lib/toast";

export default function OrganizationsPage() {
  const { user } = useAuth();
  const { hasPermission } = useWorkspace();
  const { showToast } = useToast();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrganizations()
      .then((response) => setOrganization(response.organizations?.[0] || null))
      .catch(() => showToast("Failed to load your organization.", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;

  if (!organization) {
    return <div className="mx-auto flex min-h-[420px] max-w-xl items-center"><Card className="w-full border-dashed bg-slate-50 text-center"><CardHeader><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100"><Building2 className="h-7 w-7 text-indigo-600" /></div><CardTitle className="pt-3">Create your organization</CardTitle><CardDescription>Start with one organization, then create as many workspaces as your team needs.</CardDescription></CardHeader><CardContent><Button asChild className="bg-indigo-600 hover:bg-indigo-700"><Link href="/organizations/new">Create organization</Link></Button></CardContent></Card></div>;
  }

  const canEdit = user?.id === organization.owner_id || hasPermission("organizations:edit");
  return <div className="mx-auto max-w-4xl space-y-6"><div><h1 className="text-3xl font-bold tracking-tight text-slate-900">Organization</h1><p className="mt-1 text-muted-foreground">Manage your team’s organization and preferences.</p></div><Card><CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-center gap-4"><Avatar className="h-14 w-14 border"><AvatarImage src={organization.logo_url} alt="" /><AvatarFallback className="bg-indigo-100 text-lg font-semibold text-indigo-700">{organization.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div><CardTitle>{organization.name}</CardTitle><CardDescription className="font-mono">@{organization.slug}</CardDescription></div></div>{canEdit && <Button asChild><Link href={`/organizations/${organization.id}/edit`}><Settings className="mr-2 h-4 w-4" />Edit organization</Link></Button>}</CardHeader><CardContent className="grid gap-5 border-t pt-6 sm:grid-cols-3"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Plan</p><Badge className="mt-2 capitalize" variant="secondary">{organization.subscription_tier || "Free"}</Badge></div><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p><p className="mt-2 capitalize text-sm text-slate-800">{organization.subscription_status || "Active"}</p></div><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Created</p><p className="mt-2 flex items-center gap-2 text-sm text-slate-800"><Calendar className="h-4 w-4 text-slate-400" />{new Date(organization.created_at).toLocaleDateString()}</p></div></CardContent></Card></div>;
}
