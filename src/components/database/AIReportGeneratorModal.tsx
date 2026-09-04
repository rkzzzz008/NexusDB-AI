import React, { useState, useEffect, useRef } from 'react';
import { DatabaseSchema, RecordItem, AIReportData } from '../../types.js';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import {
  FileText,
  Download,
  RefreshCw,
  X,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Table,
  BarChart3,
  Calendar,
  Layers,
  ShieldAlert,
  ArrowUpRight,
  PieChart,
  Percent,
  Hash,
  Clock,
  Printer,
  ChevronRight,
  Info,
  Check,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface AIReportGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  database: DatabaseSchema;
  records: RecordItem[];
}

export const AIReportGeneratorModal: React.FC<AIReportGeneratorModalProps> = ({
  isOpen,
  onClose,
  database,
  records,
}) => {
  const { generateAIReport, addToast } = useDatabase();
  const [report, setReport] = useState<AIReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'summary' | 'stats' | 'trends' | 'recommendations' | 'issues'>('all');
  const reportContentRef = useRef<HTMLDivElement>(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await generateAIReport(database.id);
      if (data) {
        setReport(data);
      }
    } catch (err) {
      console.error('Failed to load AI report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && database) {
      fetchReport();
    }
  }, [isOpen, database?.id]);

  if (!isOpen) return null;

  const handleDownloadPDF = async () => {
    if (!reportContentRef.current || !report) {
      addToast('Error', 'Report content is not ready for export.', 'error');
      return;
    }

    setIsExportingPDF(true);
    try {
      const element = reportContentRef.current;

      // Temporary class or clone for crisp white background PDF export
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      // Multi-page handling if content is tall
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const fileName = `${database.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_AI_Executive_Report.pdf`;
      pdf.save(fileName);

      addToast('Report Downloaded', `Successfully generated PDF: ${fileName}`, 'success');
    } catch (error) {
      console.error('PDF Generation failed, attempting window.print fallback:', error);
      window.print();
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      id="ai-report-generator-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div
        id="ai-report-generator-modal-container"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                  Executive AI Report
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Gemini 2.5 Flash
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {database.name}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Executive analysis, statistical aggregates, identified trends, recommendations & potential risks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="ai-report-regenerate-btn"
              onClick={fetchReport}
              disabled={loading || isExportingPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all disabled:opacity-50"
              title="Regenerate Report with Gemini"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden sm:inline">Regenerate</span>
            </button>

            <button
              id="ai-report-download-pdf-btn"
              onClick={handleDownloadPDF}
              disabled={loading || !report || isExportingPDF}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              title="Download executive report as PDF"
            >
              <Download className={`w-4 h-4 ${isExportingPDF ? 'animate-bounce' : ''}`} />
              <span>{isExportingPDF ? 'Exporting PDF...' : 'Download as PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={loading || !report}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors hidden md:flex"
              title="Print Report"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              id="ai-report-modal-close-btn"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Filter Tabs */}
        {report && !loading && (
          <div className="px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Sections:
            </span>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Complete Report
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'summary'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Executive Summary
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'stats'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Statistics & Metrics
            </button>
            <button
              onClick={() => setActiveTab('trends')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'trends'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Key Trends ({report.keyTrends.length})
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'recommendations'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Recommendations ({report.recommendations.length})
            </button>
            <button
              onClick={() => setActiveTab('issues')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'issues'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Potential Issues ({report.potentialIssues.length})
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 animate-pulse flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
                  <Sparkles className="w-8 h-8 animate-spin" />
                </div>
                <div className="absolute -inset-1 rounded-2xl bg-blue-500/20 blur-md animate-ping" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Generating AI Executive Report...
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Gemini is analyzing {records.length} records, computing multi-variable statistics, identifying strategic trends, and auditing potential anomalies.
                </p>
              </div>
            </div>
          ) : report ? (
            <div
              ref={reportContentRef}
              id="ai-executive-report-printable-content"
              className="space-y-6 bg-white dark:bg-slate-900 p-2 sm:p-4 rounded-xl text-slate-900 dark:text-slate-100"
            >
              {/* Document Header Banner (Included in PDF) */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-500/30 text-blue-300 border border-blue-400/30 uppercase tracking-wider">
                        Executive Intelligence Briefing
                      </span>
                      <span className="text-xs text-slate-300">• {report.category}</span>
                    </div>
                    <h1 className="text-2xl font-black tracking-tight mt-1 text-white">
                      {report.databaseName}
                    </h1>
                  </div>

                  <div className="text-left sm:text-right space-y-0.5">
                    <div className="text-xs font-semibold text-slate-300 flex items-center sm:justify-end gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      <span>{new Date(report.generatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Generated at {new Date(report.generatedAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {/* Key Metric Highlights Header Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Table className="w-3 h-3 text-blue-400" /> Total Records
                    </div>
                    <div className="text-xl font-black text-white mt-0.5">
                      {report.totalRecords.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Active Records
                    </div>
                    <div className="text-xl font-black text-emerald-400 mt-0.5">
                      {report.activeRecords.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-purple-400" /> Attribute Fields
                    </div>
                    <div className="text-xl font-black text-white mt-0.5">
                      {report.totalFields}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Percent className="w-3 h-3 text-amber-400" /> Data Completeness
                    </div>
                    <div className="text-xl font-black text-amber-400 mt-0.5">
                      {report.statistics.completenessRate}
                    </div>
                  </div>
                </div>
              </div>

              {/* 1. EXECUTIVE SUMMARY SECTION */}
              {(activeTab === 'all' || activeTab === 'summary') && (
                <div
                  id="section-executive-summary"
                  className="p-5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 shadow-xs space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                      1. Executive Summary
                    </h2>
                  </div>

                  <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans font-normal whitespace-pre-line pl-1 border-l-2 border-blue-400 dark:border-blue-600">
                    {report.executiveSummary}
                  </div>

                  {report.statistics.insightsSummary && (
                    <div className="mt-3 p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-blue-100 dark:border-blue-900 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <span>{report.statistics.insightsSummary}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 2. STATISTICS & METRICS SECTION */}
              {(activeTab === 'all' || activeTab === 'stats') && (
                <div id="section-statistics" className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                      2. Quantitative Statistics & Field Metrics
                    </h2>
                  </div>

                  {/* Field Metrics Table */}
                  {report.statistics.metrics && report.statistics.metrics.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-3">Field Name</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Populated Rows</th>
                            <th className="p-3">Average / Top Frequency</th>
                            <th className="p-3">Min / Distribution</th>
                            <th className="p-3">Max / Aggregate Sum</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                          {report.statistics.metrics.map((metric, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="p-3 font-bold text-slate-900 dark:text-white">
                                {metric.fieldLabel}
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  {metric.type}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-[11px]">
                                {metric.count} / {report.activeRecords}
                              </td>
                              <td className="p-3">
                                {metric.average !== undefined ? (
                                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                                    {metric.average.toLocaleString()}
                                  </span>
                                ) : metric.topCategory ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {metric.topCategory}
                                    </span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                      {metric.topCategoryPercent}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="p-3">
                                {metric.min !== undefined ? (
                                  <span className="font-mono text-slate-700 dark:text-slate-300">
                                    Min: {metric.min.toLocaleString()}
                                  </span>
                                ) : metric.distribution && metric.distribution.length > 0 ? (
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {metric.distribution.length} unique values
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="p-3">
                                {metric.max !== undefined ? (
                                  <div className="font-mono space-y-0.5">
                                    <div>Max: {metric.max.toLocaleString()}</div>
                                    {metric.sum !== undefined && (
                                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                        Sum: ${metric.sum.toLocaleString()}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 text-xs text-slate-500">No field metrics computed.</div>
                  )}
                </div>
              )}

              {/* 3. KEY TRENDS SECTION */}
              {(activeTab === 'all' || activeTab === 'trends') && (
                <div id="section-key-trends" className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="p-1.5 rounded-lg bg-amber-600 text-white">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                      3. Key Trends & Identified Patterns
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.keyTrends.map((trend, idx) => {
                      const isPositive = trend.impact === 'positive';
                      const isCritical = trend.impact === 'critical';
                      const isNegative = trend.impact === 'negative';

                      const badgeClasses = isPositive
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : isCritical
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        : isNegative
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';

                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                              {trend.title}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {trend.metricContext && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                  {trend.metricContext}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${badgeClasses}`}>
                                {trend.impact}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {trend.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. RECOMMENDATIONS SECTION */}
              {(activeTab === 'all' || activeTab === 'recommendations') && (
                <div id="section-recommendations" className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                      4. Strategic Recommendations
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {report.recommendations.map((rec, idx) => {
                      const isHigh = rec.priority === 'high';
                      const isMedium = rec.priority === 'medium';
                      const priorityColor = isHigh
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        : isMedium
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-emerald-50/40 dark:bg-slate-800/40 border border-emerald-200/60 dark:border-slate-700/60 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                                {idx + 1}
                              </span>
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                {rec.title}
                              </h4>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${priorityColor}`}>
                              {rec.priority} Priority
                            </span>
                          </div>

                          <div className="pl-7 space-y-1.5">
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-semibold">
                              Action: <span className="font-normal">{rec.action}</span>
                            </p>
                            {rec.expectedOutcome && (
                              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                <span>Expected Outcome: {rec.expectedOutcome}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. POTENTIAL ISSUES & RISK AUDIT */}
              {(activeTab === 'all' || activeTab === 'issues') && (
                <div id="section-potential-issues" className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="p-1.5 rounded-lg bg-rose-600 text-white">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                      5. Potential Issues & Risk Analysis
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {report.potentialIssues.map((issue, idx) => {
                      const isCrit = issue.severity === 'critical';
                      const isWarn = issue.severity === 'warning';
                      const sevBadge = isCrit
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        : isWarn
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';

                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-rose-50/30 dark:bg-slate-800/40 border border-rose-200/60 dark:border-slate-700/60 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className={`w-4 h-4 ${isCrit ? 'text-rose-500' : isWarn ? 'text-amber-500' : 'text-blue-500'}`} />
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                {issue.title}
                              </h4>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${sevBadge}`}>
                              {issue.severity} Severity
                            </span>
                          </div>

                          <div className="pl-6 space-y-1.5">
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                              {issue.description}
                            </p>
                            {issue.suggestedRemedy && (
                              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                                <span className="font-bold text-blue-600 dark:text-blue-400">Suggested Remedy: </span>
                                {issue.suggestedRemedy}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PDF Footer Notice */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
                <div>
                  NexusDB AI • Executive Report Intelligence • Dataset ID: <span className="font-mono">{report.databaseId}</span>
                </div>
                <div>
                  Powered by Google Gemini 2.5 Flash
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-sm font-semibold">Unable to generate report.</p>
              <button
                onClick={fetchReport}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Modal Bottom Sticky Bar */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Ready for executive presentation & PDF export</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
            >
              Close
            </button>
            {report && (
              <button
                id="ai-report-bottom-download-pdf-btn"
                onClick={handleDownloadPDF}
                disabled={isExportingPDF}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isExportingPDF ? 'Generating...' : 'Download as PDF'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
