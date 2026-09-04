import React, { useEffect, useState, useCallback } from 'react';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Database,
  Layers,
  Users,
  HardDrive,
  Sparkles,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Activity,
  FileSpreadsheet,
  Settings,
  ShieldAlert,
  GraduationCap,
  Package,
  Briefcase,
  Clock,
  Wand2,
  BookOpen,
  DollarSign,
  Star,
} from 'lucide-react';
import { DatabaseSchema } from '../../types.js';

interface DashboardOverviewProps {
  onSelectDatabase: (db: DatabaseSchema) => void;
  onOpenCreateDb: () => void;
  onOpenAI: () => void;
  onOpenImport: () => void;
  onOpenAICreator?: () => void;
  setActiveView: (view: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onSelectDatabase,
  onOpenCreateDb,
  onOpenAI,
  onOpenImport,
  onOpenAICreator,
  setActiveView,
}) => {
  const { databases, records, toggleFavoriteDatabase } = useDatabase();
  const { user, token } = useAuth();
  const [stats, setStats] = useState<any>({
    totalDatabases: (databases || []).length,
    totalRecords: (records || []).length,
    archivedRecords: 0,
    totalUsers: 3,
    storageMB: '12.4',
  });

  const favoriteDatabases = databases.filter((db) => !!db.isFavorite);

  // Use useCallback with token dependency to prevent infinite fetches
  useEffect(() => {
    if (!token) return;
    
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (e) {
        console.error('Fetch stats error', e);
      }
    };

    fetchStats();
  }, [token]); // Only refetch when token changes, not on every render

  const getDbIcon = (iconName: string) => {
    switch (iconName) {
      case 'GraduationCap':
        return <GraduationCap className="w-5 h-5 text-emerald-500" />;
      case 'Package':
        return <Package className="w-5 h-5 text-blue-500" />;
      case 'Users':
        return <Users className="w-5 h-5 text-violet-500" />;
      case 'Briefcase':
        return <Briefcase className="w-5 h-5 text-amber-500" />;
      case 'Activity':
        return <Activity className="w-5 h-5 text-rose-500" />;
      case 'BookOpen':
        return <BookOpen className="w-5 h-5 text-sky-500" />;
      case 'TrendingUp':
        return <TrendingUp className="w-5 h-5 text-emerald-500" />;
      case 'Clock':
        return <Clock className="w-5 h-5 text-cyan-500" />;
      case 'DollarSign':
        return <DollarSign className="w-5 h-5 text-emerald-500" />;
      default:
        return <Database className="w-5 h-5 text-cyan-500" />;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 border border-blue-800/60 shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-500/30">
              NexusDB SaaS Dashboard
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.name || 'Sarah Connor'} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Universal database engine active. 9 pre-built templates configured with Gemini AI assistant.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 flex-wrap">
          {onOpenAICreator && (
            <button
              onClick={onOpenAICreator}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition-all hover:scale-105"
            >
              <Wand2 className="w-4 h-4" />
              <span>AI Architect</span>
            </button>
          )}
          <button
            onClick={onOpenAI}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
          >
            <Sparkles className="w-4 h-4" />
            <span>Launch Gemini AI</span>
          </button>
          <button
            onClick={onOpenCreateDb}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Build Manual DB</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Databases</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
            {stats.totalDatabases || databases.length}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-2">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>9 Pre-configured Schema Templates</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Records</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
            {stats.totalRecords || records.length}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-2">
            <span>Synchronized across dynamic tables</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">System Users</span>
            <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
            {stats.totalUsers || 3}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-violet-600 dark:text-violet-400 mt-2">
            <span>Admin, Editor, Viewer Roles Active</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Storage Allocated</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
            {stats.storageMB || '12.4'} MB
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-2">
            <span>Optimal memory & DB index performance</span>
          </div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={onOpenCreateDb}
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 text-left transition-all group"
          >
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 w-fit mb-2 group-hover:scale-105 transition-transform">
              <Plus className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">New Database</div>
            <div className="text-[10px] text-slate-500">Custom fields & schema</div>
          </button>

          <button
            onClick={onOpenAI}
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-left transition-all group"
          >
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 w-fit mb-2 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">AI Query Assistant</div>
            <div className="text-[10px] text-slate-500">Natural language insights</div>
          </button>

          <button
            onClick={onOpenImport}
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 text-left transition-all group"
          >
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 w-fit mb-2 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">Import Database</div>
            <div className="text-[10px] text-slate-500">Excel, CSV, or JSON file</div>
          </button>

          <button
            onClick={() => setActiveView('analytics')}
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 text-left transition-all group"
          >
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 w-fit mb-2 group-hover:scale-105 transition-transform">
              <Activity className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">View Analytics</div>
            <div className="text-[10px] text-slate-500">Live charts & metrics</div>
          </button>
        </div>
      </div>

      {/* Favorite Databases Section */}
      {favoriteDatabases.length > 0 && (
        <div className="space-y-4" id="favorite-databases-section">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-500">
                <Star className="w-4 h-4 fill-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Favorite Databases</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                    {favoriteDatabases.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-500">Your starred databases for quick access</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {favoriteDatabases.map((db) => {
              const dbRecords = records.filter((r) => r.databaseId === db.id && !r.isArchived);
              return (
                <div
                  key={`fav-${db.id}`}
                  id={`favorite-db-card-${db.id}`}
                  onClick={() => onSelectDatabase(db)}
                  className="p-5 rounded-2xl bg-gradient-to-b from-amber-50/30 to-white dark:from-amber-950/10 dark:to-slate-900 border border-amber-200/80 dark:border-amber-900/40 hover:border-amber-400 dark:hover:border-amber-600 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-xl bg-amber-100/70 dark:bg-amber-950/60 group-hover:scale-110 transition-transform">
                        {getDbIcon(db.icon)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {db.category}
                        </span>
                        <button
                          type="button"
                          id={`toggle-fav-btn-top-${db.id}`}
                          title="Remove from favorites"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoriteDatabase(db.id);
                          }}
                          className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                        >
                          <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex items-center justify-between">
                      <span>{db.name}</span>
                      <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500" />
                    </h3>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {db.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-amber-100 dark:border-amber-950/50 flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {dbRecords.length} Records
                    </span>
                    <span>{(db?.fields || []).length} Fields</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Database Grid Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Active Database Hub</h2>
            <p className="text-xs text-slate-500">Select any database to manage records, forms, and charts.</p>
          </div>
          <button
            onClick={onOpenCreateDb}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>+ Add Database</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {databases.map((db) => {
            const dbRecords = records.filter((r) => r.databaseId === db.id && !r.isArchived);
            const isFav = !!db.isFavorite;
            return (
              <div
                key={db.id}
                id={`db-card-${db.id}`}
                onClick={() => onSelectDatabase(db)}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:scale-110 transition-transform">
                      {getDbIcon(db.icon)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {db.category}
                      </span>
                      <button
                        type="button"
                        id={`toggle-fav-btn-${db.id}`}
                        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteDatabase(db.id);
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isFav
                            ? 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                            : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center justify-between">
                    <span>{db.name}</span>
                    <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {db.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {dbRecords.length} Records
                  </span>
                  <span>{(db?.fields || []).length} Fields</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
