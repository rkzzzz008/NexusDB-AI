import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { DatabaseSchema, FieldSchema, RecordItem } from '../../types.js';
import {
  Search,
  ArrowUpDown,
  Copy,
  Trash2,
  Archive,
  RefreshCw,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Download,
  Plus,
  X,
  FileSpreadsheet,
  RotateCcw,
  RotateCw,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Check,
  Edit3,
  FileText,
} from 'lucide-react';
import { AIAssistantModal } from '../ai/AIAssistantModal.tsx';

interface DynamicTableProps {
  database: DatabaseSchema;
  records: RecordItem[];
  onAddRecord: () => void;
  onEditRecord: (record: RecordItem) => void;
  onOpenImport: () => void;
  onOpenCleaning?: () => void;
  onOpenReport?: () => void;
}

export const DynamicTable: React.FC<DynamicTableProps> = ({
  database,
  records,
  onAddRecord,
  onEditRecord,
  onOpenImport,
  onOpenCleaning,
  onOpenReport,
}) => {
  const {
    deleteRecord,
    duplicateRecord,
    updateRecord,
    bulkDeleteRecords,
    bulkArchiveRecords,
    bulkUpdateRecords,
    setRecords,
    activeRecordFilterIds,
    setActiveRecordFilterIds,
    addToast,
    queryAI,
  } = useDatabase();
  const { canEdit } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columnFilter, setColumnFilter] = useState<Record<string, string>>({});
  const [detailRecord, setDetailRecord] = useState<RecordItem | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Inline Edit State
  const [editingCell, setEditingCell] = useState<{ recordId: string; fieldName: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Auto Save Indicator & AI Refresh Tracker
  const [savedBannerVisible, setSavedBannerVisible] = useState(false);
  const [dataChangedCount, setDataChangedCount] = useState(0);

  // AI Assistant Refresh Modal
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPromptOverride, setAiPromptOverride] = useState('');

  // Bulk Update Modal State
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkFieldName, setBulkFieldName] = useState<string>(database?.fields?.[0]?.name || '');
  const [bulkFieldValue, setBulkFieldValue] = useState<string>('');

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<RecordItem[][]>([]);
  const [redoStack, setRedoStack] = useState<RecordItem[][]>([]);

  // Keep bulk default field in sync if database changes
  useEffect(() => {
    if (database?.fields?.[0]?.name && !bulkFieldName) {
      setBulkFieldName(database.fields[0].name);
    }
  }, [database]);

  // Save current records snapshot to undo history
  const saveToUndoHistory = () => {
    setUndoStack((prev) => [...prev, records]);
    setRedoStack([]);
  };

  // Trigger Saved confirmation badge
  const triggerAutoSavedNotification = () => {
    setSavedBannerVisible(true);
    setDataChangedCount((c) => c + 1);
    setTimeout(() => {
      setSavedBannerVisible(false);
    }, 2500);
  };

  // Undo / Redo handlers
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, records]);
    setRecords(previousState);
    triggerAutoSavedNotification();
    addToast('Undo Action', 'Reverted recent data changes.', 'info');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, records]);
    setRecords(nextState);
    triggerAutoSavedNotification();
    addToast('Redo Action', 'Reapplied data changes.', 'info');
  };

  // Keyboard shortcut listener for Ctrl+Z and Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, records]);

  // Field Input Validator
  const validateFieldInput = (type: string, value: string, required?: boolean): string | null => {
    const trimmed = String(value ?? '').trim();
    if (required && !trimmed) {
      return 'This field is required.';
    }
    if (!trimmed) return null; // Allow empty if not required

    switch (type) {
      case 'Email': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) return 'Please enter a valid email address (e.g., user@domain.com)';
        break;
      }
      case 'Number': {
        if (isNaN(Number(trimmed))) return 'Please enter a valid numeric value.';
        break;
      }
      case 'Date': {
        if (isNaN(Date.parse(trimmed))) return 'Please enter a valid date (e.g., YYYY-MM-DD)';
        break;
      }
      case 'URL': {
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.includes('.')) {
          return 'Please enter a valid URL address.';
        }
        break;
      }
    }
    return null;
  };

  // Inline Cell Editing Handlers
  const handleStartInlineEdit = (record: RecordItem, field: FieldSchema) => {
    if (!canEdit) return;
    setEditingCell({ recordId: record.id, fieldName: field.name });
    const currentVal = record.data[field.name];
    setEditValue(currentVal !== undefined && currentVal !== null ? String(currentVal) : '');
    setValidationError(null);
  };

  const handleCommitInlineEdit = async (record: RecordItem, field: FieldSchema) => {
    if (!editingCell) return;

    const error = validateFieldInput(field.type, editValue, field.required);
    if (error) {
      setValidationError(error);
      return;
    }

    let parsedValue: any = editValue;
    if (field.type === 'Number') {
      parsedValue = editValue === '' ? null : Number(editValue);
    } else if (field.type === 'Boolean' || field.type === 'Checkbox') {
      parsedValue = editValue === 'true' || editValue === 'Yes';
    }

    if (record.data[field.name] !== parsedValue) {
      saveToUndoHistory();
      const updatedData = { ...record.data, [field.name]: parsedValue };
      const success = await updateRecord(record.id, updatedData, record.isArchived);
      if (success) {
        triggerAutoSavedNotification();
      }
    }

    setEditingCell(null);
    setValidationError(null);
  };

  const handleCancelInlineEdit = () => {
    setEditingCell(null);
    setValidationError(null);
  };

  // Row Action Handlers
  const handleDuplicate = async (recordId: string) => {
    saveToUndoHistory();
    const success = await duplicateRecord(recordId);
    if (success) triggerAutoSavedNotification();
  };

  const handleDelete = async (recordId: string) => {
    saveToUndoHistory();
    const success = await deleteRecord(recordId);
    if (success) triggerAutoSavedNotification();
  };

  // Bulk Action Handlers
  const handleBulkDelete = async () => {
    if (selectedRecordIds.length === 0) return;
    saveToUndoHistory();
    const success = await bulkDeleteRecords(selectedRecordIds);
    if (success) {
      triggerAutoSavedNotification();
      setSelectedRecordIds([]);
    }
  };

  const handleBulkExport = () => {
    if (selectedRecordIds.length === 0) return;
    const selectedRecords = records.filter((r) => selectedRecordIds.includes(r.id));
    const exportData = selectedRecords.map((r) => {
      const rowObj: Record<string, any> = {};
      database.fields.forEach((f) => {
        rowObj[f.label || f.name] = r.data[f.name] ?? '';
      });
      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Selected Records');
    XLSX.writeFile(workbook, `${database.name}_Selected_Records.xlsx`);
    addToast('Export Complete', `Exported ${selectedRecords.length} records to Excel workbook.`, 'success');
  };

  const handleApplyBulkUpdate = async () => {
    if (!bulkFieldName || selectedRecordIds.length === 0) return;
    const targetField = database.fields.find((f) => f.name === bulkFieldName);
    if (targetField) {
      const error = validateFieldInput(targetField.type, bulkFieldValue, targetField.required);
      if (error) {
        addToast('Validation Error', error, 'error');
        return;
      }
    }

    let parsedVal: any = bulkFieldValue;
    if (targetField?.type === 'Number') {
      parsedVal = bulkFieldValue === '' ? null : Number(bulkFieldValue);
    } else if (targetField?.type === 'Boolean' || targetField?.type === 'Checkbox') {
      parsedVal = bulkFieldValue === 'true';
    }

    saveToUndoHistory();
    const success = await bulkUpdateRecords(selectedRecordIds, bulkFieldName, parsedVal);
    if (success) {
      triggerAutoSavedNotification();
      setSelectedRecordIds([]);
      setShowBulkUpdateModal(false);
    }
  };

  // Refresh AI Insights Handler
  const handleRefreshAI = () => {
    setDataChangedCount(0);
    setAiPromptOverride(
      `Re-analyze dataset "${database.name}" after recent updates. Summarize revised key metrics, detect shift in trends, anomalies, and provide fresh actionable insights.`
    );
    setShowAIModal(true);
  };

  // Filtered and Sorted Records
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (activeRecordFilterIds && activeRecordFilterIds.length > 0) {
      result = result.filter((r) => activeRecordFilterIds.includes(r.id));
    }

    if (!showArchived) {
      result = result.filter((r) => !r.isArchived);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        Object.values(r.data).some((val) => val && String(val).toLowerCase().includes(q))
      );
    }

    Object.keys(columnFilter).forEach((fieldKey) => {
      const filterVal = columnFilter[fieldKey];
      if (filterVal) {
        result = result.filter((r) => {
          const cell = r.data[fieldKey];
          return cell && String(cell).toLowerCase().includes(filterVal.toLowerCase());
        });
      }
    });

    if (sortField) {
      result.sort((a, b) => {
        const valA = a.data[sortField] ?? '';
        const valB = b.data[sortField] ?? '';

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        return sortDirection === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return result;
  }, [records, searchQuery, showArchived, columnFilter, sortField, sortDirection, activeRecordFilterIds]);

  // Paginated Subset
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRecordIds(paginatedRecords.map((r) => r.id));
    } else {
      setSelectedRecordIds([]);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSort = (fieldKey: string) => {
    if (sortField === fieldKey) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(fieldKey);
      setSortDirection('asc');
    }
  };

  // Cell Value Renderer (when not editing)
  const renderCellContent = (field: FieldSchema, value: any) => {
    if (value === undefined || value === null || value === '') {
      return <span className="text-slate-300 dark:text-slate-600 text-[11px] font-mono">—</span>;
    }

    switch (field.type) {
      case 'Boolean':
      case 'Checkbox':
        return value ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            <CheckCircle className="w-3 h-3" /> Yes
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            <XCircle className="w-3 h-3" /> No
          </span>
        );

      case 'Dropdown':
        const badgeColors: Record<string, string> = {
          'Honor Roll': 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          'Active': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          'Probation': 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
          'Full-Time': 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          'Closed Won': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          'Urgent': 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        };
        const colorClass = badgeColors[String(value)] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';

        return (
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${colorClass}`}>
            {String(value)}
          </span>
        );

      case 'Number':
        if (field.name.toLowerCase().includes('salary') || field.name.toLowerCase().includes('price') || field.name.toLowerCase().includes('value')) {
          return <span className="font-mono font-bold text-slate-900 dark:text-slate-100">${Number(value).toLocaleString()}</span>;
        }
        if (field.name.toLowerCase().includes('attendance') || field.name.toLowerCase().includes('cgpa')) {
          const isDanger = field.name === 'attendance' && Number(value) < 75;
          return (
            <span className={`font-mono font-bold ${isDanger ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-slate-800 dark:text-slate-200'}`}>
              {value}{field.name === 'attendance' ? '%' : ''}
            </span>
          );
        }
        return <span className="font-mono text-slate-800 dark:text-slate-200">{Number(value).toLocaleString()}</span>;

      case 'Email':
        return <span className="text-blue-600 dark:text-blue-400 font-mono text-[11px]">{String(value)}</span>;

      case 'URL':
      case 'Image Upload':
        if (String(value).startsWith('http')) {
          return (
            <a href={String(value)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-500 hover:underline flex items-center gap-1 font-mono text-[11px]">
              <span>View Link</span>
            </a>
          );
        }
        return <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">{String(value)}</span>;

      default:
        return <span className="text-slate-800 dark:text-slate-200">{String(value)}</span>;
    }
  };

  // Inline Input Control Component
  const renderInlineEditInput = (field: FieldSchema, record: RecordItem) => {
    switch (field.type) {
      case 'Dropdown': {
        const options = field.options || ['Active', 'Honor Roll', 'Probation', 'Full-Time', 'Part-Time', 'Pending', 'Urgent'];
        return (
          <select
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleCommitInlineEdit(record, field)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitInlineEdit(record, field);
              if (e.key === 'Escape') handleCancelInlineEdit();
            }}
            className="w-full text-xs py-1 px-2 rounded-lg border border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none ring-2 ring-blue-500/30"
          >
            <option value="">-- Select --</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      }

      case 'Boolean':
      case 'Checkbox': {
        return (
          <select
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleCommitInlineEdit(record, field)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitInlineEdit(record, field);
              if (e.key === 'Escape') handleCancelInlineEdit();
            }}
            className="w-full text-xs py-1 px-2 rounded-lg border border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none ring-2 ring-blue-500/30 font-bold"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );
      }

      case 'Number': {
        return (
          <input
            type="number"
            step="any"
            autoFocus
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setValidationError(null);
            }}
            onBlur={() => handleCommitInlineEdit(record, field)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitInlineEdit(record, field);
              if (e.key === 'Escape') handleCancelInlineEdit();
            }}
            className={`w-full text-xs py-1 px-2 rounded-lg border font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none ring-2 ${
              validationError ? 'border-rose-500 ring-rose-500/30' : 'border-blue-500 ring-blue-500/30'
            }`}
          />
        );
      }

      case 'Date': {
        return (
          <input
            type="date"
            autoFocus
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setValidationError(null);
            }}
            onBlur={() => handleCommitInlineEdit(record, field)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitInlineEdit(record, field);
              if (e.key === 'Escape') handleCancelInlineEdit();
            }}
            className={`w-full text-xs py-1 px-2 rounded-lg border font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none ring-2 ${
              validationError ? 'border-rose-500 ring-rose-500/30' : 'border-blue-500 ring-blue-500/30'
            }`}
          />
        );
      }

      case 'Email': {
        return (
          <input
            type="email"
            autoFocus
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setValidationError(null);
            }}
            onBlur={() => handleCommitInlineEdit(record, field)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitInlineEdit(record, field);
              if (e.key === 'Escape') handleCancelInlineEdit();
            }}
            className={`w-full text-xs py-1 px-2 rounded-lg border font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none ring-2 ${
              validationError ? 'border-rose-500 ring-rose-500/30' : 'border-blue-500 ring-blue-500/30'
            }`}
          />
        );
      }

      default: {
        return (
          <input
            type="text"
            autoFocus
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setValidationError(null);
            }}
            onBlur={() => handleCommitInlineEdit(record, field)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitInlineEdit(record, field);
              if (e.key === 'Escape') handleCancelInlineEdit();
            }}
            className={`w-full text-xs py-1 px-2 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none ring-2 ${
              validationError ? 'border-rose-500 ring-rose-500/30' : 'border-blue-500 ring-blue-500/30'
            }`}
          />
        );
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Active AI Filter Indicator */}
      {activeRecordFilterIds && activeRecordFilterIds.length > 0 && (
        <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/50 flex items-center justify-between text-xs text-blue-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>
              <strong>Gemini AI Filter Active:</strong> Showing {activeRecordFilterIds.length} flagged records.
            </span>
          </div>
          <button
            onClick={() => setActiveRecordFilterIds(null)}
            className="px-2.5 py-1 rounded-lg bg-blue-800 hover:bg-blue-700 text-white font-semibold flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Reset Filter
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Left: Search input, Show Archived toggle, Auto-Saved Banner & AI Refresh Pill */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="table-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${database.name}...`}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
            <input
              id="table-show-archived-checkbox"
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
            />
            <span>Show Archived</span>
          </label>

          {/* Auto-Saved Confirmation Badge */}
          {savedBannerVisible && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 animate-in fade-in transition-all">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 animate-bounce" /> Auto-Saved
            </span>
          )}

          {/* Refresh AI Insights Prompt Pill */}
          {dataChangedCount > 0 && (
            <button
              type="button"
              onClick={handleRefreshAI}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:opacity-90 transition-all"
              title="Data has changed. Click to refresh AI insights"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
              <span>Refresh AI Insights ({dataChangedCount} updates)</span>
            </button>
          )}
        </div>

        {/* Right: Undo/Redo & Bulk Actions & Add Record */}
        <div className="flex items-center gap-2">
          {/* Undo and Redo Controls */}
          {canEdit && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                disabled={undoStack.length === 0}
                onClick={handleUndo}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Undo edit (Ctrl+Z)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={redoStack.length === 0}
                onClick={handleRedo}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Redo edit (Ctrl+Y)"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Bulk Action Controls */}
          {selectedRecordIds.length > 0 && canEdit && (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold px-2 text-slate-600 dark:text-slate-300">
                {selectedRecordIds.length} selected
              </span>

              {/* Bulk Update Fields Button */}
              <button
                type="button"
                onClick={() => setShowBulkUpdateModal(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shadow-xs"
                title="Update selected fields in bulk"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Update Field</span>
              </button>

              {/* Bulk Export Selected */}
              <button
                type="button"
                onClick={handleBulkExport}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                title="Export Selected Records to Excel"
              >
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </button>

              {/* Bulk Archive */}
              <button
                type="button"
                onClick={() => bulkArchiveRecords(selectedRecordIds, true)}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                title="Bulk Archive"
              >
                <Archive className="w-4 h-4" />
              </button>

              {/* Bulk Delete Selected */}
              <button
                type="button"
                onClick={handleBulkDelete}
                className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400"
                title="Delete Selected Records"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {onOpenReport && (
            <button
              id="generate-ai-report-table-btn"
              type="button"
              onClick={onOpenReport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-xs font-bold text-white shadow-xs transition-all hover:scale-105"
              title="Generate Executive AI Report with statistics, key trends, recommendations, and issues"
            >
              <FileText className="w-3.5 h-3.5 text-blue-200" />
              <span className="hidden md:inline">Generate AI Report</span>
              <span className="md:hidden">AI Report</span>
            </button>
          )}

          {onOpenCleaning && canEdit && (
            <button
              id="clean-data-with-ai-table-btn"
              type="button"
              onClick={onOpenCleaning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-xs font-bold text-white shadow-xs transition-all hover:scale-105"
              title="Detect and clean duplicate records, missing values, invalid emails/phones, dates, extra spaces and casing"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span className="hidden md:inline">Clean Data with AI</span>
              <span className="md:hidden">Clean AI</span>
            </button>
          )}

          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Import Database</span>
          </button>

          {canEdit && (
            <button
              id="table-add-record-btn"
              onClick={onAddRecord}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>Add Record</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table Grid */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={
                      paginatedRecords.length > 0 &&
                      paginatedRecords.every((r) => selectedRecordIds.includes(r.id))
                    }
                    className="rounded border-slate-300 dark:border-slate-700 text-blue-600"
                  />
                </th>

                {(database?.fields || []).map((field) => (
                  <th key={field.id} className="p-3.5 whitespace-nowrap">
                    <button
                      onClick={() => handleSort(field.name)}
                      className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <span>{field.label}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </button>
                  </th>
                ))}

                <th className="p-3.5 text-right w-24">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={(database?.fields || []).length + 2} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-600 dark:text-slate-300">No matching records found</p>
                      <p className="text-[11px] text-slate-400">Try adjusting your filter or adding a new record.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record) => {
                  const isSelected = selectedRecordIds.includes(record.id);
                  const isHighlighted = activeRecordFilterIds?.includes(record.id);

                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        record.isArchived ? 'opacity-50 bg-slate-50/40 dark:bg-slate-900/40' : ''
                      } ${isHighlighted ? 'bg-blue-50/80 dark:bg-blue-950/30 border-l-4 border-l-blue-500' : ''}`}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(record.id)}
                          className="rounded border-slate-300 dark:border-slate-700 text-blue-600"
                        />
                      </td>

                      {/* Editable Cells */}
                      {database.fields.map((field) => {
                        const isEditing =
                          editingCell?.recordId === record.id && editingCell?.fieldName === field.name;

                        return (
                          <td
                            key={field.id}
                            onClick={() => !isEditing && handleStartInlineEdit(record, field)}
                            className={`p-3.5 whitespace-nowrap relative cursor-pointer group ${
                              isEditing
                                ? 'bg-blue-50/50 dark:bg-blue-950/40 ring-1 ring-blue-500'
                                : 'hover:bg-blue-50/30 dark:hover:bg-slate-800/60'
                            }`}
                            title={canEdit ? 'Click to edit cell' : undefined}
                          >
                            {isEditing ? (
                              <div className="relative">
                                {renderInlineEditInput(field, record)}
                                {validationError && (
                                  <div className="absolute left-0 top-full mt-1 z-30 p-2 rounded-lg bg-rose-600 text-white text-[10px] font-semibold shadow-lg flex items-center gap-1.5 whitespace-normal max-w-xs animate-in fade-in">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{validationError}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-1">
                                <div>{renderCellContent(field, record.data[field.name])}</div>
                                {canEdit && (
                                  <span className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500 transition-opacity text-[10px]">
                                    ✎
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Row Actions */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailRecord(record)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canEdit && (
                            <>
                              <button
                                id={`table-row-edit-btn-${record.id}`}
                                onClick={() => onEditRecord(record)}
                                className="table-row-edit-btn p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Edit Record Modal"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              <button
                                id={`table-row-duplicate-btn-${record.id}`}
                                onClick={() => handleDuplicate(record.id)}
                                className="table-row-duplicate-btn p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Duplicate Row"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => updateRecord(record.id, record.data, !record.isArchived)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title={record.isArchived ? 'Restore' : 'Archive'}
                              >
                                {record.isArchived ? <RefreshCw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                id={`table-row-delete-btn-${record.id}`}
                                onClick={() => handleDelete(record.id)}
                                className="table-row-delete-btn p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Delete Row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{' '}
            <strong className="text-slate-800 dark:text-slate-200">{Math.min(currentPage * pageSize, filteredRecords.length)}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{filteredRecords.length}</strong> records
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span>Per page:</span>
              <select
                id="table-pagination-pagesize-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs px-2 py-1 text-slate-800 dark:text-slate-200"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                id="table-pagination-prev-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-semibold text-slate-700 dark:text-slate-300">
                {currentPage} / {totalPages}
              </span>
              <button
                id="table-pagination-next-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Field Update Modal */}
      {showBulkUpdateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Bulk Update Selected Fields</h3>
                  <p className="text-[11px] text-slate-500">Updating {selectedRecordIds.length} selected records</p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkUpdateModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Select Field to Update</label>
                <select
                  value={bulkFieldName}
                  onChange={(e) => {
                    setBulkFieldName(e.target.value);
                    setBulkFieldValue('');
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  {database.fields.map((f) => (
                    <option key={f.id} value={f.name}>
                      {f.label} ({f.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">New Value</label>
                {(() => {
                  const targetField = database.fields.find((f) => f.name === bulkFieldName);
                  if (targetField?.type === 'Dropdown') {
                    const opts = targetField.options || ['Active', 'Honor Roll', 'Probation', 'Full-Time', 'Part-Time', 'Pending', 'Urgent'];
                    return (
                      <select
                        value={bulkFieldValue}
                        onChange={(e) => setBulkFieldValue(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                      >
                        <option value="">-- Choose Option --</option>
                        {opts.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    );
                  }
                  if (targetField?.type === 'Boolean' || targetField?.type === 'Checkbox') {
                    return (
                      <select
                        value={bulkFieldValue}
                        onChange={(e) => setBulkFieldValue(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    );
                  }
                  if (targetField?.type === 'Number') {
                    return (
                      <input
                        type="number"
                        value={bulkFieldValue}
                        onChange={(e) => setBulkFieldValue(e.target.value)}
                        placeholder="Enter number..."
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                      />
                    );
                  }
                  if (targetField?.type === 'Date') {
                    return (
                      <input
                        type="date"
                        value={bulkFieldValue}
                        onChange={(e) => setBulkFieldValue(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                      />
                    );
                  }
                  return (
                    <input
                      type="text"
                      value={bulkFieldValue}
                      onChange={(e) => setBulkFieldValue(e.target.value)}
                      placeholder="Enter new text..."
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                    />
                  );
                })()}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkUpdateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyBulkUpdate}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all"
              >
                Apply to {selectedRecordIds.length} Records
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Detail Modal */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Record Details</h3>
              <button
                onClick={() => setDetailRecord(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {database.fields.map((field) => (
                <div key={field.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400">{field.label}</div>
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1">
                    {renderCellContent(field, detailRecord.data[field.name])}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setDetailRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Modal for Insights Refresh */}
      {showAIModal && (
        <AIAssistantModal
          initialPrompt={aiPromptOverride}
          onClose={() => {
            setShowAIModal(false);
            setAiPromptOverride('');
          }}
        />
      )}
    </div>
  );
};
