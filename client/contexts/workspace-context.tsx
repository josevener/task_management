"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './auth-context';
import { getWorkspaces } from '@/lib/api/workspaces';
import type { Workspace } from '@/lib/types';

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  switchWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { authenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

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

  const switchWorkspace = useCallback((workspace: Workspace) => {
    setActiveWorkspace(workspace);
    localStorage.setItem('activeWorkspaceId', workspace.id.toString());
  }, []);

  const value: WorkspaceContextType = {
    workspaces,
    activeWorkspace,
    loading,
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
