import React from 'react';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  LayoutDashboard,
  Database,
  Sparkles,
  BarChart3,
  ShieldCheck,
  Settings,
  Plus,
  Home,
  GraduationCap,
  Package,
  Users,
  Briefcase,
  Activity,
  ChevronRight,
  BookOpen,
  TrendingUp,
  Clock,
  DollarSign,
  Star,
  History,
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  onOpenCreateDb: () => void;
  onOpenAI: () => void;
  onOpenAICreator?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  onOpenCreateDb,
  onOpenAI,
  onOpenAICreator,
}) => {
  const { databases, activeDatabase, setActiveDatabase } = useDatabase();
  const { isAdmin } = useAuth();

  const getDbIcon = (iconName: string) => {
    switch (iconName) {
      case 'GraduationCap':
        return <GraduationCap className="w-4 h-4 text-emerald-500" />;
      case 'Package':
        return <Package className="w-4 h-4 text-blue-500" />;
      case 'Users':
        return <Users className="w-4 h-4 text-violet-500" />;
      case 'Briefcase':
        return <Briefcase className="w-4 h-4 text-amber-500" />;
      case 'Activity':
        return <Activity className="w-4 h-4 text-rose-500" />;
      case 'BookOpen':
        return <BookOpen className="w-4 h-4 text-sky-500" />;
      case 'TrendingUp':
        return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'Clock':
        return <Clock className="w-4 h-4 text-cyan-500" />;
      case 'DollarSign':
        return <DollarSign className="w-4 h-4 text-emerald-500" />;
      default:
        return <Database className="w-4 h-4 text-cyan-500" />;
    }
  };

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md flex flex-col justify-between py-4 px-3 shrink-0 h-[calc(100vh-4rem)] sticky top-16 transition-colors overflow-y-auto">
      <div className="space-y-6">
        {/* Top Navigation Group */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Main Navigation
          </div>
          <nav className="space-y-1">
            <button
              id="sidebar-nav-landing"
              onClick={() => setActiveView('landing')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'landing'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Landing Page</span>
            </button>

            <button
              id="sidebar-nav-dashboard"
              onClick={() => setActiveView('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              id="sidebar-nav-ai"
              onClick={onOpenAI}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-all group"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-blue-500 group-hover:rotate-12 transition-transform" />
                <span>AI Assistant</span>
              </div>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-mono font-bold">
                Gemini
              </span>
            </button>
          </nav>
        </div>

        {/* Databases List */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Databases ({databases.length})
            </span>
            <div className="flex items-center gap-1">
              {onOpenAICreator && (
                <button
                  id="sidebar-ai-creator-sparkles-btn"
                  onClick={onOpenAICreator}
                  className="p-1 text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                  title="Generate Database with AI"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                id="sidebar-create-db-plus-btn"
                onClick={onOpenCreateDb}
                className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                title="Create New Database"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-0.5 max-h-60 overflow-y-auto pr-1">
            {databases.map((db) => {
              const isSelected = activeView === 'database' && activeDatabase?.id === db.id;
              return (
                <button
                  key={db.id}
                  id={`sidebar-db-${db.id}`}
                  onClick={() => {
                    setActiveDatabase(db);
                    setActiveView('database');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 shadow-sm font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {getDbIcon(db.icon)}
                    <span className="truncate">{db.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {db.isFavorite && (
                      <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                    )}
                    {isSelected && <ChevronRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Platform Analytics & Admin */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Management
          </div>
          <nav className="space-y-1">
            <button
              id="sidebar-nav-activity"
              onClick={() => setActiveView('activity')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'activity'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="w-4 h-4 text-indigo-500" />
              <span>Activity Timeline</span>
            </button>

            <button
              id="sidebar-nav-analytics"
              onClick={() => setActiveView('analytics')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'analytics'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Platform Analytics</span>
            </button>

            {isAdmin && (
              <button
                id="sidebar-admin-panel-btn"
                onClick={() => setActiveView('admin')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeView === 'admin'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Admin Panel</span>
              </button>
            )}

            <button
              id="sidebar-nav-settings"
              onClick={() => setActiveView('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'settings'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings & Backup</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Footer Storage Badge */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 px-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/60 dark:from-slate-800/80 dark:to-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            <span>Storage Usage</span>
            <span className="text-blue-600 dark:text-blue-400">12.4 MB / 1 GB</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full w-[15%]" />
          </div>
        </div>
      </div>
    </aside>
  );
};
