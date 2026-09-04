import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { DatabaseSchema, RecordItem, AIQueryResponse } from '../../types.js';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Printer,
  FileText,
  CheckCircle2,
  X,
  AlertCircle,
  Sparkles,
  Loader2,
  Table,
  LayoutDashboard,
  BarChart3,
  Bot,
  ArrowRight,
} from 'lucide-react';
import {
  parseExcelBuffer,
  parseCSVText,
  parseJSONText,
  ParsedImportResult,
} from '../../lib/excelImporter.ts';

interface ImportExportModalProps {
  database?: DatabaseSchema | null;
  records?: RecordItem[];
  mode: 'import' | 'export';
  onClose: () => void;
  onGenerateDashboard?: (db: DatabaseSchema) => void;
  onGenerateCharts?: (db: DatabaseSchema) => void;
  onGenerateAIInsights?: (db: DatabaseSchema, aiResult: AIQueryResponse | null) => void;
  onGenerateSummaryReport?: (db: DatabaseSchema, aiResult: AIQueryResponse | null) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  database,
  records = [],
  mode,
  onClose,
  onGenerateDashboard,
  onGenerateCharts,
  onGenerateAIInsights,
  onGenerateSummaryReport,
}) => {
  const { createDatabase, importCSVRecords, fetchDatabases, fetchRecords, queryAI, databases, setActiveDatabase, addToast, createNotification } = useDatabase();
  const [csvRawText, setCsvRawText] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedImportResult | null>(null);
  const [importTarget, setImportTarget] = useState<'new' | 'existing'>('new');
  const [customDbName, setCustomDbName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Gemini AI Analysis state after successful import
  const [showAnalyzedDialog, setShowAnalyzedDialog] = useState(false);
  const [importedDatabase, setImportedDatabase] = useState<DatabaseSchema | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AIQueryResponse | null>(null);

  const handleProcessFile = async (file: File) => {
    if (!file) return;
    setErrorMessage(null);
    setIsParsing(true);
    setProgress(15);
    setProgressMessage(`Reading "${file.name}"...`);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let result: ParsedImportResult;

      if (ext === 'xlsx' || ext === 'xls') {
        setProgress(40);
        setProgressMessage('Reading Excel worksheets and headers...');
        const buffer = await file.arrayBuffer();
        setProgress(75);
        setProgressMessage('Detecting columns and inferring field types...');
        result = parseExcelBuffer(buffer, file.name);
      } else if (ext === 'json') {
        setProgress(50);
        setProgressMessage('Parsing JSON dataset structure...');
        const text = await file.text();
        result = parseJSONText(text, file.name);
      } else {
        setProgress(50);
        setProgressMessage('Parsing CSV structure and lines...');
        const text = await file.text();
        result = parseCSVText(text, file.name);
      }

      setProgress(100);
      setParsedResult(result);
      setCustomDbName(result.suggestedDbName);
      setCsvRawText('');
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while parsing the file.');
      setParsedResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleParseRawText = () => {
    if (!csvRawText.trim()) return;
    setErrorMessage(null);
    setIsParsing(true);
    setProgress(50);
    setProgressMessage('Parsing raw text data...');

    try {
      const result = parseCSVText(csvRawText.trim(), 'Pasted_Data.csv');
      setParsedResult(result);
      setCustomDbName(result.suggestedDbName);
      setProgress(100);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse raw CSV or text.');
      setParsedResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!parsedResult || parsedResult.rows.length === 0) return;

    setIsExecuting(true);
    setErrorMessage(null);
    setProgress(20);
    setProgressMessage('Preparing database structure...');

    try {
      let targetDbId = database?.id;

      if (importTarget === 'new' || !targetDbId) {
        setProgress(40);
        setProgressMessage(`Creating database "${customDbName.trim() || parsedResult.suggestedDbName}"...`);

        const newDb = await createDatabase({
          name: customDbName.trim() || parsedResult.suggestedDbName,
          description: `Imported from ${parsedResult.fileName} (${parsedResult.totalRows} records)`,
          category: 'Custom',
          fields: parsedResult.detectedFields.map((f) => ({
            id: f.id,
            name: f.name,
            label: f.label,
            type: f.type,
            required: false,
          })),
        });

        if (!newDb || !newDb.id) {
          throw new Error('Failed to create new database from Excel import.');
        }
        targetDbId = newDb.id;
      }

      setProgress(70);
      setProgressMessage(`Saving ${parsedResult.totalRows} records into database...`);

      const success = await importCSVRecords(targetDbId, parsedResult.rows);

      if (success) {
        setProgress(90);
        setProgressMessage('Analyzing imported data with Gemini AI...');

        const updatedDbs = await fetchDatabases();
        await fetchRecords(targetDbId);

        const targetDb = (updatedDbs || databases).find((d) => d.id === targetDbId) || {
          id: targetDbId,
          name: customDbName.trim() || parsedResult.suggestedDbName,
          category: 'Custom',
          description: `Imported from ${parsedResult.fileName}`,
          fields: parsedResult.detectedFields.map((f) => ({
            id: f.id,
            name: f.name,
            label: f.label,
            type: f.type,
            required: false,
          })),
          userId: '',
          slug: '',
          collaborators: [],
          shareLinks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Automatically analyze the imported data using Gemini AI
        let aiResult: AIQueryResponse | null = null;
        try {
          aiResult = await queryAI(
            `Perform a comprehensive analysis on this newly imported dataset "${targetDb.name}" containing ${parsedResult.totalRows} records. Summarize key metrics, detect data trends, patterns, anomalies, and provide actionable recommendations.`,
            targetDbId
          );
        } catch (aiErr) {
          console.warn('AI analysis error:', aiErr);
        }

        setProgress(100);
        setImportedDatabase(targetDb);
        setAiAnalysisResult(aiResult);
        setShowAnalyzedDialog(true);

        addToast(
          'Import & AI Analysis Successful',
          `Gemini AI finished analyzing ${parsedResult.totalRows} records from "${parsedResult.fileName}".`,
          'success'
        );
      } else {
        throw new Error('Server returned an error while saving imported records.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Import execution failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  const logClientActivity = async (action: string, details: string, category: string = 'Export') => {
    try {
      const token = localStorage.getItem('nexus_token');
      if (!token) return;
      await fetch('/api/activity/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, details, category, type: 'info' }),
      });
    } catch (e) {
      console.warn('Activity logging error', e);
    }
  };

  // Export Helpers
  const downloadFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Download Complete', `File saved as ${fileName}`, 'success');
  };

  const exportCSV = () => {
    if (!database) return;
    const headers = database.fields.map((f) => f.name).join(',');
    const rows = records.map((r) =>
      database.fields.map((f) => `"${String(r.data[f.name] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [headers, ...rows].join('\n');
    downloadFile(csvContent, `${database.slug || 'export'}_records.csv`, 'text/csv');
    createNotification({
      title: 'Export Completed',
      message: `Exported ${records.length} records from "${database.name}" to CSV.`,
      type: 'export',
      databaseId: database.id,
      link: `/database/${database.id}`,
    });
    logClientActivity(
      'Data Export (CSV)',
      `Exported ${records.length} records from "${database.name}" to CSV.`,
      'Export'
    );
  };

  const exportExcel = () => {
    if (!database) return;
    if (!records || records.length === 0) {
      addToast('Export Warning', 'No records to export.', 'warning');
      return;
    }
    const dataToExport = records.map((r) => {
      const rowObj: Record<string, any> = {};
      database.fields.forEach((f) => {
        rowObj[f.label || f.name] = r.data[f.name] ?? '';
      });
      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, (database.name || 'Sheet1').slice(0, 31));
    XLSX.writeFile(workbook, `${database.slug || 'export'}_records.xlsx`);
    addToast('Download Complete', `File saved as ${database.slug || 'export'}_records.xlsx`, 'success');
    createNotification({
      title: 'Export Completed',
      message: `Exported ${records.length} records from "${database.name}" as XLSX Excel workbook.`,
      type: 'export',
      databaseId: database.id,
      link: `/database/${database.id}`,
    });
    logClientActivity(
      'Data Export (Excel)',
      `Exported ${records.length} records from "${database.name}" as XLSX Excel workbook.`,
      'Export'
    );
  };

  const exportJSON = () => {
    if (!database) return;
    const jsonContent = JSON.stringify(
      records.map((r) => r.data),
      null,
      2
    );
    downloadFile(jsonContent, `${database.slug || 'export'}_records.json`, 'application/json');
    createNotification({
      title: 'Export Completed',
      message: `Exported ${records.length} records from "${database.name}" as JSON dataset.`,
      type: 'export',
      databaseId: database.id,
      link: `/database/${database.id}`,
    });
    logClientActivity(
      'Data Export (JSON)',
      `Exported ${records.length} records from "${database.name}" as JSON dataset.`,
      'Export'
    );
  };

  const handlePrintPDF = () => {
    if (!database) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    createNotification({
      title: 'Export Completed',
      message: `Generated printable PDF document report for "${database.name}".`,
      type: 'export',
      databaseId: database.id,
      link: `/database/${database.id}`,
    });

    logClientActivity(
      'Data Export (PDF Report)',
      `Generated printable PDF document report for "${database.name}".`,
      'Export'
    );

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${database.name} Report</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #1e293b; }
            h1 { color: #0f172a; margin-bottom: 5px; }
            p { color: #64748b; font-size: 12px; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 11px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>NexusDB AI – ${database.name} Report</h1>
          <p>Generated on ${new Date().toLocaleString()} | Total Records: ${records.length}</p>
          <table>
            <thead>
              <tr>
                ${database.fields.map((f) => `<th>${f.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${records
                .map(
                  (r) => `
                <tr>
                  ${database.fields.map((f) => `<td>${r.data[f.name] ?? ''}</td>`).join('')}
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {mode === 'import'
                ? database
                  ? `Import Database / Records into ${database.name}`
                  : 'Import Database from Excel / CSV / JSON'
                : `Export Data for ${database?.name || 'Database'}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {showAnalyzedDialog && importedDatabase ? (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Dialog Header Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white space-y-1.5 shadow-md">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                </div>
                <h3 className="font-extrabold text-base tracking-tight">
                  I analyzed your data successfully.
                </h3>
              </div>
              <p className="text-xs text-blue-100 leading-relaxed opacity-95">
                Gemini AI completed structural parsing and key metric synthesis for <strong className="text-white font-semibold">{importedDatabase.name}</strong> ({parsedResult?.totalRows || records.length} records, {importedDatabase.fields.length} columns).
              </p>
            </div>

            {/* AI Insights Quick Summary */}
            {aiAnalysisResult && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-blue-500" /> Executive AI Summary
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed">
                  {aiAnalysisResult.answer}
                </p>
              </div>
            )}

            {/* Options List */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Select an option to generate visualizations or report:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Generate Dashboard */}
                <button
                  type="button"
                  onClick={() => {
                    if (onGenerateDashboard) {
                      onGenerateDashboard(importedDatabase);
                    } else {
                      setActiveDatabase(importedDatabase);
                      onClose();
                    }
                  }}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-white dark:bg-slate-900 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 text-left space-y-2 transition-all group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                      <LayoutDashboard className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Generate Dashboard
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Dynamic database table view, records grid & filters
                    </div>
                  </div>
                </button>

                {/* Option 2: Generate Charts */}
                <button
                  type="button"
                  onClick={() => {
                    if (onGenerateCharts) {
                      onGenerateCharts(importedDatabase);
                    } else {
                      setActiveDatabase(importedDatabase);
                      onClose();
                    }
                  }}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 bg-white dark:bg-slate-900 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40 text-left space-y-2 transition-all group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Generate Charts
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Bar distributions, donut breakdown & trend charts
                    </div>
                  </div>
                </button>

                {/* Option 3: Generate AI Insights */}
                <button
                  type="button"
                  onClick={() => {
                    if (onGenerateAIInsights) {
                      onGenerateAIInsights(importedDatabase, aiAnalysisResult);
                    } else {
                      setActiveDatabase(importedDatabase);
                      onClose();
                    }
                  }}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-violet-500 bg-white dark:bg-slate-900 hover:bg-violet-50/50 dark:hover:bg-violet-950/40 text-left space-y-2 transition-all group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Generate AI Insights
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Pattern synthesis, anomaly detection & smart queries
                    </div>
                  </div>
                </button>

                {/* Option 4: Generate Summary Report */}
                <button
                  type="button"
                  onClick={() => {
                    if (onGenerateSummaryReport) {
                      onGenerateSummaryReport(importedDatabase, aiAnalysisResult);
                    } else {
                      setActiveDatabase(importedDatabase);
                      onClose();
                    }
                  }}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 bg-white dark:bg-slate-900 hover:bg-amber-50/50 dark:hover:bg-amber-950/40 text-left space-y-2 transition-all group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Generate Summary Report
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Executive dataset summary with PDF export support
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : mode === 'import' ? (
          <div className="space-y-4">
            {/* File Drag and Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleProcessFile(file);
              }}
              className="p-5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-center space-y-1.5 hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer group"
            >
              <Upload className="w-7 h-7 text-blue-500 mx-auto group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Drag & Drop Excel (.xlsx, .xls), CSV, or JSON file here
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Supports Microsoft Excel Workbooks (.xlsx / .xls), CSV, and JSON format
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.json,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleProcessFile(file);
                }}
                className="hidden"
                id="excel-file-drop-input"
              />
              <label
                htmlFor="excel-file-drop-input"
                className="inline-block mt-1 px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
              >
                Browse Files
              </label>
            </div>

            {/* Progress indicator during parsing or importing */}
            {(isParsing || isExecuting) && (
              <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-blue-700 dark:text-blue-300">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    {progressMessage || 'Processing file...'}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Validation Error Alert */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-rose-800 dark:text-rose-200">Validation Error</div>
                  <p className="text-[11px] leading-relaxed opacity-90">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Successfully Parsed Info & Auto-Detected Fields */}
            {parsedResult && !isParsing && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>
                      Parsed {parsedResult.totalRows} Rows ({parsedResult.detectedFields.length} Columns)
                    </span>
                  </div>
                  {parsedResult.sheetName && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono">
                      Sheet: {parsedResult.sheetName}
                    </span>
                  )}
                </div>

                {/* Auto-Detected Fields */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Auto-Detected Fields & Inferred Data Types:
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {parsedResult.detectedFields.map((f) => (
                      <span
                        key={f.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-800 dark:text-slate-200 shadow-2xs"
                      >
                        <span className="font-medium">{f.label}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          {f.type}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Sample Row Preview */}
                {parsedResult.rows.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Sample Record Preview (Row 1):
                    </div>
                    <div className="max-h-24 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700/80 p-2 bg-white dark:bg-slate-900 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                      <pre>{JSON.stringify(parsedResult.rows[0], null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Import Target Options */}
            {parsedResult && !isParsing && (
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Import Action
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportTarget('new')}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                      importTarget === 'new'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-2xs font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Create New Database
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">Build new table with detected columns</div>
                  </button>

                  <button
                    type="button"
                    disabled={!database}
                    onClick={() => setImportTarget('existing')}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                      importTarget === 'existing'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-2xs font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <Table className="w-3.5 h-3.5 text-blue-500" />
                      {database ? `Import into "${database.name}"` : 'Select Active Database'}
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">Append records into active schema</div>
                  </button>
                </div>

                {importTarget === 'new' && (
                  <div className="mt-2 space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      New Database Name
                    </label>
                    <input
                      type="text"
                      value={customDbName}
                      onChange={(e) => setCustomDbName(e.target.value)}
                      placeholder="e.g. Sales Report Q3"
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Raw Text Input Fallback */}
            {!parsedResult && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Or Paste Raw CSV / Text Data Below (Header row + data rows)
                </label>
                <textarea
                  rows={3}
                  value={csvRawText}
                  onChange={(e) => setCsvRawText(e.target.value)}
                  placeholder="name,age,email\nJohn Doe,30,john@example.com"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
                {csvRawText.trim() && (
                  <button
                    type="button"
                    onClick={handleParseRawText}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    Parse Pasted Text
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isExecuting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={!parsedResult || isExecuting || isParsing}
                onClick={handleExecuteImport}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-1.5"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing Records...</span>
                  </>
                ) : (
                  <span>
                    Confirm Import ({parsedResult ? parsedResult.totalRows : 0} Records)
                  </span>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Select an export format to download or print your current dataset ({records.length} records).
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={exportCSV}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/40 text-left space-y-1.5 transition-all group"
              >
                <Download className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-slate-900 dark:text-white">CSV Format</div>
                <div className="text-[10px] text-slate-400">Comma Separated Values</div>
              </button>

              <button
                onClick={exportExcel}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/40 text-left space-y-1.5 transition-all group"
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-slate-900 dark:text-white">Excel Workbook (.xlsx)</div>
                <div className="text-[10px] text-slate-400">SheetJS formatted spreadsheet</div>
              </button>

              <button
                onClick={exportJSON}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 bg-slate-50/50 dark:bg-slate-800/40 text-left space-y-1.5 transition-all group"
              >
                <FileText className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-slate-900 dark:text-white">JSON Document</div>
                <div className="text-[10px] text-slate-400">Raw programmatic JSON</div>
              </button>

              <button
                onClick={handlePrintPDF}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-violet-500 bg-slate-50/50 dark:bg-slate-800/40 text-left space-y-1.5 transition-all group"
              >
                <Printer className="w-5 h-5 text-violet-500 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-slate-900 dark:text-white">Print / PDF Report</div>
                <div className="text-[10px] text-slate-400">Formatted printable view</div>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
