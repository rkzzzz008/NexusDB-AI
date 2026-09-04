import React, { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import { Sparkles, X, Wand2, Database, Table, Layers, CheckCircle2 } from 'lucide-react';

interface AIDatabaseCreatorModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export const AIDatabaseCreatorModal: React.FC<AIDatabaseCreatorModalProps> = ({ onClose, onSuccess }) => {
  const { generateAIDatabase, addToast } = useDatabase();
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  const samplePrompts = [
    'SaaS Customer Support Tickets with Priority, Status, Assignee, and Satisfaction Rating',
    'E-Commerce Product Catalog with Inventory, Price, SKU, Category, and Supplier',
    'Employee Directory with Department, Role, Salary, Hire Date, and Direct Manager',
    'Real Estate Property Listings with Price, Location, Bedrooms, Square Feet, and Agent',
  ];

  const handleGenerate = async (selectedPrompt?: string) => {
    const finalPrompt = selectedPrompt || prompt;
    if (!finalPrompt.trim()) return;

    setGenerating(true);
    try {
      const result = await generateAIDatabase(finalPrompt.trim(), true);
      if (result?.database) {
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (e) {
      addToast('AI Generation Failed', 'Could not architect database schema automatically.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">AI Database Architect</h3>
              <p className="text-[11px] text-slate-500">Describe what you want to store and let AI build schema & sample records.</p>
            </div>
          </div>
          <button
            id="ai-db-creator-modal-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
            What database would you like to build?
          </label>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A Bug Tracker for software teams with Severity, Status, Reporter, Fix Version, and Steps to Reproduce..."
            className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
          />

          {/* Quick Preset Prompts */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Or Choose a Preset Template
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(p);
                  }}
                  className="p-2.5 text-left rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 text-[11px] text-slate-700 dark:text-slate-300 font-medium transition-all"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={generating || !prompt.trim()}
            onClick={() => handleGenerate()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
          >
            {generating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Architecting Database...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Generate Database Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
