import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import { NotificationDropdown } from './NotificationDropdown.tsx';
import {
  Search,
  Sparkles,
  Moon,
  Sun,
  Bell,
  Database,
  Shield,
  Plus,
  LogOut,
  User as UserIcon,
  History,
} from 'lucide-react';

interface HeaderProps {
  onOpenAI?: () => void;
  onOpenCreateDb?: () => void;
  activeView?: string;
  setActiveView?: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAI,
  onOpenCreateDb,
  activeView,
  setActiveView,
}) => {
  const { user, logout, token } = useAuth();
  const { themeMode, setThemeMode, isDarkMode, databases, activeDatabase, setActiveDatabase, setActiveRecordFilterIds } = useDatabase();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showDbDropdown, setShowDbDropdown] = useState(false);

  // Global Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<{ databases: any[]; records: any[] }>({
    databases: [],
    records: [],
  });
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim() || !token) {
      setSearchResults({ databases: [], records: [] });
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (e) {
        console.error('Search error', e);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, token]);

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between transition-colors">
      {/* Left: Brand & Database Selector */}
      <div className="flex items-center gap-3 md:gap-6">
        <div
          onClick={() => setActiveView?.('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                Nexus<span className="text-blue-600 dark:text-blue-400">DB</span>
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                AI
              </span>
            </div>
          </div>
        </div>

        {/* Database Dropdown selector */}
        {activeView === 'database' && activeDatabase && (
          <div className="relative">
            <button
              onClick={() => setShowDbDropdown(!showDbDropdown)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="max-w-[140px] truncate">{activeDatabase.name}</span>
            </button>

            {showDbDropdown && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-50">
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Switch Database
                </div>
                {databases.map((db) => (
                  <button
                    key={db.id}
                    onClick={() => {
                      setActiveDatabase(db);
                      setShowDbDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                      activeDatabase.id === db.id
                        ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="truncate">{db.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Middle: Universal Search & Quick AI Assistant trigger */}
      <div className="flex-1 max-w-lg mx-4 hidden md:flex items-center gap-2 relative">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            placeholder="Search databases, records, content..."
            className="w-full pl-9 pr-8 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
            >
              ×
            </button>
          )}

          {/* Search Dropdown Results */}
          {searchFocused && searchQuery.trim().length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 max-h-96 overflow-y-auto">
              {searching ? (
                <div className="px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>Searching workspace...</span>
                </div>
              ) : (searchResults?.databases || []).length === 0 && (searchResults?.records || []).length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-400 text-center">
                  No results found for "{searchQuery}"
                </div>
              ) : (
                <>
                  {/* Databases */}
                  {(searchResults?.databases || []).length > 0 && (
                    <div className="mb-2">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Databases ({searchResults.databases.length})
                      </div>
                      {searchResults.databases.map((db) => (
                        <div
                          key={db.id}
                          onMouseDown={() => {
                            setActiveDatabase(db);
                            setActiveView?.('database');
                            setSearchQuery('');
                          }}
                          className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{db.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {db.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Records */}
                  {(searchResults?.records || []).length > 0 && (
                    <div>
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Records ({searchResults.records.length})
                      </div>
                      {searchResults.records.map((rec) => {
                        const firstVal = Object.values(rec.data || {})[0] || 'Record';
                        return (
                          <div
                            key={rec.id}
                            onMouseDown={() => {
                              const targetDb = (databases || []).find((d) => d.id === rec.databaseId);
                              if (targetDb) setActiveDatabase(targetDb);
                              setActiveRecordFilterIds([rec.id]);
                              setActiveView?.('database');
                              setSearchQuery('');
                            }}
                            className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer flex items-center justify-between text-xs transition-colors border-t border-slate-100 dark:border-slate-800/50"
                          >
                            <div className="truncate max-w-[240px]">
                              <span className="font-medium text-slate-800 dark:text-slate-200">{String(firstVal)}</span>
                            </div>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                              {rec.databaseName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onOpenAI}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 hover:border-blue-500/50 text-slate-500 dark:text-slate-400 text-xs transition-all shadow-inner group whitespace-nowrap"
          title="Ask AI Assistant"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-500 group-hover:rotate-12 transition-transform" />
          <span>Ask AI</span>
        </button>
      </div>

      {/* Right: Actions, Theme, User Role & Profile */}
      <div className="flex items-center gap-2 md:gap-3">
        <button
          id="header-create-db-btn"
          onClick={onOpenCreateDb}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Database</span>
        </button>

        <button
          onClick={onOpenAI}
          className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="AI Assistant"
        >
          <Sparkles className="w-4 h-4 text-blue-500" />
        </button>

        {/* Notification Bell Dropdown */}
        <NotificationDropdown />

        <button
          onClick={() => setThemeMode(isDarkMode ? 'light' : 'dark')}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Toggle theme"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Profile */}
        <div className="relative">
          <button
            id="header-user-profile-btn"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <img
              src={
                user?.avatar ||
                'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
              }
              alt={user?.name || 'User'}
              className="w-7 h-7 rounded-full object-cover border border-slate-300 dark:border-slate-700"
            />
            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {user?.name || 'Sarah Connor'}
              </div>
              <div className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5 text-blue-500" />
                <span>{user?.role || 'Admin'}</span>
              </div>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-50">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {user?.name || 'Sarah Connor'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {user?.email || 'admin@nexusdb.ai'}
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Role: {user?.role || 'Admin'}
                </span>
              </div>

              <button
                onClick={() => {
                  setActiveView?.('activity');
                  setShowProfileMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <History className="w-4 h-4 text-indigo-500" />
                <span>Activity Timeline</span>
              </button>

              <button
                onClick={() => {
                  setActiveView?.('settings');
                  setShowProfileMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <UserIcon className="w-4 h-4 text-slate-400" />
                <span>Profile & Settings</span>
              </button>

              <button
                id="header-sign-out-btn"
                onClick={() => {
                  logout();
                  setShowProfileMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
