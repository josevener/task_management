'use client';

/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the application.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { login as apiLogin, register as apiRegister, logout as apiLogout, getCurrentUser } from '@/lib/api/auth';
import type { User, LoginCredentials, RegisterData } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await getCurrentUser();
      setUser(response.user);
    }
    catch (error) {
      setUser(null);
    }
    finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      const response = await apiLogin(credentials);
      if (response.user) {
        setUser(response.user);
      }
      router.push('/dashboard');
    }
    catch (error) {
      throw error;
    }
  }, [router]);

  const register = useCallback(async (data: RegisterData) => {
    try {
      // In the new flow, register doesn't return a user immediately.
      // It sends an OTP and expects verification.
      await apiRegister(data);
      // We don't redirect here anymore, the calling page (RegisterPage) will handle it
      // so it can pass the email as a query param.
    }
    catch (error) {
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
      setUser(null);
      router.push('/login');
    }
    catch (error) {
      // Even if logout fails, clear local state
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      const response = await getCurrentUser();
      setUser(response.user);
    }
    catch (error) {
      setUser(null);
    }
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    authenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use authentication context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
