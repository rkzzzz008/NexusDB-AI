import React, { useState } from 'react';
import { DatabaseSchema, Role } from '../../types.js';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import { Share2, Users, Link as LinkIcon, X, Copy, Check, Trash2, UserPlus, Shield, Globe } from 'lucide-react';

interface ShareModalProps {
  database: DatabaseSchema;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ database, onClose }) => {
  const { addCollaborator, removeCollaborator, updateCollaboratorRole, createShareLink, deleteShareLink, addToast } = useDatabase();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Editor');
  const [inviteName, setInviteName] = useState('');
  const [adding, setAdding] = useState(false);

  // Share link settings
  const [linkRole, setLinkRole] = useState<Role>('Viewer');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    try {
      const success = await addCollaborator(database.id, email.trim(), role, inviteName.trim() || undefined);
      if (success) {
        setEmail('');
        setInviteName('');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleCreateShareLink = async () => {
    await createShareLink(database.id, { role: linkRole });
  };

  const handleCopyLink = (url: string, id: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLinkId(id);
    addToast('Link Copied', 'Share link copied to clipboard.', 'success');
    setTimeout(() => setCopiedLinkId(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Share "{database.name}"</h3>
              <p className="text-[11px] text-slate-500">Collaborate with teammates or create view links.</p>
            </div>
          </div>
          <button
            id="share-modal-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invite Member Section */}
        <form onSubmit={handleAddCollaborator} className="space-y-3">
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
            Invite Teammate via Email
          </label>
          <div className="flex items-center gap-2">
            <input
              type="email"
              required
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none font-semibold"
            >
              <option value="Viewer">Viewer</option>
              <option value="Editor">Editor</option>
              <option value="Admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={adding}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shrink-0 disabled:opacity-50 flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite</span>
            </button>
          </div>
        </form>

        {/* Existing Collaborators List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-500" />
            <span>Active Collaborators ({database.collaborators?.length || 0})</span>
          </h4>

          {(!database.collaborators || database.collaborators.length === 0) ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
              No additional collaborators added yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {database.collaborators.map((collab) => (
                <div
                  key={collab.email}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800"
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{collab.name || collab.email}</p>
                    <p className="text-[10px] text-slate-400 truncate">{collab.email}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={collab.role}
                      onChange={(e) => updateCollaboratorRole(database.id, collab.email, e.target.value as Role)}
                      className="px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    >
                      <option value="Viewer">Viewer</option>
                      <option value="Editor">Editor</option>
                      <option value="Admin">Admin</option>
                    </select>

                    <button
                      onClick={() => removeCollaborator(database.id, collab.email)}
                      className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-500"
                      title="Remove member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Share Links Section */}
        <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              <span>Public Share Links</span>
            </h4>
            <button
              onClick={handleCreateShareLink}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <LinkIcon className="w-3 h-3" />
              <span>Create New Link</span>
            </button>
          </div>

          {(!database.shareLinks || database.shareLinks.length === 0) ? (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-400 text-center">
              No public links active. Click above to generate one.
            </div>
          ) : (
            <div className="space-y-2">
              {database.shareLinks.map((link) => (
                <div
                  key={link.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="truncate pr-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{link.role} Link</span>
                    <span className="text-[10px] text-slate-400 block truncate">/share/{link.token}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleCopyLink(`/share/${link.token}`, link.id)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] flex items-center gap-1"
                    >
                      {copiedLinkId === link.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLinkId === link.id ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={() => deleteShareLink(database.id, link.id)}
                      className="p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
