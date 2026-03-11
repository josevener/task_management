"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './auth-context';
import { getWorkspaces, getWorkspace } from '@/lib/api/workspaces';
import type { Workspace } from '@/lib/types';

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  userPermissions: string[];
  hasPermission: (action: string) => boolean;
  switchWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { authenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const hasPermission = useCallback((action: string) => {
    // Admin role bypass or explicit permission check
    if (activeWorkspace?.user_role === 'Admin') return true;
    return userPermissions.includes(action);
  }, [userPermissions, activeWorkspace]);

  const fetchWorkspaces = useCallback(async () => {
    if (!authenticated) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await getWorkspaces();
      setWorkspaces(response.workspaces || []);

      if (response.workspaces?.length > 0) {
        // Find if we had one saved in localStorage
        const savedId = localStorage.getItem('activeWorkspaceId');
        if (savedId) {
          const found = response.workspaces.find(w => w.id.toString() === savedId);
          if (found) {
            setActiveWorkspace(found);
            return;
          }
        }
        // Default to first
        setActiveWorkspace(response.workspaces[0]);
      }
      else {
        setActiveWorkspace(null);
      }
    }
    catch (error) {
      console.error("Failed to fetch workspaces:", error);
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
      } catch (err) {
        console.error("Failed to load active workspace permissions", err);
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
    localStorage.setItem('activeWorkspaceId', workspace.id.toString());
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
