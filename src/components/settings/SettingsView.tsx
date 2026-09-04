import React, { useState, useRef } from 'react';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { Settings, Download, Upload, Trash2, Sun, Moon, Monitor, Camera, Save, User, Shield, Building, Key } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { databases, records, addToast, exportWorkspace, importWorkspace, clearWorkspace, themeMode, setThemeMode } = useDatabase();
  const { user, updateProfile } = useAuth();

  // Profile Edit State
  const [fullName, setFullName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [department, setDepartment] = useState(user?.department || 'Engineering');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast('File too large', 'Please choose an avatar image under 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setAvatar(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await updateProfile({
        name: fullName,
        department,
        avatar,
        themePreference: themeMode,
        ...(password.trim() ? { newPassword: password } : {}),
      });
      if (res.success) {
        setPassword('');
        addToast('Profile Updated', 'Your profile details have been saved.', 'success');
      } else {
        addToast('Update Failed', res.message || 'Could not update profile', 'error');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.databases && Array.isArray(parsed.databases)) {
          await importWorkspace(parsed);
        } else {
          addToast('Invalid File', 'Backup file must contain valid database arrays.', 'error');
        }
      } catch (err) {
        addToast('Import Error', 'Failed to parse backup JSON file.', 'error');
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to delete ALL databases and records? This action cannot be undone.')) {
      await clearWorkspace();
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-500" />
          <span>Platform Settings & Workspace Management</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Configure profile details, avatar, theme preferences, and workspace backup data.</p>
      </div>

      {/* User Profile Edit Form */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <User className="w-4 h-4 text-blue-500" />
          <span>Account & Profile Settings</span>
        </h3>

        {/* Profile Avatar Upload Section */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
          <div className="relative group">
            <img
              src={avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
              alt="Avatar Preview"
              className="w-16 h-16 rounded-full object-cover border-2 border-blue-500/50 shadow-md"
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute inset-0 bg-slate-900/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">Profile Photo</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">JPG, PNG or GIF up to 2MB. Permanent cloud & local storage.</div>
            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Upload new photo
            </button>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={email}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Password (optional)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
          >
            {savingProfile ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save Profile Changes</span>
          </button>
        </form>
      </div>

      {/* Theme Options */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Appearance & Theme Preference</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Select how NexusDB looks across your workspace.</p>
        <div className="grid grid-cols-3 gap-3 max-w-md">
          <button
            type="button"
            onClick={() => setThemeMode('light')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition-all ${
              themeMode === 'light'
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Sun className="w-5 h-5 text-amber-500" />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => setThemeMode('dark')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition-all ${
              themeMode === 'dark'
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Moon className="w-5 h-5 text-indigo-400" />
            <span>Dark</span>
          </button>

          <button
            type="button"
            onClick={() => setThemeMode('system')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition-all ${
              themeMode === 'system'
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Monitor className="w-5 h-5 text-slate-500" />
            <span>System</span>
          </button>
        </div>
      </div>

      {/* Backup & Workspace Data Management */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Workspace Data & Backup</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Export full JSON snapshot containing your {databases.length} database schemas and {records.length} records, or restore from a backup file.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={exportWorkspace}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20"
          >
            <Download className="w-4 h-4" />
            <span>Download Master Backup JSON</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            accept=".json"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs"
          >
            <Upload className="w-4 h-4" />
            <span>Restore From Backup JSON</span>
          </button>

          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-semibold text-xs transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Entire Workspace</span>
          </button>
        </div>
      </div>
    </div>
  );
};

