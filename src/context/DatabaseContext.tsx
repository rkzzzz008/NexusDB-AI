import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DatabaseSchema, RecordItem, ToastMessage, AIQueryResponse, AIChartConfig, NotificationItem, Role, DataCleaningFixItem, AIReportData } from '../types.js';
import { useAuth } from './AuthContext.tsx';
import { useTheme } from './ThemeContext.tsx';

interface DatabaseContextType {
  databases: DatabaseSchema[];
  activeDatabase: DatabaseSchema | null;
  setActiveDatabase: (db: DatabaseSchema | null) => void;
  records: RecordItem[];
  setRecords: React.Dispatch<React.SetStateAction<RecordItem[]>>;
  loading: boolean;
  toasts: ToastMessage[];
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  addToast: (title: string, message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  fetchDatabases: () => Promise<void>;
  fetchRecords: (databaseId?: string) => Promise<void>;
  fetchNotifications: () => Promise<void>;
  createNotification: (options: {
    title: string;
    message: string;
    type?: 'share' | 'invite' | 'import' | 'export' | 'ai' | 'system';
    link?: string;
    databaseId?: string;
  }) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
  acceptShareInvitation: (databaseId: string) => Promise<boolean>;
  createDatabase: (data: Partial<DatabaseSchema>) => Promise<DatabaseSchema | null>;
  generateAIDatabase: (prompt: string, autoCreate?: boolean) => Promise<any>;
  updateDatabase: (id: string, data: Partial<DatabaseSchema>) => Promise<boolean>;
  deleteDatabase: (id: string) => Promise<boolean>;
  toggleFavoriteDatabase: (id: string) => Promise<boolean>;
  addCollaborator: (databaseId: string, email: string, role: Role, name?: string) => Promise<boolean>;
  removeCollaborator: (databaseId: string, email: string) => Promise<boolean>;
  updateCollaboratorRole: (databaseId: string, email: string, role: Role) => Promise<boolean>;
  createShareLink: (databaseId: string, options: { role: Role; allowPublicEdit?: boolean; maxUses?: number; expiresAt?: string }) => Promise<any>;
  deleteShareLink: (databaseId: string, linkId: string) => Promise<boolean>;
  createRecord: (databaseId: string, data: Record<string, any>) => Promise<RecordItem | null>;
  updateRecord: (id: string, data: Record<string, any>, isArchived?: boolean) => Promise<boolean>;
  deleteRecord: (id: string) => Promise<boolean>;
  duplicateRecord: (id: string) => Promise<boolean>;
  bulkDeleteRecords: (recordIds: string[]) => Promise<boolean>;
  bulkArchiveRecords: (recordIds: string[], archive: boolean) => Promise<boolean>;
  bulkUpdateRecords: (recordIds: string[], fieldName: string, fieldValue: any) => Promise<boolean>;
  applyDataCleaningFixes: (databaseId: string, approvedFixes: DataCleaningFixItem[]) => Promise<boolean>;
  generateAIReport: (databaseId: string) => Promise<AIReportData | null>;
  importCSVRecords: (databaseId: string, rows: Record<string, any>[]) => Promise<boolean>;
  queryAI: (prompt: string, databaseId?: string) => Promise<AIQueryResponse | null>;
  exportWorkspace: () => Promise<void>;
  importWorkspace: (payload: { databases: any[]; records: any[] }) => Promise<boolean>;
  clearWorkspace: () => Promise<boolean>;
  activeRecordFilterIds: string[] | null;
  setActiveRecordFilterIds: (ids: string[] | null) => void;
  activeChartConfig: AIChartConfig | null;
  setActiveChartConfig: (config: AIChartConfig | null) => void;
  themeMode: 'light' | 'dark' | 'system';
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  isDarkMode: boolean;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user, updateProfile } = useAuth();
  const [databases, setDatabases] = useState<DatabaseSchema[]>([]);
  const [activeDatabase, setActiveDatabase] = useState<DatabaseSchema | null>(null);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeRecordFilterIds, setActiveRecordFilterIds] = useState<string[] | null>(null);
  const [activeChartConfig, setActiveChartConfig] = useState<AIChartConfig | null>(null);
  const isMountedRef = useRef(true);

  // Theme Management delegating to ThemeProvider
  const { themeMode, setThemeMode, isDarkMode } = useTheme();

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [token]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notifications', { headers: getHeaders() });
      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (e) {
      console.error('Fetch notifications error', e);
    }
  }, [token, getHeaders]);

  const fetchDatabases = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      console.log('[DEBUG] Database request started');
      const res = await fetch('/api/databases', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const loadedDbs = data.databases || [];
        if (isMountedRef.current) {
          setDatabases(loadedDbs);
          setActiveDatabase((prev) => prev || (loadedDbs.length > 0 ? loadedDbs[0] : null));
        }
      } else {
        console.warn('[DEBUG] Database request failed');
      }
    } catch (e) {
      console.error('[DEBUG] Database request failed', e);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [token, getHeaders]);

  const fetchRecords = useCallback(async (databaseId?: string) => {
    if (!token) return;
    try {
      const url = databaseId ? `/api/records?databaseId=${databaseId}&includeArchived=true` : '/api/records?includeArchived=true';
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        setRecords(data.records);
      }
    } catch (e) {
      console.error('Fetch records error', e);
    }
  }, [token, getHeaders]);

  // Fetch databases and notifications on mount/token change
  useEffect(() => {
    if (!token) {
      setDatabases([]);
      setRecords([]);
      setNotifications([]);
      setLoading(false);
      return;
    }

    fetchDatabases();
    fetchNotifications();

    // Auto-poll notifications every 12 seconds
    const interval = setInterval(() => {
      if (token && isMountedRef.current) {
        fetchNotifications();
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [token, fetchDatabases, fetchNotifications]);

  // Fetch records when activeDatabase changes
  useEffect(() => {
    if (activeDatabase && token) {
      fetchRecords(activeDatabase.id);
    } else if (token) {
      fetchRecords();
    }
  }, [activeDatabase?.id, token, fetchRecords]);

  // Cleanup on unmount & ensure true on mount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const addToast = (
    title: string,
    message: string,
    type: 'success' | 'warning' | 'error' | 'info' = 'success'
  ) => {
    const id = 'toast-' + Date.now() + '-' + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const createNotification = async (options: {
    title: string;
    message: string;
    type?: 'share' | 'invite' | 'import' | 'export' | 'ai' | 'system';
    link?: string;
    databaseId?: string;
  }) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(options),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.notification && isMountedRef.current) {
          setNotifications((prev) => [data.notification, ...prev]);
        }
      }
    } catch (e) {
      console.error('Create notification error', e);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH', headers: getHeaders() });
    } catch (e) {
      console.error('Mark notification read error', e);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await fetch('/api/notifications/read-all', { method: 'PATCH', headers: getHeaders() });
    } catch (e) {
      console.error('Mark all read error', e);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      await fetch(`/api/notifications/${id}`, { method: 'DELETE', headers: getHeaders() });
    } catch (e) {
      console.error('Delete notification error', e);
    }
  };

  const clearNotifications = async () => {
    try {
      setNotifications([]);
      await fetch('/api/notifications', { method: 'DELETE', headers: getHeaders() });
    } catch (e) {
      console.error('Clear notifications error', e);
    }
  };

  const acceptShareInvitation = async (databaseId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/databases/${databaseId}/accept-invite`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        addToast('Invitation Accepted', 'You now have access to this shared database.', 'success');
        await fetchDatabases();
        await fetchNotifications();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Accept invite error', e);
      return false;
    }
  };

  const createDatabase = async (data: Partial<DatabaseSchema>) => {
    try {
      const res = await fetch('/api/databases', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        setDatabases((prev) => [...prev, result.database]);
        setActiveDatabase(result.database);
        addToast('Database Created', `"${result.database.name}" is now ready to use.`, 'success');
        return result.database;
      }
    } catch (e) {
      addToast('Error', 'Failed to create database.', 'error');
    }
    return null;
  };

  const generateAIDatabase = async (prompt: string, autoCreate = true) => {
    console.log('[DEBUG] AI request started');
    try {
      const res = await fetch('/api/ai/generate-database', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ prompt, autoCreate }),
      });
      if (res.ok) {
        const result = await res.json();
        if (autoCreate && result.database) {
          setDatabases((prev) => [...prev, result.database]);
          setActiveDatabase(result.database);
          if (Array.isArray(result.records)) {
            setRecords((prev) => [...result.records, ...prev]);
          }
          addToast('AI Database Generated', `Created "${result.database.name}" with sample records!`, 'success');
        }
        console.log('[DEBUG] AI request finished');
        return result;
      } else {
        console.warn('[DEBUG] AI request failed');
      }
    } catch (e) {
      console.warn('[DEBUG] AI request failed');
      addToast('AI Error', 'Failed to generate AI database.', 'error');
    }
    return null;
  };

  const updateDatabase = async (id: string, data: Partial<DatabaseSchema>) => {
    try {
      const res = await fetch(`/api/databases/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        setDatabases((prev) => prev.map((d) => (d.id === id ? result.database : d)));
        if (activeDatabase?.id === id) setActiveDatabase(result.database);
        addToast('Database Updated', 'Schema changes saved successfully.', 'info');
        return true;
      }
    } catch (e) {
      addToast('Error', 'Failed to update database schema.', 'error');
    }
    return false;
  };

  const deleteDatabase = async (id: string) => {
    try {
      const dbToDelete = databases.find((d) => d.id === id);
      const res = await fetch(`/api/databases/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        setDatabases((prev) => prev.filter((d) => d.id !== id));
        if (activeDatabase?.id === id) {
          const remaining = databases.filter((d) => d.id !== id);
          setActiveDatabase(remaining[0] || null);
        }
        addToast('Database Deleted', `Deleted "${dbToDelete?.name || 'Database'}".`, 'warning');
        return true;
      }
    } catch (e) {
      addToast('Error', 'Failed to delete database.', 'error');
    }
    return false;
  };

  const toggleFavoriteDatabase = async (id: string) => {
    try {
      const res = await fetch(`/api/databases/${id}/favorite`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDatabases((prev) =>
          prev.map((d) => (d.id === id ? { ...d, isFavorite: data.isFavorite } : d))
        );
        if (activeDatabase?.id === id) {
          setActiveDatabase((prev) => (prev ? { ...prev, isFavorite: data.isFavorite } : null));
        }
        addToast(
          data.isFavorite ? 'Added to Favorites' : 'Removed from Favorites',
          data.isFavorite
            ? 'Database added to your starred favorites.'
            : 'Database removed from favorites.',
          'info'
        );
        return true;
      }
    } catch (e) {
      addToast('Error', 'Failed to update favorite status.', 'error');
    }
    return false;
  };

  // Collaboration methods
  const addCollaborator = async (databaseId: string, email: string, role: Role, name?: string) => {
    try {
      const res = await fetch(`/api/databases/${databaseId}/collaborators`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email, role, name }),
      });
      if (res.ok) {
        const data = await res.json();
        setDatabases((prev) => prev.map((d) => (d.id === databaseId ? data.database : d)));
        if (activeDatabase?.id === databaseId) setActiveDatabase(data.database);
        addToast('Collaborator Added', `Added ${email} as ${role}.`, 'success');
        return true;
      } else {
        const data = await res.json();
        addToast('Sharing Error', data.error || 'Failed to add collaborator.', 'error');
      }
    } catch (e) {
      addToast('Error', 'Server connection error.', 'error');
    }
    return false;
  };

  const removeCollaborator = async (databaseId: string, email: string) => {
    try {
      const res = await fetch(`/api/databases/${databaseId}/collaborators/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDatabases((prev) => prev.map((d) => (d.id === databaseId ? data.database : d)));
        if (activeDatabase?.id === databaseId) setActiveDatabase(data.database);
        addToast('Access Revoked', `Removed ${email} from workspace.`, 'info');
        return true;
      }
    } catch (e) {
      addToast('Error', 'Failed to remove collaborator.', 'error');
    }
    return false;
  };

  const updateCollaboratorRole = async (databaseId: string, email: string, role: Role) => {
    try {
      const res = await fetch(`/api/databases/${databaseId}/collaborators/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        const data = await res.json();
        setDatabases((prev) => prev.map((d) => (d.id === databaseId ? data.database : d)));
        if (activeDatabase?.id === databaseId) setActiveDatabase(data.database);
        addToast('Role Updated', `Changed ${email} to ${role}.`, 'info');
        return true;
      }
    } catch (e) {
      addToast('Error', 'Failed to update role.', 'error');
    }
    return false;
  };

  const createShareLink = async (databaseId: string, options: { role: Role; allowPublicEdit?: boolean; maxUses?: number; expiresAt?: string }) => {
    try {
      const res = await fetch(`/api/databases/${databaseId}/share-links`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(options),
      });
      if (res.ok) {
        const data = await res.json();
        setDatabases((prev) => prev.map((d) => (d.id === databaseId ? data.database : d)));
        if (activeDatabase?.id === databaseId) setActiveDatabase(data.database);
        addToast('Share Link Created', 'Public link is ready to copy.', 'success');
        return data.shareLink;
      }
    } catch (e) {
      addToast('Error', 'Failed to create share link.', 'error');
    }
    return null;
  };

  const deleteShareLink = async (databaseId: string, linkId: string) => {
    try {
      const res = await fetch(`/api/databases/${databaseId}/share-links/${linkId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDatabases((prev) => prev.map((d) => (d.id === databaseId ? data.database : d)));
        if (activeDatabase?.id === databaseId) setActiveDatabase(data.database);
        addToast('Link Revoked', 'Share link is no longer active.', 'warning');
        return true;
      }
    } catch (e) {
      addToast('Error', 'Failed to delete share link.', 'error');
    }
    return false;
  };

  const createRecord = async (databaseId: string, data: Record<string, any>) => {
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ databaseId, data }),
      });
      if (res.ok) {
        const result = await res.json();
        setRecords((prev) => [result.record, ...prev]);
        addToast('Record Created', 'New record added to database.', 'success');
        return result.record;
      }
    } catch (e) {
      addToast('Error', 'Failed to insert record.', 'error');
    }
    return null;
  };

  const updateRecord = async (id: string, data: Record<string, any>, isArchived?: boolean) => {
    try {
      const res = await fetch(`/api/records/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ data, isArchived }),
      });
      if (res.ok) {
        const result = await res.json();
        setRecords((prev) => prev.map((r) => (r.id === id ? result.record : r)));
        addToast('Record Saved', 'Changes committed.', 'info');
        return true;
      }
    } catch (e) {
      addToast('Error', 'Failed to update record.', 'error');
    }
    return false;
  };

  const deleteRecord = async (id: string) => {
    try {
      const res = await fetch(`/api/records/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        addToast('Record Removed', 'Record deleted permanently.', 'warning');
        return true;
      }
    } catch (e) {
      addToast('Error', 'Failed to delete record.', 'error');
    }
    return false;
  };

  const duplicateRecord = async (id: string) => {
    try {
      const res = await fetch(`/api/records/${id}/duplicate`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        const result = await res.json();
        setRecords((prev) => [result.record, ...prev]);
        addToast('Record Duplicated', 'Cloned record created.', 'success');
        return true;
      }
    } catch (e) {
      addToast('Error', 'Failed to duplicate record.', 'error');
    }
    return false;
  };

  const bulkDeleteRecords = async (recordIds: string[]) => {
    try {
      const res = await fetch('/api/records/bulk-delete', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ recordIds }),
      });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => !recordIds.includes(r.id)));
        addToast('Bulk Operation', `Deleted ${recordIds.length} records.`, 'warning');
        return true;
      }
    } catch (e) {
      addToast('Error', 'Failed bulk delete.', 'error');
    }
    return false;
  };

  const bulkArchiveRecords = async (recordIds: string[], archive: boolean) => {
    try {
      const res = await fetch('/api/records/bulk-archive', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ recordIds, archive }),
      });
      if (res.ok) {
        setRecords((prev) =>
          prev.map((r) => (recordIds.includes(r.id) ? { ...r, isArchived: archive } : r))
        );
        addToast('Bulk Operation', `${archive ? 'Archived' : 'Restored'} ${recordIds.length} records.`, 'info');
        return true;
      }
    } catch (e) {
      addToast('Error', 'Failed bulk archive update.', 'error');
    }
    return false;
  };

  const bulkUpdateRecords = async (recordIds: string[], fieldName: string, fieldValue: any) => {
    try {
      const res = await fetch('/api/records/bulk-update', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ recordIds, fieldName, fieldValue }),
      });
      if (res.ok) {
        setRecords((prev) =>
          prev.map((r) =>
            recordIds.includes(r.id)
              ? { ...r, data: { ...r.data, [fieldName]: fieldValue }, updatedAt: new Date().toISOString() }
              : r
          )
        );
        addToast('Bulk Update', `Updated "${fieldName}" for ${recordIds.length} records.`, 'success');
        return true;
      }
    } catch (e) {
      addToast('Error', 'Failed bulk field update.', 'error');
    }
    return false;
  };

  const applyDataCleaningFixes = async (databaseId: string, approvedFixes: DataCleaningFixItem[]) => {
    try {
      const res = await fetch('/api/ai/clean-data/apply', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ databaseId, approvedFixes }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchRecords(databaseId);
        addToast(
          'Data Cleaned with AI',
          `Successfully applied ${data.appliedCount} fix(es) to your database.`,
          'success'
        );
        return true;
      } else {
        const err = await res.json();
        addToast('Error', err.error || 'Failed to apply data cleaning fixes.', 'error');
      }
    } catch (e) {
      addToast('Error', 'Failed to communicate with AI data cleaning service.', 'error');
    }
    return false;
  };

  const generateAIReport = async (databaseId: string): Promise<AIReportData | null> => {
    try {
      const res = await fetch(`/api/ai/report/${databaseId}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return data as AIReportData;
      } else {
        const err = await res.json();
        addToast('Error', err.error || 'Failed to generate AI report.', 'error');
      }
    } catch (e) {
      addToast('Error', 'Failed to communicate with AI report generator service.', 'error');
    }
    return null;
  };

  const importCSVRecords = async (databaseId: string, rows: Record<string, any>[]) => {
    try {
      const res = await fetch('/api/records/import-csv', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ databaseId, rows }),
      });
      if (res.ok) {
        await fetchRecords(databaseId);
        addToast('Import Success', `Imported ${rows.length} rows into database.`, 'success');
        return true;
      }
    } catch (e) {
      addToast('Error', 'Failed to import data.', 'error');
    }
    return false;
  };

  const queryAI = async (prompt: string, databaseId?: string): Promise<AIQueryResponse | null> => {
    console.log('[DEBUG] AI request started');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ prompt, databaseId }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data: AIQueryResponse = await res.json();
        console.log('[DEBUG] AI request finished');
        return data;
      } else {
        console.warn('[DEBUG] AI request failed');
        const errorData = await res.json().catch(() => ({}));
        console.error('[AI Query] Server error:', errorData);
        addToast('AI Error', errorData.error || 'AI query failed.', 'error');
      }
    } catch (e: any) {
      console.warn('[DEBUG] AI request failed');
      if (e.name === 'AbortError') {
        console.error('[AI Query] Request timed out (30s)');
        addToast('AI Timeout', 'AI Assistant took too long to respond. Please try a simpler query.', 'error');
      } else {
        console.error('[AI Query] Error:', e.message);
        addToast('AI Error', e.message || 'Failed to query AI Assistant.', 'error');
      }
    }
    return null;
  };

  const exportWorkspace = async () => {
    try {
      const res = await fetch('/api/workspace/export', { headers: getHeaders() });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nexusdb_workspace_backup_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        addToast('Workspace Exported', 'Downloaded complete workspace JSON backup.', 'success');
      }
    } catch (e) {
      addToast('Export Failed', 'Could not export workspace.', 'error');
    }
  };

  const importWorkspace = async (payload: { databases: any[]; records: any[] }) => {
    try {
      const res = await fetch('/api/workspace/import', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchDatabases();
        addToast('Workspace Restored', 'Successfully imported workspace data.', 'success');
        return true;
      }
    } catch (e) {
      addToast('Import Failed', 'Could not restore backup file.', 'error');
    }
    return false;
  };

  const clearWorkspace = async () => {
    try {
      const res = await fetch('/api/workspace/clear', {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        setDatabases([]);
        setActiveDatabase(null);
        setRecords([]);
        addToast('Workspace Cleared', 'All databases and records removed.', 'warning');
        return true;
      }
    } catch (e) {
      addToast('Error', 'Failed to clear workspace.', 'error');
    }
    return false;
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  return (
    <DatabaseContext.Provider
      value={{
        databases,
        activeDatabase,
        setActiveDatabase,
        records,
        setRecords,
        loading,
        toasts,
        notifications,
        unreadNotificationsCount,
        addToast,
        removeToast,
        fetchDatabases,
        fetchRecords,
        fetchNotifications,
        createNotification,
        markNotificationRead,
        markAllNotificationsRead,
        deleteNotification,
        clearNotifications,
        acceptShareInvitation,
        createDatabase,
        generateAIDatabase,
        updateDatabase,
        deleteDatabase,
        toggleFavoriteDatabase,
        addCollaborator,
        removeCollaborator,
        updateCollaboratorRole,
        createShareLink,
        deleteShareLink,
        createRecord,
        updateRecord,
        deleteRecord,
        duplicateRecord,
        bulkDeleteRecords,
        bulkArchiveRecords,
        bulkUpdateRecords,
        applyDataCleaningFixes,
        generateAIReport,
        importCSVRecords,
        queryAI,
        exportWorkspace,
        importWorkspace,
        clearWorkspace,
        activeRecordFilterIds,
        setActiveRecordFilterIds,
        activeChartConfig,
        setActiveChartConfig,
        themeMode,
        setThemeMode,
        isDarkMode,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) throw new Error('useDatabase must be used within DatabaseProvider');
  return context;
};

