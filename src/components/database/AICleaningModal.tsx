import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  X,
  AlertTriangle,
  Copy,
  Mail,
  Phone,
  Calendar,
  Space,
  Type,
  ArrowRight,
  ShieldCheck,
  Check,
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
  Layers,
  HelpCircle,
  Edit2,
  Trash2,
} from 'lucide-react';
import { DatabaseSchema, RecordItem, DataCleaningFixItem, DataCleaningResult, DataCleaningIssueType } from '../../types.js';

interface AICleaningModalProps {
  isOpen: boolean;
  onClose: () => void;
  database: DatabaseSchema;
  records: RecordItem[];
  onApplyFixes: (approvedFixes: DataCleaningFixItem[]) => Promise<boolean>;
}

export const AICleaningModal: React.FC<AICleaningModalProps> = ({
  isOpen,
  onClose,
  database,
  records,
  onApplyFixes,
}) => {
  const [analysis, setAnalysis] = useState<DataCleaningResult | null>(null);
  const [fixes, setFixes] = useState<DataCleaningFixItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingFixId, setEditingFixId] = useState<string | null>(null);
  const [customValueInput, setCustomValueInput] = useState<string>('');

  // Fetch AI Data Cleaning Analysis
  const fetchAnalysis = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('nexus_token') || localStorage.getItem('nexusdb_token');
    try {
      const res = await fetch(`/api/ai/clean-data/${database.id}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        const data: DataCleaningResult = await res.json();
        setAnalysis(data);
        setFixes(data.fixes || []);
      } else {
        // Fallback: Generate client-side analysis
        generateClientAnalysis();
      }
    } catch (e) {
      console.warn('Failed to load server data cleaning analysis, falling back to client engine:', e);
      generateClientAnalysis();
    } finally {
      setIsLoading(false);
    }
  };

  // Client-side fallback analyzer
  const generateClientAnalysis = () => {
    const activeRecords = records.filter((r) => !r.isArchived);
    const clientFixes: DataCleaningFixItem[] = [];
    const seen = new Map<string, string>();

    let duplicateCount = 0;
    let missingCount = 0;
    let invalidEmailCount = 0;
    let invalidPhoneCount = 0;
    let invalidDateCount = 0;
    let extraSpacesCount = 0;
    let mixedCasingCount = 0;

    for (const r of activeRecords) {
      if (!r.data) continue;
      const rName = r.data.studentName || r.data.name || r.data.fullName || r.data.productName || `Record ${r.id.slice(-4)}`;

      // 1. Duplicate
      const ident = r.data.email || r.data.regNumber || r.data.studentId || r.data.sku || r.data.phone;
      if (ident) {
        const norm = String(ident).toLowerCase().trim();
        if (seen.has(norm)) {
          duplicateCount++;
          clientFixes.push({
            id: `fix-dup-${r.id}`,
            recordId: r.id,
            recordName: rName,
            fieldName: 'record',
            fieldLabel: 'Duplicate Record',
            issueType: 'duplicate',
            issueDescription: `Duplicate identifier "${ident}" matches existing database entry.`,
            currentValue: `ID: ${r.id}`,
            suggestedValue: 'Delete Duplicate Record',
            action: 'delete_duplicate',
            approved: true,
            severity: 'high',
          });
        } else {
          seen.set(norm, r.id);
        }
      }

      // Fields
      for (const [k, v] of Object.entries(r.data)) {
        const strVal = String(v ?? '');
        const kLower = k.toLowerCase();

        // 2. Missing
        if (v === undefined || v === null || strVal.trim() === '') {
          missingCount++;
          clientFixes.push({
            id: `fix-miss-${r.id}-${k}`,
            recordId: r.id,
            recordName: rName,
            fieldName: k,
            fieldLabel: k.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim(),
            issueType: 'missing_value',
            issueDescription: `Missing value for field "${k}".`,
            currentValue: '(Empty)',
            suggestedValue: kLower.includes('status') ? 'Active' : 'Completed',
            action: 'fill_missing',
            approved: true,
            severity: 'medium',
          });
          continue;
        }

        // 3. Extra spaces
        if (typeof v === 'string' && (strVal.startsWith(' ') || strVal.endsWith(' ') || /\s{2,}/.test(strVal))) {
          const cleaned = strVal.trim().replace(/\s+/g, ' ');
          if (cleaned !== strVal) {
            extraSpacesCount++;
            clientFixes.push({
              id: `fix-space-${r.id}-${k}`,
              recordId: r.id,
              recordName: rName,
              fieldName: k,
              fieldLabel: k,
              issueType: 'extra_spaces',
              issueDescription: 'Leading, trailing, or double whitespace detected.',
              currentValue: `"${strVal}"`,
              suggestedValue: cleaned,
              action: 'update_field',
              approved: true,
              severity: 'low',
            });
          }
        }

        // 4. Invalid emails
        if (kLower.includes('email') || (typeof v === 'string' && v.includes('@'))) {
          let email = strVal.trim();
          let fixedEmail = email.replace(/@{2,}/g, '@').replace(/\s+/g, '');
          if (fixedEmail.endsWith('@gmaill.com')) fixedEmail = fixedEmail.replace('@gmaill.com', '@gmail.com');
          if (fixedEmail.endsWith('@yaho.com')) fixedEmail = fixedEmail.replace('@yaho.com', '@yahoo.com');

          if (fixedEmail !== strVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fixedEmail)) {
            invalidEmailCount++;
            clientFixes.push({
              id: `fix-email-${r.id}-${k}`,
              recordId: r.id,
              recordName: rName,
              fieldName: k,
              fieldLabel: k,
              issueType: 'invalid_email',
              issueDescription: 'Non-standard email address or domain typo.',
              currentValue: strVal,
              suggestedValue: fixedEmail.toLowerCase(),
              action: 'update_field',
              approved: true,
              severity: 'high',
            });
          }
        }

        // 5. Mixed casing
        if (typeof v === 'string' && (kLower.includes('name') || kLower.includes('department')) && strVal.length > 2) {
          const isUpper = strVal === strVal.toUpperCase() && /[A-Z]/.test(strVal);
          const hasErratic = /[a-z][A-Z]/.test(strVal);
          if (isUpper || hasErratic) {
            const titleCase = strVal
              .toLowerCase()
              .split(' ')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');
            if (titleCase !== strVal) {
              mixedCasingCount++;
              clientFixes.push({
                id: `fix-case-${r.id}-${k}`,
                recordId: r.id,
                recordName: rName,
                fieldName: k,
                fieldLabel: k,
                issueType: 'mixed_casing',
                issueDescription: 'Inconsistent capitalization standardized to Title Case.',
                currentValue: strVal,
                suggestedValue: titleCase,
                action: 'update_field',
                approved: true,
                severity: 'low',
              });
            }
          }
        }
      }
    }

    setAnalysis({
      databaseId: database.id,
      databaseName: database.name,
      totalRecordsAnalyzed: activeRecords.length,
      totalIssuesFound: clientFixes.length,
      fixes: clientFixes,
      summary: {
        duplicates: duplicateCount,
        missingValues: missingCount,
        invalidEmails: invalidEmailCount,
        invalidPhones: invalidPhoneCount,
        invalidDates: invalidDateCount,
        extraSpaces: extraSpacesCount,
        mixedCasing: mixedCasingCount,
      },
      aiAssessment: `Identified ${clientFixes.length} hygiene and normalization fixes across ${activeRecords.length} database records.`,
    });
    setFixes(clientFixes);
  };

  useEffect(() => {
    if (isOpen) {
      fetchAnalysis();
    }
  }, [isOpen, database.id]);

  // Toggle approval on an individual fix
  const handleToggleFix = (id: string) => {
    setFixes((prev) =>
      prev.map((f) => (f.id === id ? { ...f, approved: !f.approved } : f))
    );
  };

  // Bulk select all or deselect all
  const handleSelectAll = (select: boolean) => {
    setFixes((prev) => prev.map((f) => ({ ...f, approved: select })));
  };

  // Custom edit for suggested value
  const handleStartEdit = (fix: DataCleaningFixItem) => {
    setEditingFixId(fix.id);
    setCustomValueInput(String(fix.suggestedValue ?? ''));
  };

  const handleSaveCustomEdit = (fixId: string) => {
    setFixes((prev) =>
      prev.map((f) => (f.id === fixId ? { ...f, suggestedValue: customValueInput, approved: true } : f))
    );
    setEditingFixId(null);
  };

  // Filtered Fixes
  const filteredFixes = useMemo(() => {
    return fixes.filter((fix) => {
      // Tab filter
      if (selectedTab !== 'all' && fix.issueType !== selectedTab) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = fix.recordName.toLowerCase().includes(q);
        const matchesField = fix.fieldLabel.toLowerCase().includes(q);
        const matchesDesc = fix.issueDescription.toLowerCase().includes(q);
        const matchesVal = String(fix.currentValue).toLowerCase().includes(q) || String(fix.suggestedValue).toLowerCase().includes(q);
        return matchesName || matchesField || matchesDesc || matchesVal;
      }
      return true;
    });
  }, [fixes, selectedTab, searchQuery]);

  const approvedFixesCount = useMemo(() => fixes.filter((f) => f.approved).length, [fixes]);

  // Apply approved fixes
  const handleApply = async () => {
    const approved = fixes.filter((f) => f.approved);
    if (approved.length === 0) return;

    setIsApplying(true);
    try {
      const success = await onApplyFixes(approved);
      if (success) {
        onClose();
      }
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  // Icon and color mapper for issue types
  const getIssueMeta = (type: DataCleaningIssueType) => {
    switch (type) {
      case 'duplicate':
        return {
          icon: Copy,
          label: 'Duplicate Record',
          color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800',
        };
      case 'missing_value':
        return {
          icon: AlertTriangle,
          label: 'Missing Value',
          color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800',
        };
      case 'invalid_email':
        return {
          icon: Mail,
          label: 'Invalid Email',
          color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-800',
        };
      case 'invalid_phone':
        return {
          icon: Phone,
          label: 'Invalid Phone',
          color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/70 border-purple-200 dark:border-purple-800',
        };
      case 'invalid_date':
        return {
          icon: Calendar,
          label: 'Incorrect Date',
          color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/70 border-cyan-200 dark:border-cyan-800',
        };
      case 'extra_spaces':
        return {
          icon: Space,
          label: 'Extra Spaces',
          color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/70 border-violet-200 dark:border-violet-800',
        };
      case 'mixed_casing':
        return {
          icon: Type,
          label: 'Mixed Casing',
          color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800',
        };
      default:
        return {
          icon: HelpCircle,
          label: 'Format Fix',
          color: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
        };
    }
  };

  const summary = analysis?.summary || {
    duplicates: 0,
    missingValues: 0,
    invalidEmails: 0,
    invalidPhones: 0,
    invalidDates: 0,
    extraSpaces: 0,
    mixedCasing: 0,
  };

  return (
    <div
      id="ai-cleaning-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in"
    >
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Clean Data with AI
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {database.name}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  ({records.length} records analyzed)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review and approve AI-detected fixes before applying them to your database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAnalysis}
              disabled={isLoading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50 transition-all"
              title="Re-run AI Data Quality scan"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
            </button>
            <button
              id="ai-cleaning-modal-close-btn"
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                <Sparkles className="w-5 h-5 text-blue-500 absolute inset-0 m-auto animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Gemini AI is analyzing dataset quality...
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm text-center">
                Scanning for duplicate records, missing attributes, invalid email/phone syntax, date anomalies, and casing irregularities.
              </p>
            </div>
          ) : (
            <>
              {/* AI Assessment Banner */}
              {analysis?.aiAssessment && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/50 to-slate-50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-slate-900 border border-blue-200 dark:border-blue-900/40 flex items-start gap-3 shadow-xs">
                  <div className="p-1.5 rounded-lg bg-blue-600 text-white shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                      AI Audit Assessment
                    </h4>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {analysis.aiAssessment}
                    </p>
                  </div>
                </div>
              )}

              {/* Metric Summary Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                <button
                  onClick={() => setSelectedTab('duplicate')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedTab === 'duplicate'
                      ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/60 ring-2 ring-rose-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-rose-500 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Duplicates</span>
                    <Copy className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">
                    {summary.duplicates}
                  </div>
                </button>

                <button
                  onClick={() => setSelectedTab('missing_value')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedTab === 'missing_value'
                      ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/60 ring-2 ring-amber-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-amber-500 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Missing</span>
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">
                    {summary.missingValues}
                  </div>
                </button>

                <button
                  onClick={() => setSelectedTab('invalid_email')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedTab === 'invalid_email'
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/60 ring-2 ring-blue-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-blue-500 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Emails</span>
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">
                    {summary.invalidEmails}
                  </div>
                </button>

                <button
                  onClick={() => setSelectedTab('invalid_phone')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedTab === 'invalid_phone'
                      ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/60 ring-2 ring-purple-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-purple-500 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Phones</span>
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">
                    {summary.invalidPhones}
                  </div>
                </button>

                <button
                  onClick={() => setSelectedTab('invalid_date')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedTab === 'invalid_date'
                      ? 'border-cyan-500 bg-cyan-50/70 dark:bg-cyan-950/60 ring-2 ring-cyan-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-cyan-500 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Dates</span>
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">
                    {summary.invalidDates}
                  </div>
                </button>

                <button
                  onClick={() => setSelectedTab('extra_spaces')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedTab === 'extra_spaces'
                      ? 'border-violet-500 bg-violet-50/70 dark:bg-violet-950/60 ring-2 ring-violet-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-violet-500 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Spaces</span>
                    <Space className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">
                    {summary.extraSpaces}
                  </div>
                </button>

                <button
                  onClick={() => setSelectedTab('mixed_casing')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedTab === 'mixed_casing'
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/60 ring-2 ring-emerald-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-emerald-500 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Casing</span>
                    <Type className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">
                    {summary.mixedCasing}
                  </div>
                </button>
              </div>

              {/* Filter Controls & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    onClick={() => setSelectedTab('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedTab === 'all'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    All Issues ({fixes.length})
                  </button>
                  <button
                    onClick={() => setSelectedTab('duplicate')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedTab === 'duplicate'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Duplicates ({summary.duplicates})
                  </button>
                  <button
                    onClick={() => setSelectedTab('missing_value')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedTab === 'missing_value'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Missing ({summary.missingValues})
                  </button>
                  <button
                    onClick={() => setSelectedTab('invalid_email')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedTab === 'invalid_email'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Emails ({summary.invalidEmails})
                  </button>
                  <button
                    onClick={() => setSelectedTab('invalid_phone')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedTab === 'invalid_phone'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Phones ({summary.invalidPhones})
                  </button>
                  <button
                    onClick={() => setSelectedTab('invalid_date')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedTab === 'invalid_date'
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Dates ({summary.invalidDates})
                  </button>
                  <button
                    onClick={() => setSelectedTab('extra_spaces')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedTab === 'extra_spaces'
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Spaces ({summary.extraSpaces})
                  </button>
                  <button
                    onClick={() => setSelectedTab('mixed_casing')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedTab === 'mixed_casing'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Casing ({summary.mixedCasing})
                  </button>
                </div>

                {/* Right: Search & Bulk Action buttons */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-48">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search fixes..."
                      className="w-full pl-8 pr-2.5 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <button
                    onClick={() => handleSelectAll(true)}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => handleSelectAll(false)}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    Deselect
                  </button>
                </div>
              </div>

              {/* Fixes List / Cards */}
              <div className="space-y-2.5 max-h-[44vh] overflow-y-auto pr-1">
                {filteredFixes.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <ShieldCheck className="w-10 h-10 text-emerald-500" />
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      No Issues Found in this Category
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      All inspected records in this segment comply with data validation standards.
                    </p>
                  </div>
                ) : (
                  filteredFixes.map((fix) => {
                    const meta = getIssueMeta(fix.issueType);
                    const IconComp = meta.icon;
                    const isEditingThis = editingFixId === fix.id;

                    return (
                      <div
                        key={fix.id}
                        onClick={() => !isEditingThis && handleToggleFix(fix.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                          fix.approved
                            ? 'bg-white dark:bg-slate-900 border-blue-300 dark:border-blue-700/60 shadow-xs ring-1 ring-blue-500/20'
                            : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Left: Checkbox, Issue Badge & Target info */}
                          <div className="flex items-start gap-3 flex-1">
                            <div className="pt-0.5">
                              <input
                                type="checkbox"
                                checked={fix.approved}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleToggleFix(fix.id);
                                }}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                              />
                            </div>

                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${meta.color}`}
                                >
                                  <IconComp className="w-3 h-3" />
                                  {meta.label}
                                </span>

                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                  {fix.recordName}
                                </span>

                                <span className="text-[11px] text-slate-400">
                                  • Field: <strong className="text-slate-600 dark:text-slate-300">{fix.fieldLabel}</strong>
                                </span>
                              </div>

                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {fix.issueDescription}
                              </p>
                            </div>
                          </div>

                          {/* Right: Before & After Diff Box */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shrink-0 self-start sm:self-auto"
                          >
                            {/* Current Value (Strikethrough / Red) */}
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-mono text-[11px]">
                              <span className="line-through">{String(fix.currentValue)}</span>
                            </div>

                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

                            {/* Suggested Clean Value (Emerald / Bold) */}
                            {isEditingThis ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  autoFocus
                                  value={customValueInput}
                                  onChange={(e) => setCustomValueInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveCustomEdit(fix.id);
                                    if (e.key === 'Escape') setEditingFixId(null);
                                  }}
                                  className="px-2 py-0.5 text-xs rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-blue-500 focus:outline-none ring-2 ring-blue-500/20"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveCustomEdit(fix.id)}
                                  className="p-1 rounded bg-blue-600 text-white text-[10px] font-bold"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono text-[11px] font-bold">
                                  <span>{String(fix.suggestedValue)}</span>
                                </div>
                                {fix.action !== 'delete_duplicate' && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(fix)}
                                    className="p-1 text-slate-400 hover:text-blue-500 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    title="Edit proposed fix value"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              <strong>{approvedFixesCount}</strong> of <strong>{fixes.length}</strong> fixes approved to apply.
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              (No changes occur until you click Apply)
            </span>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying || approvedFixesCount === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Applying Corrections...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Apply ({approvedFixesCount}) Approved Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
