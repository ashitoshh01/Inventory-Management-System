'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  AuthMeResponse,
  LoginDto,
  OrganizationDto,
  OrganizationMembershipDto,
} from '@repo/types';
import { authApi } from '../../lib/api/auth';
import { FirstLoginPasswordModal } from '../auth/first-login-password-modal';

interface AuthContextType {
  user: AuthMeResponse['user'] | null;
  memberships: AuthMeResponse['memberships'] | null;
  activeOrganizationId: string | null;
  activeOrganization: OrganizationDto | null;
  activeMembership: OrganizationMembershipDto | null;
  isPlatformAdmin: boolean;
  isLoading: boolean;
  login: (data: LoginDto) => Promise<void>;
  logout: () => Promise<void>;
  setActiveOrganizationId: (id: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthMeResponse['user'] | null>(null);
  const [memberships, setMemberships] = useState<AuthMeResponse['memberships'] | null>(null);
  const [activeOrganizationId, setActiveOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await authApi.getMe();
      if (res.data.user) {
        setUser(res.data.user);
        setMemberships(res.data.memberships);

        // Auto-select active org if not set
        const storedOrgId = localStorage.getItem('activeOrganizationId');
        if (storedOrgId && res.data.memberships.some((m) => m.organizationId === storedOrgId)) {
          setActiveOrgId(storedOrgId);
        } else if (res.data.memberships && res.data.memberships.length > 0) {
          const firstOrgId = res.data.memberships[0]?.organizationId;
          if (firstOrgId) {
            setActiveOrgId(firstOrgId);
            localStorage.setItem('activeOrganizationId', firstOrgId);
          }
        }
      }
    } catch {
      setUser(null);
      setMemberships(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (data: LoginDto) => {
    await authApi.login(data);
    await fetchUser();
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setMemberships(null);
      setActiveOrgId(null);
      localStorage.removeItem('activeOrganizationId');
    }
  };

  const setActiveOrganizationId = (id: string) => {
    setActiveOrgId(id);
    localStorage.setItem('activeOrganizationId', id);
  };

  const activeMembership =
    memberships?.find((m) => m.organizationId === activeOrganizationId) || memberships?.[0] || null;

  const activeOrganization = activeMembership?.organization || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        activeOrganizationId,
        activeOrganization,
        activeMembership,
        isPlatformAdmin: Boolean(user?.isPlatformAdmin),
        isLoading,
        login,
        logout,
        setActiveOrganizationId,
        refreshUser: fetchUser,
      }}
    >
      {children}
      <FirstLoginPasswordModal />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
