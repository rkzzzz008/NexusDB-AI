import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import { User, Role, SystemLog } from '../../types.js';
import { Shield, ShieldCheck, Users, HardDrive, Activity, RefreshCw, Key, FileText } from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const { user: currentUser, token } = useAuth();
  const { addToast } = useDatabase();

  const [usersList, setUsersList] = useState<User[]>([]);
  const [logsList, setLogsList] = useState<SystemLog[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'storage'>('users');

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => {
    fetchUsers();
    fetchLogs();
  }, [token]);

  const fetchUsers = () => {
    fetch('/api/admin/users', { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setUsersList(data.users || []))
      .catch((e) => console.error(e));
  };

  const fetchLogs = () => {
    fetch('/api/admin/logs', { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setLogsList(data.logs || []))
      .catch((e) => console.error(e));
  };

  const handleRoleChange = (userId: string, newRole: Role) => {
    fetch('/api/admin/users/role', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ userId, role: newRole }),
    })
      .then((res) => res.json())
      .then((data) => {
        setUsersList((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
        addToast('Role Updated', `Updated user role to ${newRole}`, 'info');
      });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            <span>Platform Admin Control Center</span>
          </h1>
          <p className="text-xs text-slate-500">Manage organizational users, role permissions, audit logs, and storage metrics.</p>
        </div>

        <button
          onClick={() => {
            fetchUsers();
            fetchLogs();
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" /> Users & Role Access ({(usersList || []).length})
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" /> System Audit Logs ({(logsList || []).length})
        </button>

        <button
          onClick={() => setActiveTab('storage')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'storage'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <HardDrive className="w-4 h-4" /> Storage & Health
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-3.5">User</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Current Role</th>
                <th className="p-3.5">Joined Date</th>
                <th className="p-3.5 text-right">Role Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {usersList.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="p-3.5 flex items-center gap-3">
                    <img src={u.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{u.name}</div>
                      <div className="text-[11px] text-slate-400">{u.email}</div>
                    </div>
                  </td>

                  <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">{u.department || 'General'}</td>

                  <td className="p-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      u.role === 'Admin'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                        : u.role === 'Editor'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>

                  <td className="p-3.5 text-slate-400 font-mono">{new Date(u.createdAt).toLocaleDateString()}</td>

                  <td className="p-3.5 text-right">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs px-2 py-1 text-slate-800 dark:text-slate-200 font-semibold"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Editor">Editor</option>
                      <option value="Viewer">Viewer</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {logsList.map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">{log.action}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                      {log.user}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">{log.details}</p>
                </div>
                <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Storage Tab */}
      {activeTab === 'storage' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase">Memory Footprint</h3>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white">12.4 MB</div>
            <p className="text-xs text-slate-500">In-memory store & active schema cache.</p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase">MongoDB Connectivity</h3>
            <div className="text-xl font-bold text-emerald-500">Standalone Express Engine</div>
            <p className="text-xs text-slate-500">Ready for external MongoDB URI connection.</p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase">API Key Status</h3>
            <div className="text-xl font-bold text-blue-500">GEMINI_API_KEY Configured</div>
            <p className="text-xs text-slate-500">Gemini 3.6 Flash model ready on server.</p>
          </div>
        </div>
      )}
    </div>
  );
};
