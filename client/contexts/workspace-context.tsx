"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './auth-context';
import { getWorkspaces, getWorkspace } from '@/lib/api/workspaces';
import type { Workspace } from '@/lib/types';

const GLOBAL_PERMISSIONS = [
  'organizations:view',
  'organizations:create',
  'settings:view'
];

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  userPermissions: string[];
  hasPermission: (action: string) => boolean;
  switchWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: (targetWorkspaceId?: string) => Promise<Workspace | null>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { authenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const hasPermission = useCallback((action: string) => {
    // 1. Check Global Permissions (bypass workspace check)
    if (GLOBAL_PERMISSIONS.includes(action)) return true;

    // 2. Admin role bypass or explicit permission check (requires active workspace)
    if (activeWorkspace?.user_role === 'Admin') return true;
    return userPermissions.includes(action);
  }, [userPermissions, activeWorkspace]);

  const fetchWorkspaces = useCallback(async (targetWorkspaceId?: string) => {
    if (!authenticated) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setLoading(false);
      return null;
    }

    try {
      setLoading(true);
      const response = await getWorkspaces();
      const fetchedWorkspaces = response.workspaces || [];
      setWorkspaces(fetchedWorkspaces);

      if (fetchedWorkspaces.length > 0) {
        // 1. If we have a target ID passed in (e.g. from just creating an org)
        if (targetWorkspaceId) {
          const target = fetchedWorkspaces.find(w => w.id === targetWorkspaceId);
          if (target) {
            setActiveWorkspace(target);
            localStorage.setItem('activeWorkspaceId', target.id);
            return target;
          }
        }

        // 2. Check if the current active workspace still exists in the list
        const currentActiveId = activeWorkspace?.id;
        const exists = fetchedWorkspaces.find(w => w.id === currentActiveId);
        if (exists) {
          // It still exists, but we might want to update its basic info from the list
          setActiveWorkspace(exists);
          return exists;
        }

        // 3. Find if we had one saved in localStorage that is valid
        const savedId = localStorage.getItem('activeWorkspaceId');
        if (savedId) {
          const found = fetchedWorkspaces.find(w => w.id === savedId);
          if (found) {
            setActiveWorkspace(found);
            return found;
          }
        }

        // 4. Default to first if none of the above
        const first = fetchedWorkspaces[0];
        setActiveWorkspace(first);
        localStorage.setItem('activeWorkspaceId', first.id);
        return first;
      }
      else {
        setActiveWorkspace(null);
        localStorage.removeItem('activeWorkspaceId');
        return null;
      }
    }
    catch (error) {
      console.log("Failed to fetch workspaces:", error);
      return null;
    }
    finally {
      setLoading(false);
    }
  }, [authenticated]);


  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Load detailed workspace info (for permissions and role) whenever the active workspace changes
  useEffect(() => {
    let mounted = true;

    const loadWorkspaceDetails = async () => {
      if (!activeWorkspace?.id || !authenticated) {
        setUserPermissions([]);
        return;
      }

      try {
        const response = await getWorkspace(activeWorkspace.id);
        if (mounted) {
          setUserPermissions(response.user_permissions || []);


          // Optionally update the active workspace with the latest role and permissions if we don't cause infinite render
          setActiveWorkspace(prev => {
            if (!prev) return prev;
            if (prev.user_role !== response.workspace.user_role || prev.id !== response.workspace.id) {
              return {
                ...prev,
                user_role: response.workspace.user_role,
                user_permissions: response.user_permissions
              };
            }
            return prev;
          });
        }
      }
      catch (err) {
        console.log("Failed to load active workspace permissions", err);
        if (mounted) setUserPermissions([]);
      }
    };

    loadWorkspaceDetails();

    return () => {
      mounted = false;
    };
  }, [activeWorkspace?.id, authenticated]);

  const switchWorkspace = useCallback((workspace: Workspace) => {
    setActiveWorkspace(workspace);
    localStorage.setItem('activeWorkspaceId', workspace.id);
  }, []);

  const value: WorkspaceContextType = {
    workspaces,
    activeWorkspace,
    loading,
    userPermissions,
    hasPermission,
    switchWorkspace,
    refreshWorkspaces: fetchWorkspaces
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
