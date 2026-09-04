import React, { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import {
  Bell,
  CheckCheck,
  Check,
  Trash2,
  Share2,
  UserPlus,
  CheckCircle2,
  UploadCloud,
  Download,
  Sparkles,
  Wand2,
  Info,
  ExternalLink,
  Filter,
  CheckCircle,
} from 'lucide-react';
import { NotificationItem } from '../../types.js';

type TabType = 'all' | 'unread' | 'shares' | 'imports_exports' | 'ai';

export const NotificationDropdown: React.FC = () => {
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearNotifications,
    acceptShareInvitation,
    databases,
    setActiveDatabase,
    createNotification,
  } = useDatabase();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showDemoTriggers, setShowDemoTriggers] = useState(false);

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 45) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHour < 24) return `${diffHour}h ago`;
      if (diffDay === 1) return 'Yesterday';
      if (diffDay < 7) return `${diffDay}d ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const getNotificationConfig = (notif: NotificationItem) => {
    switch (notif.type) {
      case 'share':
        return {
          icon: <Share2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
          bg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200/60 dark:border-purple-900/60',
          badge: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
          label: 'Database Shared',
        };
      case 'invite':
        if (notif.title.toLowerCase().includes('accepted')) {
          return {
            icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
            bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/60 dark:border-emerald-900/60',
            badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
            label: 'Invitation Accepted',
          };
        }
        return {
          icon: <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
          bg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200/60 dark:border-blue-900/60',
          badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
          label: 'Share Invitation',
        };
      case 'import':
        return {
          icon: <UploadCloud className="w-4 h-4 text-teal-600 dark:text-teal-400" />,
          bg: 'bg-teal-50 dark:bg-teal-950/60 border-teal-200/60 dark:border-teal-900/60',
          badge: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
          label: 'Import Completed',
        };
      case 'export':
        return {
          icon: <Download className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
          bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200/60 dark:border-amber-900/60',
          badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
          label: 'Export Completed',
        };
      case 'ai':
        if (notif.title.toLowerCase().includes('cleaning')) {
          return {
            icon: <Wand2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
            bg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200/60 dark:border-indigo-900/60',
            badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
            label: 'AI Data Cleaning',
          };
        }
        return {
          icon: <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />,
          bg: 'bg-violet-50 dark:bg-violet-950/60 border-violet-200/60 dark:border-violet-900/60',
          badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
          label: 'AI Report Generated',
        };
      default:
        return {
          icon: <Info className="w-4 h-4 text-slate-500 dark:text-slate-400" />,
          bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
          badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
          label: 'System Notification',
        };
    }
  };

  // Filter notifications by tab
  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.isRead;
    if (activeTab === 'shares') return n.type === 'share' || n.type === 'invite';
    if (activeTab === 'imports_exports') return n.type === 'import' || n.type === 'export';
    if (activeTab === 'ai') return n.type === 'ai';
    return true;
  });

  const handleOpenDatabase = (databaseId?: string) => {
    if (!databaseId) return;
    const targetDb = (databases || []).find((d) => d.id === databaseId);
    if (targetDb) {
      setActiveDatabase(targetDb);
      setIsOpen(false);
    }
  };

  // Demo Trigger Helpers for Instant Verification
  const triggerDemoNotification = (
    type: 'share' | 'invite' | 'invite_accepted' | 'import' | 'export' | 'ai_report' | 'ai_clean'
  ) => {
    const defaultDbName = databases[0]?.name || 'Customer Operations';
    const defaultDbId = databases[0]?.id;

    switch (type) {
      case 'share':
        createNotification({
          title: 'Database Shared',
          message: `You shared "${defaultDbName}" with alex.chen@enterprise.io as Editor.`,
          type: 'share',
          databaseId: defaultDbId,
        });
        break;
      case 'invite':
        createNotification({
          title: 'Share Invitation Received',
          message: `Alex Chen invited you to collaborate on database "${defaultDbName}" as Editor.`,
          type: 'invite',
          databaseId: defaultDbId,
        });
        break;
      case 'invite_accepted':
        createNotification({
          title: 'Invitation Accepted',
          message: `Alex Chen accepted your invitation to collaborate on "${defaultDbName}".`,
          type: 'invite',
          databaseId: defaultDbId,
        });
        break;
      case 'import':
        createNotification({
          title: 'Import Completed',
          message: `Successfully imported 48 records into database "${defaultDbName}".`,
          type: 'import',
          databaseId: defaultDbId,
        });
        break;
      case 'export':
        createNotification({
          title: 'Export Completed',
          message: `Exported 120 records from "${defaultDbName}" to CSV.`,
          type: 'export',
          databaseId: defaultDbId,
        });
        break;
      case 'ai_report':
        createNotification({
          title: 'AI Report Generated',
          message: `Executive AI Report & analytics KPI analysis for "${defaultDbName}" are ready.`,
          type: 'ai',
          databaseId: defaultDbId,
        });
        break;
      case 'ai_clean':
        createNotification({
          title: 'AI Data Cleaning Completed',
          message: `Applied 14 data quality fixes to "${defaultDbName}". Removed 2 duplicate(s), repaired 12 record(s).`,
          type: 'ai',
          databaseId: defaultDbId,
        });
        break;
    }
  };

  return (
    <div className="relative">
      {/* Bell Button with Unread Badge */}
      <button
        id="notification-center-trigger-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
        title="Notification Center"
        aria-label="Open Notification Center"
      >
        <Bell className="w-4 h-4" />
        {unreadNotificationsCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-in zoom-in duration-200">
            {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
          </span>
        )}
      </button>

      {/* Notification Center Popover */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            id="notification-center-popover"
            className="absolute top-full right-0 mt-2 w-[340px] sm:w-[420px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      Notification Center
                    </h3>
                    {unreadNotificationsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white shadow-sm shadow-blue-500/30">
                        {unreadNotificationsCount} unread
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Real-time workspace activity and collaboration alerts
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {unreadNotificationsCount > 0 && (
                  <button
                    id="notif-mark-all-read-btn"
                    onClick={markAllNotificationsRead}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    id="notif-clear-all-btn"
                    onClick={clearNotifications}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Clear all notifications"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1 overflow-x-auto no-scrollbar text-xs">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors shrink-0 ${
                  activeTab === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setActiveTab('unread')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors shrink-0 ${
                  activeTab === 'unread'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Unread ({unreadNotificationsCount})
              </button>
              <button
                onClick={() => setActiveTab('shares')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors shrink-0 ${
                  activeTab === 'shares'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Shares & Invites
              </button>
              <button
                onClick={() => setActiveTab('imports_exports')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors shrink-0 ${
                  activeTab === 'imports_exports'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Import / Export
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors shrink-0 ${
                  activeTab === 'ai'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                AI Actions
              </button>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[380px]">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      All Caught Up!
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      No notifications to display in this category.
                    </p>
                  </div>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const cfg = getNotificationConfig(notif);
                  const isInvitePending =
                    notif.type === 'invite' &&
                    !notif.title.toLowerCase().includes('accepted') &&
                    notif.databaseId;

                  return (
                    <div
                      key={notif.id}
                      className={`p-3.5 transition-all group relative flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                        !notif.isRead
                          ? 'bg-blue-50/40 dark:bg-blue-950/20'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    >
                      {/* Icon */}
                      <div
                        className={`p-2 rounded-xl border shrink-0 mt-0.5 flex items-center justify-center ${cfg.bg}`}
                      >
                        {cfg.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${cfg.badge}`}
                            >
                              {cfg.label}
                            </span>
                            {!notif.isRead && (
                              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>

                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white mt-1 leading-snug">
                          {notif.title}
                        </h4>

                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed break-words">
                          {notif.message}
                        </p>

                        {/* Action buttons inside notification */}
                        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                          {isInvitePending && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (notif.databaseId) {
                                  await acceptShareInvitation(notif.databaseId);
                                  await markNotificationRead(notif.id);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-all shadow-sm flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Accept Invitation</span>
                            </button>
                          )}

                          {notif.databaseId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDatabase(notif.databaseId);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-semibold transition-colors flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Open Database</span>
                            </button>
                          )}

                          {!notif.isRead ? (
                            <button
                              onClick={() => markNotificationRead(notif.id)}
                              className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Mark read</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">Read</span>
                          )}
                        </div>
                      </div>

                      {/* Delete notification button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0"
                        title="Delete notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with Quick Notification Simulator for effortless testing */}
            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between text-xs">
              <div className="text-[11px] text-slate-400 font-medium">
                Showing {filteredNotifications.length} of {notifications.length} notifications
              </div>

              <div className="relative">
                <button
                  id="notif-test-triggers-btn"
                  onClick={() => setShowDemoTriggers(!showDemoTriggers)}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-700/80 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-1"
                  title="Simulate / Trigger Notification Events"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Test Events</span>
                </button>

                {showDemoTriggers && (
                  <div className="absolute bottom-full right-0 mb-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-2 z-50 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                      Trigger Notification Test
                    </div>
                    <button
                      onClick={() => {
                        triggerDemoNotification('share');
                        setShowDemoTriggers(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 flex items-center gap-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5 text-purple-500" />
                      <span>Database shared</span>
                    </button>
                    <button
                      onClick={() => {
                        triggerDemoNotification('invite');
                        setShowDemoTriggers(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-blue-500" />
                      <span>Share invite received</span>
                    </button>
                    <button
                      onClick={() => {
                        triggerDemoNotification('invite_accepted');
                        setShowDemoTriggers(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Invitation accepted</span>
                    </button>
                    <button
                      onClick={() => {
                        triggerDemoNotification('import');
                        setShowDemoTriggers(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:text-teal-600 flex items-center gap-1.5"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-teal-500" />
                      <span>Import completed</span>
                    </button>
                    <button
                      onClick={() => {
                        triggerDemoNotification('export');
                        setShowDemoTriggers(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-500" />
                      <span>Export completed</span>
                    </button>
                    <button
                      onClick={() => {
                        triggerDemoNotification('ai_report');
                        setShowDemoTriggers(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-violet-600 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                      <span>AI Report generated</span>
                    </button>
                    <button
                      onClick={() => {
                        triggerDemoNotification('ai_clean');
                        setShowDemoTriggers(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 flex items-center gap-1.5"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>AI Data Cleaning completed</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
