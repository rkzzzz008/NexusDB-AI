import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Sparkles,
  RefreshCw,
  Layers,
  AlertTriangle,
  Copy,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  CheckCircle2,
  Lightbulb,
  ShieldCheck,
  TrendingUp,
  HelpCircle,
  BarChart2,
  FileText,
} from 'lucide-react';
import { DatabaseSchema, RecordItem, DatabaseInsightsData } from '../../types.js';

interface AIInsightsSectionProps {
  database: DatabaseSchema;
  records: RecordItem[];
  onViewAnalytics?: () => void;
  onFilterDuplicates?: () => void;
  onOpenCleaning?: () => void;
  onOpenReport?: () => void;
}

export const AIInsightsSection: React.FC<AIInsightsSectionProps> = ({
  database,
  records,
  onViewAnalytics,
  onOpenCleaning,
  onOpenReport,
}) => {
  const [insightsData, setInsightsData] = useState<DatabaseInsightsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevRecordHashRef = useRef<string>('');

  // Generate a signature of records to detect adds, edits, or deletes
  const recordsHash = useMemo(() => {
    return `${database.id}-${records.length}-${records.map((r) => `${r.id}:${r.updatedAt || ''}:${JSON.stringify(r.data)}`).join('|')}`;
  }, [database.id, records]);

  // Client-side real-time calculation for instantaneous metrics
  const localComputed = useMemo(() => {
    const activeRecords = records.filter((r) => !r.isArchived);
    const totalRecords = activeRecords.length;

    // 1. Detect all fields (schema + dynamic record keys)
    const fieldMap = new Map<string, { name: string; label: string; type: string }>();
    if (database.fields) {
      for (const f of database.fields) {
        fieldMap.set(f.name.toLowerCase(), { name: f.name, label: f.label || f.name, type: f.type || 'Text' });
      }
    }
    for (const r of activeRecords) {
      if (!r.data) continue;
      for (const [k, v] of Object.entries(r.data)) {
        if (!fieldMap.has(k.toLowerCase())) {
          let inferred = 'Text';
          if (typeof v === 'number') inferred = 'Number';
          else if (typeof v === 'boolean') inferred = 'Boolean';
          fieldMap.set(k.toLowerCase(), {
            name: k,
            label: k.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim().replace(/^./, (s) => s.toUpperCase()),
            type: inferred,
          });
        }
      }
    }
    const allFields = Array.from(fieldMap.values());

    // 2. Missing values
    let totalMissing = 0;
    const missingFields: { field: string; label: string; missingCount: number }[] = [];
    for (const f of allFields) {
      let mCount = 0;
      for (const r of activeRecords) {
        const val = r.data?.[f.name];
        if (val === undefined || val === null || val === '' || (typeof val === 'string' && val.trim() === '')) {
          mCount++;
        }
      }
      if (mCount > 0) {
        totalMissing += mCount;
        missingFields.push({ field: f.name, label: f.label, missingCount: mCount });
      }
    }

    // 3. Duplicates
    const seen = new Map<string, string>();
    const duplicateIds: string[] = [];
    const duplicateDetails: string[] = [];
    for (const r of activeRecords) {
      if (!r.data) continue;
      const ident =
        r.data.email ||
        r.data.regNumber ||
        r.data.studentId ||
        r.data.sku ||
        r.data.patientId ||
        r.data.employeeId ||
        r.data.phone;

      if (ident) {
        const key = String(ident).toLowerCase().trim();
        if (seen.has(key)) {
          duplicateIds.push(r.id);
          const name = r.data.studentName || r.data.name || r.data.fullName || r.data.productName || r.id;
          duplicateDetails.push(`Duplicate identifier "${ident}" in record "${name}"`);
        } else {
          seen.set(key, r.id);
        }
      }
    }

    // 4. Most common categories
    const mostCommonCategories: { field: string; label: string; topValue: string; count: number; percentage: number }[] = [];
    for (const f of allFields) {
      if (f.type === 'Dropdown' || f.type === 'Text') {
        const counts: Record<string, number> = {};
        let validCount = 0;
        for (const r of activeRecords) {
          const val = r.data?.[f.name];
          if (val !== undefined && val !== null && val !== '') {
            const str = String(val).trim();
            counts[str] = (counts[str] || 0) + 1;
            validCount++;
          }
        }
        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (entries.length > 0 && validCount > 0) {
          const [topVal, count] = entries[0];
          const pct = Math.round((count / validCount) * 100);
          if (entries.length <= totalRecords * 0.8 || f.type === 'Dropdown') {
            mostCommonCategories.push({ field: f.name, label: f.label, topValue: topVal, count, percentage: pct });
          }
        }
      }
    }

    // 5. Numeric averages, highest & lowest
    const numericAverages: { field: string; label: string; avg: number; sum: number; min: number; max: number; count: number }[] = [];
    const highestValues: { field: string; label: string; recordName: string; recordId: string; value: number }[] = [];
    const lowestValues: { field: string; label: string; recordName: string; recordId: string; value: number }[] = [];

    for (const f of allFields) {
      const nums: { id: string; name: string; val: number }[] = [];
      for (const r of activeRecords) {
        const raw = r.data?.[f.name];
        if (raw !== undefined && raw !== null && raw !== '') {
          const n = Number(raw);
          if (!isNaN(n)) {
            const name = r.data?.studentName || r.data?.name || r.data?.fullName || r.data?.productName || r.data?.itemTitle || `Record ${r.id.slice(-4)}`;
            nums.push({ id: r.id, name, val: n });
          }
        }
      }

      if (nums.length > 0 && (f.type === 'Number' || nums.length >= totalRecords * 0.5)) {
        const values = nums.map((i) => i.val);
        const sum = values.reduce((a, b) => a + b, 0);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = Number((sum / values.length).toFixed(2));

        numericAverages.push({
          field: f.name,
          label: f.label,
          avg,
          sum: Number(sum.toFixed(2)),
          min,
          max,
          count: values.length,
        });

        const maxItem = nums.find((i) => i.val === max) || nums[0];
        const minItem = nums.find((i) => i.val === min) || nums[0];

        highestValues.push({
          field: f.name,
          label: f.label,
          recordName: maxItem.name,
          recordId: maxItem.id,
          value: max,
        });

        lowestValues.push({
          field: f.name,
          label: f.label,
          recordName: minItem.name,
          recordId: minItem.id,
          value: min,
        });
      }
    }

    // Instant initial insights & recommendations
    const instantInsights: string[] = [];
    const instantRecommendations: string[] = [];

    if (mostCommonCategories.length > 0) {
      const topCat = mostCommonCategories[0];
      instantInsights.push(`Most records (${topCat.percentage}%) belong to ${topCat.topValue} in ${topCat.label}.`);
    }

    for (const nav of numericAverages) {
      const nameL = nav.field.toLowerCase();
      if (nameL.includes('attendance')) {
        const below75 = activeRecords.filter((r) => Number(r.data?.[nav.field]) < 75);
        if (below75.length > 0) {
          instantInsights.push(`Average attendance is ${nav.avg}%. ${below75.length} student(s) currently sit below the 75% requirement.`);
        } else {
          instantInsights.push(`Cohort attendance is maintained at a healthy ${nav.avg}% average.`);
        }
      } else if (nameL.includes('stock') || nameL.includes('quantity')) {
        const lowStock = activeRecords.filter((r) => Number(r.data?.[nav.field]) <= Number(r.data?.reorderPoint || 15));
        if (lowStock.length > 0) {
          instantInsights.push(`Inventory stock is running low for ${lowStock.length} catalog product(s) below reorder points.`);
        }
      } else if (nameL.includes('cgpa') || nameL.includes('gpa')) {
        instantInsights.push(`Academic CGPA averages ${nav.avg} across ${nav.count} active student profiles.`);
      } else if (nameL.includes('salary') || nameL.includes('price')) {
        instantInsights.push(`Average ${nav.label} is $${nav.avg.toLocaleString()} with cumulative sum of $${nav.sum.toLocaleString()}.`);
      }
    }

    if (duplicateIds.length > 0) {
      instantInsights.push(`Found ${duplicateIds.length} duplicate record identifier(s) requiring review.`);
      instantRecommendations.push('Remove duplicate records to prevent data inconsistency.');
    } else {
      instantInsights.push('Zero duplicate records detected. All key identifiers are unique.');
    }

    if (totalMissing > 0) {
      const missFields = missingFields.map((f) => f.label).slice(0, 3).join(', ');
      instantInsights.push(`Found ${totalMissing} missing value(s) in fields (${missFields}).`);
      instantRecommendations.push(`Complete missing values in [${missFields}] to maintain 100% data fidelity.`);
    } else {
      instantInsights.push('All record fields are complete with zero missing values.');
    }

    if (numericAverages.length > 0) {
      instantRecommendations.push('Generate charts for better visualization of metric distributions.');
    }
    if (mostCommonCategories.length > 0) {
      instantRecommendations.push(`Segment analysis by ${mostCommonCategories[0].label} for balanced cohort reporting.`);
    }

    return {
      databaseId: database.id,
      databaseName: database.name,
      totalRecords,
      missingValues: { totalMissing, fields: missingFields },
      duplicates: { count: duplicateIds.length, details: duplicateDetails, duplicateIds },
      mostCommonCategories,
      highestValues,
      lowestValues,
      numericAverages,
      insights: instantInsights,
      recommendations: instantRecommendations,
      analyzedAt: new Date().toISOString(),
      isAiGenerated: false,
    };
  }, [database, records]);

  // Function to call Gemini AI backend for deep intelligent insights
  const fetchGeminiInsights = async (force: boolean = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    const token = localStorage.getItem('nexus_token') || localStorage.getItem('nexusdb_token');

    try {
      const res = await fetch(`/api/ai/insights/${database.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      });

      if (res.ok) {
        const data: DatabaseInsightsData = await res.json();
        setInsightsData(data);
        setLastRefreshed(new Date());
      } else {
        // Fallback to local computed data
        setInsightsData(localComputed);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('AI Insights fetch failed, utilizing instant mathematical model:', err);
        setInsightsData(localComputed);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger analysis when database is opened or records change
  useEffect(() => {
    if (prevRecordHashRef.current !== recordsHash) {
      prevRecordHashRef.current = recordsHash;
      // Optimistically update instant calculations
      setInsightsData((prev) => ({
        ...localComputed,
        insights: prev?.isAiGenerated ? prev.insights : localComputed.insights,
        recommendations: prev?.isAiGenerated ? prev.recommendations : localComputed.recommendations,
      }));

      // Debounce Gemini request slightly to avoid spamming on rapid keystrokes
      const timer = setTimeout(() => {
        fetchGeminiInsights();
      }, 350);

      return () => {
        clearTimeout(timer);
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }
  }, [recordsHash, database.id]);

  // Active data to display (merging latest server response or instant local stats)
  const displayData = insightsData || localComputed;
  const activeRecordsCount = records.filter((r) => !r.isArchived).length;

  return (
    <div id="ai-insights-section" className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/20 border border-blue-800/40 dark:border-blue-700/30 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>AI Insights & Analytics</span>
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                Gemini 2.5 Active
              </span>
              {isLoading && (
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 animate-pulse">
                  Analyzing live records...
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Automated record audit, mathematical statistics, anomalies, and AI suggestions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {onOpenReport && (
            <button
              id="generate-ai-report-insights-btn"
              onClick={onOpenReport}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
              title="Generate Executive AI Report with Executive Summary, Statistics, Trends, Recommendations and Issues"
            >
              <FileText className="w-3.5 h-3.5 text-blue-200" />
              <span>Generate AI Report</span>
            </button>
          )}

          {onOpenCleaning && (
            <button
              id="clean-data-ai-insights-btn"
              onClick={onOpenCleaning}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
              title="Detect and clean duplicate records, missing values, invalid emails/phones, dates, extra spaces and casing"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Clean Data with AI</span>
            </button>
          )}

          <button
            id="refresh-ai-insights-btn"
            onClick={() => fetchGeminiInsights(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            title="Re-run Gemini AI database analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
            <span>{isLoading ? 'Analyzing...' : 'Refresh AI'}</span>
          </button>
        </div>
      </div>

      {/* 1. Metric Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Records */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Records</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {displayData.totalRecords ?? activeRecordsCount}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Live database items
          </div>
        </div>

        {/* Missing Values */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Missing Values</span>
            {displayData.missingValues.totalMissing > 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <div
            className={`text-2xl font-black ${
              displayData.missingValues.totalMissing > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            } mt-1`}
          >
            {displayData.missingValues.totalMissing}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {displayData.missingValues.totalMissing === 0
              ? '100% Data Complete'
              : `${displayData.missingValues.fields.length} field(s) with nulls`}
          </div>
        </div>

        {/* Duplicate Records */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Duplicate Records</span>
            {displayData.duplicates.count > 0 ? (
              <Copy className="w-4 h-4 text-rose-500" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <div
            className={`text-2xl font-black ${
              displayData.duplicates.count > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            } mt-1`}
          >
            {displayData.duplicates.count}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {displayData.duplicates.count === 0 ? 'Unique ID Keys' : 'Duplicate keys found'}
          </div>
        </div>

        {/* Most Common Category */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Top Category</span>
            <PieChart className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-1 truncate">
            {displayData.mostCommonCategories[0]?.topValue || 'Balanced'}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {displayData.mostCommonCategories[0]
              ? `${displayData.mostCommonCategories[0].percentage}% in ${displayData.mostCommonCategories[0].label}`
              : 'Even distribution'}
          </div>
        </div>

        {/* Highest Value */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Highest Value</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white mt-1 truncate">
            {displayData.highestValues[0]
              ? `${displayData.highestValues[0].value.toLocaleString()} (${displayData.highestValues[0].label})`
              : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {displayData.highestValues[0] ? displayData.highestValues[0].recordName : 'No numeric data'}
          </div>
        </div>

        {/* Lowest Value */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Lowest Value</span>
            <ArrowDownRight className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white mt-1 truncate">
            {displayData.lowestValues[0]
              ? `${displayData.lowestValues[0].value.toLocaleString()} (${displayData.lowestValues[0].label})`
              : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {displayData.lowestValues[0] ? displayData.lowestValues[0].recordName : 'No numeric data'}
          </div>
        </div>
      </div>

      {/* Numeric Averages Strip (If numeric fields exist) */}
      {displayData.numericAverages.length > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center gap-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
            <Calculator className="w-4 h-4 text-blue-500" />
            <span>Average Values:</span>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {displayData.numericAverages.map((nav, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shadow-2xs"
              >
                <span className="font-semibold text-slate-600 dark:text-slate-400">{nav.label}:</span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400">{nav.avg}</span>
                <span className="text-[10px] text-slate-400">(Min: {nav.min} / Max: {nav.max})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Intelligent AI Insights & Recommendations Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Intelligent AI Insights */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Intelligent AI Insights</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              Live Synthesis
            </span>
          </div>

          <div className="space-y-2.5">
            {displayData.insights && displayData.insights.length > 0 ? (
              displayData.insights.map((insight, idx) => {
                let badgeColor = 'text-blue-500 bg-blue-50 dark:bg-blue-950';
                if (insight.toLowerCase().includes('duplicate') || insight.toLowerCase().includes('decreased') || insight.toLowerCase().includes('low')) {
                  badgeColor = 'text-rose-500 bg-rose-50 dark:bg-rose-950';
                } else if (insight.toLowerCase().includes('missing') || insight.toLowerCase().includes('threshold')) {
                  badgeColor = 'text-amber-500 bg-amber-50 dark:bg-amber-950';
                } else if (insight.toLowerCase().includes('complete') || insight.toLowerCase().includes('healthy') || insight.toLowerCase().includes('unique')) {
                  badgeColor = 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950';
                }

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 transition-all hover:bg-slate-100/60 dark:hover:bg-slate-800/70"
                  >
                    <div className={`p-1 rounded-md shrink-0 mt-0.5 ${badgeColor}`}>
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {insight}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-400 italic py-2">
                No insights available. Add records to generate AI observations.
              </div>
            )}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                <Lightbulb className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">AI Recommendations</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              Next Actions
            </span>
          </div>

          <div className="space-y-2.5">
            {displayData.recommendations && displayData.recommendations.length > 0 ? (
              displayData.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/40 transition-all hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40"
                >
                  <div className="p-1 rounded-md shrink-0 mt-0.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-semibold">
                      {rec}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 italic py-2">
                All records optimized. No immediate action required.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
