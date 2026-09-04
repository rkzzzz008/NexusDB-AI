import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import { SystemLog } from '../../types.js';
import {
  Activity,
  History,
  Sparkles,
  Database,
  FilePlus,
  Edit3,
  Trash2,
  Share2,
  UploadCloud,
  Download,
  LogIn,
  LogOut,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Copy,
  Check,
  DownloadCloud,
  FileText,
  Sliders,
  ChevronDown,
  Layers,
  Bot,
  Wand2,
  Users,
  Link,
  Archive,
} from 'lucide-react';

export const ActivityTimeline: React.FC = () => {
  const { user, token } = useAuth();
  const { databases, addToast } = useDatabase();

  const [activities, setActivities] = useState<SystemLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchActivities = async (isManualRefresh = false) => {
    if (!token) return;
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const res = await fetch('/api/activity', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      } else {
        // Fallback to admin logs if endpoint returns non-200
        const adminRes = await fetch('/api/admin/logs', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (adminRes.ok) {
          const adminData = await adminRes.json();
          setActivities(adminData.logs || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch activity logs', err);
      addToast('Error', 'Could not load activity timeline.', 'error');
    } finally {
      setIsLoading(false);
      if (isManualRefresh) {
        setTimeout(() => setIsRefreshing(false), 400);
      }
    }
  };

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(() => {
      fetchActivities();
    }, 15000); // Polling every 15s for realtime live stream
    return () => clearInterval(interval);
  }, [token]);

  const handleClearActivities = async () => {
    if (!token) return;
    setIsClearing(true);
    try {
      const res = await fetch('/api/activity/clear', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setActivities([]);
        addToast('Activity Cleared', 'All activity records have been cleared.', 'success');
      } else {
        addToast('Error', 'Failed to clear activity timeline.', 'error');
      }
    } catch (e) {
      addToast('Error', 'Server connection error.', 'error');
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };

  const handleCopyLog = (log: SystemLog) => {
    const text = `[${log.timestamp}] [${log.action}] (${log.user}): ${log.details}`;
    navigator.clipboard.writeText(text);
    setCopiedLogId(log.id);
    addToast('Copied', 'Log details copied to clipboard.', 'info');
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  const handleExportLogs = (format: 'json' | 'csv') => {
    if (filteredActivities.length === 0) {
      addToast('Export Warning', 'No activities to export with current filters.', 'warning');
      return;
    }

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(filteredActivities, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexusdb_activity_log_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Export Complete', 'Activity timeline exported as JSON.', 'success');
    } else {
      const headers = ['ID', 'Timestamp', 'Action', 'Category', 'Type', 'User', 'Details'];
      const rows = filteredActivities.map((l) => [
        `"${l.id}"`,
        `"${l.timestamp}"`,
        `"${l.action.replace(/"/g, '""')}"`,
        `"${(l.category || 'General').replace(/"/g, '""')}"`,
        `"${l.type}"`,
        `"${l.user}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexusdb_activity_log_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Export Complete', 'Activity timeline exported as CSV.', 'success');
    }
  };

  // Helper to categorize log if category field is generic or missing
  const getActionCategory = (log: SystemLog): string => {
    const act = (log.action || '').toLowerCase();
    const cat = (log.category || '').toLowerCase();
    const det = (log.details || '').toLowerCase();

    if (cat === 'ai' || act.includes('ai') || det.includes('ai') || act.includes('insight') || act.includes('report') || act.includes('cleaning')) {
      return 'ai';
    }
    if (cat === 'authentication' || cat === 'auth' || act.includes('login') || act.includes('logout') || act.includes('register') || act.includes('password')) {
      return 'auth';
    }
    if (cat === 'database' || act.includes('database') || act.includes('schema')) {
      return 'database';
    }
    if (cat === 'record' || act.includes('record')) {
      return 'record';
    }
    if (cat === 'sharing' || act.includes('share') || act.includes('collaborator') || act.includes('link')) {
      return 'sharing';
    }
    if (cat === 'import' || act.includes('import') || act.includes('restore') || act.includes('csv imported')) {
      return 'import';
    }
    if (cat === 'export' || act.includes('export') || act.includes('download')) {
      return 'export';
    }
    return 'general';
  };

  // Icon, color and styling mapping per action
  const getActivityMeta = (log: SystemLog) => {
    const act = (log.action || '').toLowerCase();
    const cat = getActionCategory(log);

    // AI actions
    if (cat === 'ai') {
      return {
        icon: Sparkles,
        color: 'text-violet-600 dark:text-violet-400',
        bg: 'bg-violet-50 dark:bg-violet-950/60 border-violet-200 dark:border-violet-800',
        badgeBg: 'bg-violet-100 text-violet-700 dark:bg-violet-950/80 dark:text-violet-300 border border-violet-200 dark:border-violet-800',
        label: 'AI Action',
      };
    }

    // Auth actions
    if (cat === 'auth') {
      if (act.includes('logout')) {
        return {
          icon: LogOut,
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
          badgeBg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
          label: 'Logout',
        };
      }
      return {
        icon: LogIn,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
        badgeBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
        label: 'Login',
      };
    }

    // Database actions
    if (cat === 'database') {
      if (act.includes('delete')) {
        return {
          icon: Trash2,
          color: 'text-rose-600 dark:text-rose-400',
          bg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800',
          badgeBg: 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
          label: 'Database Deletion',
        };
      }
      if (act.includes('update')) {
        return {
          icon: Edit3,
          color: 'text-blue-600 dark:text-blue-400',
          bg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800',
          badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
          label: 'Database Update',
        };
      }
      return {
        icon: Database,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800',
        badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
        label: 'Database Creation',
      };
    }

    // Record actions
    if (cat === 'record') {
      if (act.includes('delete')) {
        return {
          icon: Trash2,
          color: 'text-rose-600 dark:text-rose-400',
          bg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800',
          badgeBg: 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
          label: 'Record Deletion',
        };
      }
      if (act.includes('edit') || act.includes('update') || act.includes('archive')) {
        return {
          icon: Edit3,
          color: 'text-sky-600 dark:text-sky-400',
          bg: 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800',
          badgeBg: 'bg-sky-100 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
          label: 'Record Editing',
        };
      }
      return {
        icon: FilePlus,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
        badgeBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
        label: 'Record Creation',
      };
    }

    // Sharing actions
    if (cat === 'sharing') {
      return {
        icon: Share2,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800',
        badgeBg: 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
        label: 'Database Sharing',
      };
    }

    // Import actions
    if (cat === 'import') {
      return {
        icon: UploadCloud,
        color: 'text-teal-600 dark:text-teal-400',
        bg: 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800',
        badgeBg: 'bg-teal-100 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
        label: 'Imports',
      };
    }

    // Export actions
    if (cat === 'export') {
      return {
        icon: Download,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
        badgeBg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
        label: 'Exports',
      };
    }

    // Default general
    return {
      icon: Activity,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800',
      badgeBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
      label: 'Activity',
    };
  };

  // Relative time formatter
  const formatRelativeTime = (timestampStr: string): string => {
    try {
      const now = Date.now();
      const date = new Date(timestampStr).getTime();
      const diffSec = Math.floor((now - date) / 1000);

      if (diffSec < 5) return 'Just now';
      if (diffSec < 60) return `${diffSec} seconds ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return new Date(timestampStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return timestampStr;
    }
  };

  // Date Group key generator
  const getDateGroupKey = (timestampStr: string): string => {
    try {
      const d = new Date(timestampStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (d.toDateString() === today.toDateString()) {
        return 'Today';
      }
      if (d.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      return d.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Recent Activities';
    }
  };

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return activities.filter((log) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAction = (log.action || '').toLowerCase().includes(q);
        const matchDetails = (log.details || '').toLowerCase().includes(q);
        const matchUser = (log.user || '').toLowerCase().includes(q);
        const matchCat = (log.category || '').toLowerCase().includes(q);
        if (!matchAction && !matchDetails && !matchUser && !matchCat) return false;
      }

      // Category filter
      if (selectedCategory !== 'all') {
        const cat = getActionCategory(log);
        if (selectedCategory === 'auth' && cat !== 'auth') return false;
        if (selectedCategory === 'database' && cat !== 'database') return false;
        if (selectedCategory === 'record' && cat !== 'record') return false;
        if (selectedCategory === 'sharing' && cat !== 'sharing') return false;
        if (selectedCategory === 'import' && cat !== 'import') return false;
        if (selectedCategory === 'export' && cat !== 'export') return false;
        if (selectedCategory === 'ai' && cat !== 'ai') return false;
      }

      // Severity / Type filter
      if (selectedType !== 'all') {
        if (log.type !== selectedType) return false;
      }

      // Timeframe filter
      if (timeFilter !== 'all') {
        const logTime = new Date(log.timestamp).getTime();
        const now = Date.now();
        if (timeFilter === 'today') {
          const oneDay = 24 * 60 * 60 * 1000;
          if (now - logTime > oneDay) return false;
        } else if (timeFilter === 'week') {
          const oneWeek = 7 * 24 * 60 * 60 * 1000;
          if (now - logTime > oneWeek) return false;
        } else if (timeFilter === 'month') {
          const oneMonth = 30 * 24 * 60 * 60 * 1000;
          if (now - logTime > oneMonth) return false;
        }
      }

      return true;
    });
  }, [activities, searchQuery, selectedCategory, selectedType, timeFilter]);

  // Grouped by Date
  const groupedActivities: Record<string, SystemLog[]> = useMemo(() => {
    const groups: Record<string, SystemLog[]> = {};
    for (const log of filteredActivities) {
      const key = getDateGroupKey(log.timestamp);
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    }
    return groups;
  }, [filteredActivities]);

  // KPI Calculations
  const stats = useMemo(() => {
    let aiCount = 0;
    let dataCount = 0;
    let accessCount = 0;

    activities.forEach((l) => {
      const cat = getActionCategory(l);
      if (cat === 'ai') aiCount++;
      else if (cat === 'database' || cat === 'record' || cat === 'import' || cat === 'export') dataCount++;
      else if (cat === 'auth' || cat === 'sharing') accessCount++;
    });

    return {
      total: activities.length,
      aiCount,
      dataCount,
      accessCount,
    };
  }, [activities]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/20">
            <History className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Activity Timeline
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Stream
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Real-time chronological tracking of all user logins, database creations, records, sharing, imports, exports, and AI actions.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchActivities(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm"
            title="Refresh Timeline"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <div className="relative group">
            <button className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm">
              <Download className="w-3.5 h-3.5" />
              <span>Export Log</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 hidden group-hover:block z-20">
              <button
                onClick={() => handleExportLogs('csv')}
                className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                CSV Format
              </button>
              <button
                onClick={() => handleExportLogs('json')}
                className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-amber-500" />
                JSON Dataset
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="p-2 text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all shadow-sm"
            title="Clear Activity Log"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Activities
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {stats.total}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              AI Operations
            </span>
            <div className="text-2xl font-black text-violet-600 dark:text-violet-400">
              {stats.aiCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Data Operations
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.dataCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Access & Sharing
            </span>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {stats.accessCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Interactive Filters Panel */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Search & Selectors Row */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Field */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actions, emails, keywords, details..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type & Timeframe selectors */}
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="dark:bg-slate-900">All Statuses</option>
                <option value="success" className="dark:bg-slate-900">Success</option>
                <option value="info" className="dark:bg-slate-900">Info</option>
                <option value="warning" className="dark:bg-slate-900">Warning</option>
                <option value="error" className="dark:bg-slate-900">Error</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as any)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="dark:bg-slate-900">All Time</option>
                <option value="today" className="dark:bg-slate-900">Today</option>
                <option value="week" className="dark:bg-slate-900">Past 7 Days</option>
                <option value="month" className="dark:bg-slate-900">Past 30 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Pills (Covering all 10 tracked areas) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1 border-t border-slate-100 dark:border-slate-800/80">
          {[
            { id: 'all', label: 'All Activities', icon: Activity },
            { id: 'auth', label: 'Login & Logout', icon: LogIn },
            { id: 'database', label: 'Database Creation', icon: Database },
            { id: 'record', label: 'Records (Add/Edit/Del)', icon: FilePlus },
            { id: 'sharing', label: 'Database Sharing', icon: Share2 },
            { id: 'import', label: 'Imports', icon: UploadCloud },
            { id: 'export', label: 'Exports', icon: Download },
            { id: 'ai', label: 'AI Actions', icon: Sparkles },
          ].map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Timeline Stream */}
      {isLoading ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading activity timeline...</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 w-fit mx-auto text-slate-400">
            <History className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">No activities match your filters</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Try adjusting your search keywords, category filters, or date range to see logged events.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedType('all');
              setTimeFilter('all');
            }}
            className="px-4 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 rounded-xl hover:bg-blue-100 transition-colors"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedActivities).map(([dateGroup, items]) => (
            <div key={dateGroup} className="space-y-4">
              {/* Date Group Marker */}
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700">
                  <Calendar className="w-3 h-3 text-blue-500" />
                  {dateGroup}
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span className="text-[11px] font-semibold text-slate-400">
                  {items.length} event{items.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Vertical Timeline Nodes */}
              <div className="relative pl-6 space-y-4 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {items.map((log) => {
                  const meta = getActivityMeta(log);
                  const Icon = meta.icon;
                  const relativeTime = formatRelativeTime(log.timestamp);
                  const isCopied = copiedLogId === log.id;

                  return (
                    <div
                      key={log.id}
                      className="relative group transition-all"
                    >
                      {/* Timeline Node Icon */}
                      <div
                        className={`absolute -left-6 top-3 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm ${meta.bg}`}
                      >
                        <Icon className={`w-3 h-3 ${meta.color}`} />
                      </div>

                      {/* Event Card */}
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow-md transition-all space-y-2.5">
                        {/* Card Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
                              {log.action}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${meta.badgeBg}`}>
                              {meta.label}
                            </span>
                            {log.type === 'error' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300">
                                Failed
                              </span>
                            )}
                            {log.type === 'warning' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300">
                                Warning
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-slate-400 text-xs">
                            <span className="flex items-center gap-1 font-mono text-[11px]" title={new Date(log.timestamp).toLocaleString()}>
                              <Clock className="w-3 h-3" />
                              {relativeTime}
                            </span>
                            <button
                              onClick={() => handleCopyLog(log)}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="Copy log entry"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Details Message */}
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                          {log.details}
                        </p>

                        {/* Footer Actor & Timestamp Meta */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-700 dark:text-slate-300">
                              {(log.user || 'U')[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {log.user}
                            </span>
                            {log.user === user?.email && (
                              <span className="text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1 py-0.2 rounded font-semibold">
                                You
                              </span>
                            )}
                          </div>

                          <span className="font-mono text-[10px] text-slate-400 hidden sm:inline">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Clear Activity Timeline?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              This will clear your personal activity audit records. System events will start logging afresh on your next action.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearActivities}
                disabled={isClearing}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm"
              >
                {isClearing ? 'Clearing...' : 'Clear History'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
