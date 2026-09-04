import React from 'react';
import { DatabaseSchema, RecordItem, AIQueryResponse } from '../../types.js';
import {
  FileText,
  Printer,
  X,
  Sparkles,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Table,
  BarChart3,
  Calendar,
  Database,
  Layers,
} from 'lucide-react';

interface SummaryReportModalProps {
  database: DatabaseSchema;
  records: RecordItem[];
  aiAnalysis: AIQueryResponse | null;
  onClose: () => void;
}

export const SummaryReportModal: React.FC<SummaryReportModalProps> = ({
  database,
  records,
  aiAnalysis,
  onClose,
}) => {
  const activeRecords = records.filter((r) => !r.isArchived);

  // Field type breakdown
  const numberFields = database.fields.filter((f) => f.type === 'Number');
  const dropdownFields = database.fields.filter((f) => f.type === 'Dropdown');

  // Compute numerical statistics
  const numericStats = numberFields.map((field) => {
    const values = activeRecords
      .map((r) => Number(r.data[field.name]))
      .filter((v) => !isNaN(v));
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? sum / values.length : 0;
    const max = values.length ? Math.max(...values) : 0;
    const min = values.length ? Math.min(...values) : 0;
    return {
      label: field.label,
      sum,
      avg: Math.round(avg * 100) / 100,
      max,
      min,
      count: values.length,
    };
  });

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${database.name} - Executive Summary Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; color: #0f172a; line-height: 1.5; }
            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 25px; }
            h1 { color: #0f172a; margin: 0 0 8px 0; font-size: 24px; }
            .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
            .section { margin-bottom: 25px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
            .section-title { font-weight: bold; font-size: 14px; color: #1e293b; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
            .badge { display: inline-block; padding: 2px 8px; background: #dbeafe; color: #1e40af; border-radius: 4px; font-size: 11px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 12px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: bold; }
            ul { margin: 8px 0; padding-left: 20px; }
            li { margin-bottom: 4px; font-size: 12px; color: #334155; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>NexusDB AI – Executive Summary Report</h1>
            <div class="meta">
              Dataset: <strong>${database.name}</strong> (${database.category}) |
              Total Records: <strong>${activeRecords.length}</strong> |
              Generated on: <strong>${new Date().toLocaleString()}</strong>
            </div>
          </div>

          ${
            aiAnalysis
              ? `
            <div class="section">
              <div class="section-title">
                <span class="badge">Gemini AI Synthesis</span>
              </div>
              <p style="font-size: 13px; color: #1e293b; white-space: pre-wrap;">${aiAnalysis.answer}</p>
            </div>

            ${
              aiAnalysis.insights && aiAnalysis.insights.length > 0
                ? `
              <div class="section">
                <div class="section-title">Key Trends & Insights</div>
                <ul>
                  ${aiAnalysis.insights.map((ins) => `<li>${ins}</li>`).join('')}
                </ul>
              </div>
            `
                : ''
            }

            ${
              aiAnalysis.suggestedActions && aiAnalysis.suggestedActions.length > 0
                ? `
              <div class="section">
                <div class="section-title">Actionable Recommendations</div>
                <ul>
                  ${aiAnalysis.suggestedActions.map((act) => `<li>${act}</li>`).join('')}
                </ul>
              </div>
            `
                : ''
            }
          `
              : ''
          }

          ${
            numericStats.length > 0
              ? `
            <div class="section">
              <div class="section-title">Numerical Metrics Aggregate</div>
              <table>
                <thead>
                  <tr>
                    <th>Metric Field</th>
                    <th>Average</th>
                    <th>Sum Total</th>
                    <th>Min</th>
                    <th>Max</th>
                  </tr>
                </thead>
                <tbody>
                  ${numericStats
                    .map(
                      (s) => `
                    <tr>
                      <td><strong>${s.label}</strong></td>
                      <td>${s.avg.toLocaleString()}</td>
                      <td>$${s.sum.toLocaleString()}</td>
                      <td>${s.min.toLocaleString()}</td>
                      <td>${s.max.toLocaleString()}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
              : ''
          }

          <div class="section">
            <div class="section-title">Dataset Record Preview (First 15 Rows)</div>
            <table>
              <thead>
                <tr>
                  ${database.fields.map((f) => `<th>${f.label}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${activeRecords
                  .slice(0, 15)
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
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  Summary Report – {database.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Gemini AI Generated
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Executive analysis compiled from {activeRecords.length} dataset records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Export PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dataset Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Table className="w-3.5 h-3.5 text-blue-500" /> Total Records
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white">
              {activeRecords.length}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-emerald-500" /> Fields Count
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white">
              {database.fields.length}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5 text-violet-500" /> Numeric Metrics
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white">
              {numberFields.length}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-500" /> Generated
            </div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
              {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Gemini AI Synthesis Section */}
        {aiAnalysis && (
          <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span>Gemini AI Executive Synthesis</span>
            </div>
            <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
              {aiAnalysis.answer}
            </div>
          </div>
        )}

        {/* Key Trends & Insights */}
        {aiAnalysis?.insights && aiAnalysis.insights.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-slate-800/40 border border-amber-200/60 dark:border-slate-700/60 space-y-2">
            <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> Key Trends & Identified Patterns
            </h4>
            <ul className="space-y-1.5">
              {aiAnalysis.insights.map((ins, idx) => (
                <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>{ins}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Recommendations */}
        {aiAnalysis?.suggestedActions && aiAnalysis.suggestedActions.length > 0 && (
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-slate-800/40 border border-emerald-200/60 dark:border-slate-700/60 space-y-2">
            <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Executive Recommendations
            </h4>
            <ul className="space-y-1.5">
              {aiAnalysis.suggestedActions.map((act, idx) => (
                <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{act}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Numeric Aggregates Table */}
        {numericStats.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Field Aggregates & Distribution
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-bold">
                  <tr>
                    <th className="p-3">Field Name</th>
                    <th className="p-3">Average</th>
                    <th className="p-3">Sum Total</th>
                    <th className="p-3">Min Value</th>
                    <th className="p-3">Max Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                  {numericStats.map((stat, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-sans font-semibold text-slate-900 dark:text-white">
                        {stat.label}
                      </td>
                      <td className="p-3 text-blue-600 dark:text-blue-400">{stat.avg.toLocaleString()}</td>
                      <td className="p-3 text-emerald-600 dark:text-emerald-400">${stat.sum.toLocaleString()}</td>
                      <td className="p-3">{stat.min.toLocaleString()}</td>
                      <td className="p-3">{stat.max.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
