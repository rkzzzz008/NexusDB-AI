import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, Role } from '../types.js';

interface AuthResult {
  success: boolean;
  message?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password?: string) => Promise<AuthResult>;
  register: (
    name: string,
    email: string,
    password?: string,
    confirmPassword?: string,
    department?: string
  ) => Promise<AuthResult>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<{ message: string; resetToken?: string; resetUrl?: string }>;
  resetPassword: (token: string, newPassword: string, confirmPassword?: string) => Promise<AuthResult>;
  updateProfile: (data: {
    name?: string;
    department?: string;
    avatar?: string;
    themePreference?: 'light' | 'dark' | 'system';
    newPassword?: string;
  }) => Promise<AuthResult>;
  isAdmin: boolean;
  isEditor: boolean;
  canEdit: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('nexus_token'));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const isMountedRef = useRef(true);

  // Memoize fetchCurrentUser to prevent re-creation on every render
  const fetchCurrentUser = useCallback(async (currentToken: string | null) => {
    if (!currentToken) {
      console.log('[Auth] No token - skipping fetchCurrentUser');
      if (isMountedRef.current) {
        setUser(null);
        setLoading(false);
      }
      return;
    }

    try {
      console.log('[Auth] Validating token with /api/auth/me...');
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (isMountedRef.current) {
          console.log('[Auth] Token valid - user:', data.user?.email);
          setUser(data.user);
        }
      } else if (res.status === 401) {
        // Only clear token on actual 401 Unauthorized
        console.warn('[DEBUG] 401 received');
        console.error('[Auth] 401 Unauthorized - token invalid, logging out');
        if (isMountedRef.current) {
          setToken(null);
          setUser(null);
          localStorage.removeItem('nexus_token');
          console.log('[DEBUG] Token removed');
        }
      } else {
        // For other errors (500, etc), just log the error and keep user logged in
        console.warn('[Auth] Non-401 error from /api/auth/me:', res.status, '- keeping session alive');
        if (isMountedRef.current) {
          setUser(null); // Clear user but keep token
        }
      }
    } catch (e) {
      console.error('[Auth] Network error fetching auth state:', e);
      if (isMountedRef.current) {
        setUser(null); // Clear user but keep token on network errors
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Only call fetchCurrentUser when token actually changes
  useEffect(() => {
    if (token) {
      console.log('[DEBUG] Token loaded');
    }
    fetchCurrentUser(token);
  }, [token, fetchCurrentUser]);

  // Ensure isMounted is true on mount and cleaned up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const login = async (email: string, password?: string): Promise<AuthResult> => {
    try {
      console.log('[Auth] Login attempt for:', email);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        console.log('[DEBUG] Login success');
        console.log('[Auth] Login successful for:', email);
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('nexus_token', data.token);
        console.log('[DEBUG] Token loaded');
        return { success: true, message: data.message };
      } else {
        console.warn('[Auth] Login failed:', data.error);
        return { success: false, message: data.error || 'Invalid credentials' };
      }
    } catch (e: any) {
      console.error('[Auth] Login network error:', e.message);
      return { success: false, message: 'Server connection error' };
    }
  };

  const register = async (
    name: string,
    email: string,
    password?: string,
    confirmPassword?: string,
    department?: string
  ): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, confirmPassword, department }),
      });

      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('nexus_token', data.token);
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.error || 'Registration failed' };
      }
    } catch (e: any) {
      return { success: false, message: 'Server connection error' };
    }
  };

  const logout = async () => {
    console.log('[DEBUG] Logout called');
    try {
      console.log('[Auth] Logout initiated');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (e) {
      console.warn('[Auth] Logout notification error', e);
    } finally {
      console.log('[Auth] Logout completed - clearing session');
      setToken(null);
      setUser(null);
      localStorage.removeItem('nexus_token');
      console.log('[DEBUG] Token removed');
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { message: data.error || 'Failed to generate reset link.' };
      }
      return {
        message: data.message || 'Password reset link sent.',
        resetToken: data.resetToken,
        resetUrl: data.resetUrl,
      };
    } catch (e) {
      return { message: 'Failed to send password reset.' };
    }
  };

  const resetPassword = async (token: string, newPassword: string, confirmPassword?: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.error || 'Password reset failed.' };
      }
    } catch (e) {
      return { success: false, message: 'Server connection error.' };
    }
  };


  const updateProfile = async (updates: {
    name?: string;
    department?: string;
    avatar?: string;
    themePreference?: 'light' | 'dark' | 'system';
    newPassword?: string;
  }): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.error || 'Failed to update profile' };
      }
    } catch (e) {
      return { success: false, message: 'Server connection error' };
    }
  };

  const role = user?.role || 'Viewer';
  const isAdmin = role === 'Admin';
  const isEditor = role === 'Editor' || role === 'Admin';
  const canEdit = isEditor;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        updateProfile,
        isAdmin,
        isEditor,
        canEdit,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
