import React, { useMemo, useState, useEffect } from 'react';
import { DatabaseSchema, RecordItem, AIChartConfig } from '../../types.js';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  SlidersHorizontal,
  Calculator,
  Layers,
  ArrowUpDown,
  Hash,
  Sparkles,
  Search,
  X,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface AnalyticsDashboardProps {
  database: DatabaseSchema;
  records: RecordItem[];
  chartConfig?: AIChartConfig | null;
}

interface DynamicFieldOption {
  key: string;
  label: string;
  type: string;
  isNumeric: boolean;
}

type AggregationType = 'count' | 'avg' | 'sum' | 'min' | 'max';

const COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#f43f5e', // rose-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#eab308', // yellow-500
];

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ database, records, chartConfig }) => {
  const { activeChartConfig, setActiveChartConfig, queryAI, addToast } = useDatabase();
  const activeRecords = useMemo(() => records.filter((r) => !r.isArchived), [records]);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // 1. Dynamically extract all fields from schema and records
  const availableFields = useMemo<DynamicFieldOption[]>(() => {
    const map = new Map<string, DynamicFieldOption>();

    // Add schema fields
    if (database?.fields) {
      for (const f of database.fields) {
        const isNum = f.type === 'Number';
        map.set(f.name, {
          key: f.name,
          label: f.label || f.name,
          type: f.type || 'Text',
          isNumeric: isNum,
        });
      }
    }

    // Add dynamically detected fields from active records
    activeRecords.forEach((r) => {
      if (!r.data) return;
      Object.entries(r.data).forEach(([k, val]) => {
        if (!map.has(k)) {
          const isNum = typeof val === 'number' || (!isNaN(Number(val)) && val !== '' && val !== null && typeof val !== 'boolean');
          const label = k
            .replace(/([A-Z])/g, ' $1')
            .replace(/[_-]/g, ' ')
            .trim()
            .replace(/^./, (str) => str.toUpperCase());
          map.set(k, {
            key: k,
            label,
            type: isNum ? 'Number' : typeof val === 'boolean' ? 'Boolean' : 'Text',
            isNumeric: isNum,
          });
        } else {
          // If marked non-numeric before, verify if record values are numbers
          const existing = map.get(k)!;
          if (!existing.isNumeric && val !== null && val !== undefined && val !== '') {
            if (typeof val === 'number' || (!isNaN(Number(val)) && typeof val !== 'boolean')) {
              existing.isNumeric = true;
            }
          }
        }
      });
    });

    return Array.from(map.values());
  }, [database, activeRecords]);

  // Numeric fields subset
  const numericFields = useMemo(
    () => availableFields.filter((f) => f.isNumeric),
    [availableFields]
  );

  // Categorical / grouping fields subset
  const categoricalFields = useMemo(
    () => availableFields.filter((f) => f.type === 'Dropdown' || f.type === 'Text' || !f.isNumeric),
    [availableFields]
  );

  // Default selections
  const defaultCategoryKey = useMemo(() => {
    const dropdown = availableFields.find((f) => f.type === 'Dropdown');
    if (dropdown) return dropdown.key;
    const textOrCat = availableFields.find((f) => !f.isNumeric && f.key !== 'id');
    if (textOrCat) return textOrCat.key;
    return availableFields[0]?.key || '';
  }, [availableFields]);

  const defaultNumericKey = useMemo(() => {
    return numericFields[0]?.key || '__count__';
  }, [numericFields]);

  // Bar Chart State
  const [barCategoryField, setBarCategoryField] = useState<string>('');
  const [barValueField, setBarValueField] = useState<string>('__count__');
  const [barAggregation, setBarAggregation] = useState<AggregationType>('count');

  // Pie Chart State
  const [pieCategoryField, setPieCategoryField] = useState<string>('');
  const [pieValueField, setPieValueField] = useState<string>('__count__');
  const [pieAggregation, setPieAggregation] = useState<AggregationType>('count');

  // Trend / Line Chart State
  const [trendXField, setTrendXField] = useState<string>('__record_name__');
  const [trendValueField, setTrendValueField] = useState<string>('');
  const [trendAggregation, setTrendAggregation] = useState<AggregationType>('avg');
  const [trendChartType, setTrendChartType] = useState<'area' | 'line'>('area');

  // Top KPI Metric Field
  const [kpiField, setKpiField] = useState<string>('');

  // Synchronize AI generated chart preset (from props or global context)
  useEffect(() => {
    const config = chartConfig || activeChartConfig;
    if (!config) return;

    if (config.chartType === 'pie') {
      if (config.categoryField && availableFields.some((f) => f.key === config.categoryField)) {
        setPieCategoryField(config.categoryField);
      }
      if (config.valueField) {
        setPieValueField(config.valueField);
      }
      if (config.aggregation) {
        setPieAggregation(config.aggregation);
      } else {
        setPieAggregation(config.valueField === '__count__' ? 'count' : 'sum');
      }
    } else if (config.chartType === 'bar') {
      if (config.categoryField && availableFields.some((f) => f.key === config.categoryField)) {
        setBarCategoryField(config.categoryField);
      }
      if (config.valueField) {
        setBarValueField(config.valueField);
      }
      if (config.aggregation) {
        setBarAggregation(config.aggregation);
      } else {
        setBarAggregation(config.valueField === '__count__' ? 'count' : 'avg');
      }
    } else if (config.chartType === 'line' || config.chartType === 'area') {
      setTrendChartType(config.chartType);
      const targetCat = config.categoryField || config.xAxisField;
      if (targetCat && (targetCat === '__record_name__' || availableFields.some((f) => f.key === targetCat))) {
        setTrendXField(targetCat);
      }
      const targetVal = config.valueField || config.yAxisField;
      if (targetVal) {
        setTrendValueField(targetVal);
      }
      if (config.aggregation) {
        setTrendAggregation(config.aggregation);
      }
    }
  }, [chartConfig, activeChartConfig, availableFields]);

  // Auto-sync selections when active database or available fields change
  useEffect(() => {
    if (!barCategoryField || !availableFields.some((f) => f.key === barCategoryField)) {
      setBarCategoryField(defaultCategoryKey);
    }
    if (!pieCategoryField || !availableFields.some((f) => f.key === pieCategoryField)) {
      setPieCategoryField(defaultCategoryKey);
    }
    if (!kpiField || !numericFields.some((f) => f.key === kpiField)) {
      setKpiField(numericFields[0]?.key || '');
    }
    if (!trendValueField || !numericFields.some((f) => f.key === trendValueField)) {
      setTrendValueField(numericFields[0]?.key || '__count__');
    }
  }, [database?.id, availableFields, defaultCategoryKey, numericFields]);

  const handleGenerateAIChart = async (textToUse?: string) => {
    const queryText = (textToUse || aiPrompt).trim();
    if (!queryText) return;
    setAiLoading(true);
    try {
      const res = await queryAI(queryText, database.id);
      if (res?.chartConfig) {
        setActiveChartConfig(res.chartConfig);
        addToast(
          `Chart Configured: ${res.chartConfig.title || 'Dynamic Chart'}`,
          `AI configured a ${res.chartConfig.chartType.toUpperCase()} chart based on your request.`,
          'success'
        );
      } else if (res?.answer) {
        addToast('AI Assistant', res.answer.slice(0, 100) + '...', 'info');
      }
    } catch (err: any) {
      addToast('AI Assistant', err?.message || 'Failed to process chart request', 'error');
    } finally {
      setAiLoading(false);
      setAiPrompt('');
    }
  };

  // Helper to compute aggregation for any Category + Value combination
  const computeCategoricalData = (
    catKey: string,
    valKey: string,
    agg: AggregationType
  ) => {
    if (!catKey || activeRecords.length === 0) return [];

    const groups: Record<string, { count: number; nums: number[] }> = {};

    activeRecords.forEach((r) => {
      let rawCat = r.data?.[catKey];
      let catName = 'Unassigned';

      if (rawCat !== undefined && rawCat !== null && String(rawCat).trim() !== '') {
        if (typeof rawCat === 'boolean') {
          catName = rawCat ? 'True / Yes' : 'False / No';
        } else {
          catName = String(rawCat).trim();
        }
      }

      if (!groups[catName]) {
        groups[catName] = { count: 0, nums: [] };
      }

      groups[catName].count += 1;

      if (valKey !== '__count__') {
        const rawVal = r.data?.[valKey];
        if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
          const num = Number(rawVal);
          if (!isNaN(num)) {
            groups[catName].nums.push(num);
          }
        }
      }
    });

    return Object.entries(groups).map(([name, g]) => {
      let finalVal = 0;
      if (valKey === '__count__' || agg === 'count') {
        finalVal = g.count;
      } else if (g.nums.length === 0) {
        finalVal = 0;
      } else if (agg === 'sum') {
        const sum = g.nums.reduce((a, b) => a + b, 0);
        finalVal = Number(sum.toFixed(2));
      } else if (agg === 'avg') {
        const sum = g.nums.reduce((a, b) => a + b, 0);
        finalVal = Number((sum / g.nums.length).toFixed(2));
      } else if (agg === 'min') {
        finalVal = Math.min(...g.nums);
      } else if (agg === 'max') {
        finalVal = Math.max(...g.nums);
      }

      return {
        name,
        value: finalVal,
        count: g.count,
      };
    });
  };

  // 2. Bar Chart Data calculation
  const barChartData = useMemo(() => {
    const data = computeCategoricalData(barCategoryField || defaultCategoryKey, barValueField, barAggregation);
    // Sort descending by value for cleaner bar presentation
    return data.sort((a, b) => b.value - a.value);
  }, [activeRecords, barCategoryField, defaultCategoryKey, barValueField, barAggregation]);

  // 3. Pie Chart Data calculation
  const pieChartData = useMemo(() => {
    const data = computeCategoricalData(pieCategoryField || defaultCategoryKey, pieValueField, pieAggregation);
    // Filter out zero values and take top slices for cleaner donut visuals
    const validData = data.filter((d) => d.value > 0);
    return validData.length > 0 ? validData.slice(0, 10) : data.slice(0, 10);
  }, [activeRecords, pieCategoryField, defaultCategoryKey, pieValueField, pieAggregation]);

  // 4. Trend Chart Data calculation
  const trendChartData = useMemo(() => {
    if (activeRecords.length === 0) return [];

    if (trendXField === '__record_name__') {
      // Individual record sequence
      return activeRecords.slice(0, 25).map((r, idx) => {
        const displayName =
          r.data?.studentName ||
          r.data?.fullName ||
          r.data?.name ||
          r.data?.productName ||
          r.data?.itemTitle ||
          r.data?.title ||
          r.data?.email ||
          `#${idx + 1}`;

        let val = 1;
        if (trendValueField && trendValueField !== '__count__') {
          const raw = Number(r.data?.[trendValueField]);
          val = isNaN(raw) ? 0 : raw;
        }

        return {
          name: String(displayName).slice(0, 14),
          val,
        };
      });
    }

    // Grouped by trendXField
    const grouped = computeCategoricalData(trendXField, trendValueField, trendAggregation);
    return grouped.map((g) => ({
      name: g.name.slice(0, 14),
      val: g.value,
    }));
  }, [activeRecords, trendXField, trendValueField, trendAggregation]);

  // 5. Dynamic KPI Highlights
  const activeKpiFieldObj = availableFields.find((f) => f.key === kpiField) || numericFields[0];
  const kpiStats = useMemo(() => {
    if (!activeKpiFieldObj) {
      return {
        fieldLabel: 'Records',
        sum: activeRecords.length,
        avg: activeRecords.length,
        min: activeRecords.length ? 1 : 0,
        max: activeRecords.length,
        count: activeRecords.length,
      };
    }

    const nums = activeRecords
      .map((r) => Number(r.data?.[activeKpiFieldObj.key]))
      .filter((n) => !isNaN(n));

    if (nums.length === 0) {
      return {
        fieldLabel: activeKpiFieldObj.label,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        count: 0,
      };
    }

    const sum = nums.reduce((a, b) => a + b, 0);
    const avg = sum / nums.length;
    const min = Math.min(...nums);
    const max = Math.max(...nums);

    return {
      fieldLabel: activeKpiFieldObj.label,
      sum: Number(sum.toFixed(2)),
      avg: Number(avg.toFixed(2)),
      min,
      max,
      count: nums.length,
    };
  }, [activeRecords, activeKpiFieldObj]);

  const barCategoryLabel = availableFields.find((f) => f.key === barCategoryField)?.label || 'Category';
  const barValueLabel = barValueField === '__count__' ? 'Record Count' : availableFields.find((f) => f.key === barValueField)?.label || 'Value';

  const pieCategoryLabel = availableFields.find((f) => f.key === pieCategoryField)?.label || 'Category';
  const pieValueLabel = pieValueField === '__count__' ? 'Record Count' : availableFields.find((f) => f.key === pieValueField)?.label || 'Value';

  const trendValueLabel = trendValueField === '__count__' ? 'Record Count' : availableFields.find((f) => f.key === trendValueField)?.label || 'Value';

  return (
    <div className="space-y-6">
      {/* Natural Language AI Chart Prompt Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-violet-50/70 dark:from-slate-900/90 dark:via-indigo-950/30 dark:to-slate-900/90 border border-blue-100 dark:border-indigo-900/40 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Natural Language Chart Generator
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                  Gemini AI
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ask Gemini in plain English to automatically configure and generate live database charts.
              </p>
            </div>
          </div>
        </div>

        {/* Query Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerateAIChart();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. 'Show a pie chart of students by department' or 'Create a bar chart of attendance'..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
              disabled={aiLoading}
            />
          </div>
          <button
            type="submit"
            disabled={aiLoading || !aiPrompt.trim()}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs flex items-center gap-1.5 shrink-0 transition-all"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Generate Chart</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Suggestion Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[11px] font-medium text-slate-400">Try asking:</span>
          <button
            type="button"
            onClick={() => handleGenerateAIChart('Show a pie chart of students by department.')}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all hover:border-blue-300 dark:hover:border-blue-700 flex items-center gap-1"
          >
            🥧 <span>"Show a pie chart of students by department"</span>
          </button>
          <button
            type="button"
            onClick={() => handleGenerateAIChart('Create a bar chart of attendance.')}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all hover:border-blue-300 dark:hover:border-blue-700 flex items-center gap-1"
          >
            📊 <span>"Create a bar chart of attendance"</span>
          </button>
          <button
            type="button"
            onClick={() => handleGenerateAIChart('Generate a line chart of monthly sales.')}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all hover:border-blue-300 dark:hover:border-blue-700 flex items-center gap-1"
          >
            📈 <span>"Generate a line chart of monthly sales"</span>
          </button>
        </div>
      </div>

      {/* Active AI Preset Banner */}
      {(activeChartConfig || chartConfig) && (
        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <div>
              <div className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <span>✦ Active AI Chart: {(chartConfig || activeChartConfig)?.title || 'Custom Preset'}</span>
                <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                  {(chartConfig || activeChartConfig)?.chartType}
                </span>
              </div>
              <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                {(chartConfig || activeChartConfig)?.description || 'Target fields and aggregations updated automatically.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveChartConfig(null)}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all shrink-0"
          >
            Reset Preset
          </button>
        </div>
      )}

      {/* Top Dynamic Analytics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Dataset */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Active Dataset
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {activeRecords.length} Entries
            </div>
          </div>
          <div className="text-[11px] text-emerald-500 font-semibold mt-2 flex items-center gap-1">
            <span>●</span> Live database synchronized
          </div>
        </div>

        {/* Card 2: Average Aggregate */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                Average {kpiStats.fieldLabel}
              </div>
              {numericFields.length > 1 && (
                <select
                  value={kpiField}
                  onChange={(e) => setKpiField(e.target.value)}
                  className="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-600 dark:text-slate-300 font-medium focus:outline-none"
                >
                  {numericFields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
              {kpiStats.avg.toLocaleString()}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-2">
            Arithmetic mean across {kpiStats.count} entries
          </div>
        </div>

        {/* Card 3: Sum / Peak Aggregate */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
              Total Cumulative {kpiStats.fieldLabel}
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {kpiStats.sum.toLocaleString()}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-2 flex items-center justify-between">
            <span>Range: Min {kpiStats.min.toLocaleString()}</span>
            <span>Max {kpiStats.max.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Dynamic Bar Chart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {barAggregation === 'count' ? 'Count Distribution' : `${barAggregation.toUpperCase()} of ${barValueLabel}`}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Grouped by <span className="font-semibold text-slate-600 dark:text-slate-300">{barCategoryLabel}</span>
                </p>
              </div>
            </div>

            {/* Dynamic Controls */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Category Field Selector */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Category:</span>
                <select
                  value={barCategoryField}
                  onChange={(e) => setBarCategoryField(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  {availableFields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Value Field Selector */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Value:</span>
                <select
                  value={barValueField}
                  onChange={(e) => {
                    const newField = e.target.value;
                    setBarValueField(newField);
                    if (newField === '__count__') {
                      setBarAggregation('count');
                    } else if (barAggregation === 'count') {
                      setBarAggregation('avg');
                    }
                  }}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="__count__">Record Count</option>
                  {numericFields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Aggregation Selector (when numeric field is chosen) */}
              {barValueField !== '__count__' && (
                <select
                  value={barAggregation}
                  onChange={(e) => setBarAggregation(e.target.value as AggregationType)}
                  className="text-xs bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-lg px-2 py-1 text-blue-700 dark:text-blue-300 font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="avg">Average</option>
                  <option value="sum">Sum</option>
                  <option value="max">Maximum</option>
                  <option value="min">Minimum</option>
                  <option value="count">Count</option>
                </select>
              )}
            </div>
          </div>

          <div className="h-64 w-full">
            {barChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={barChartData.length > 5 ? -25 : 0}
                    textAnchor={barChartData.length > 5 ? 'end' : 'middle'}
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [
                      typeof val === 'number' ? val.toLocaleString() : val,
                      barValueField === '__count__' ? 'Record Count' : `${barAggregation.toUpperCase()} of ${barValueLabel}`,
                    ]}
                    labelFormatter={(label) => `${barCategoryLabel}: ${label}`}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                    {barChartData.map((_, index) => (
                      <Cell key={`bar-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No active record data found to display.
              </div>
            )}
          </div>
        </div>

        {/* 2. Dynamic Donut / Pie Chart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <PieIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Proportion Breakdown
                </h3>
                <p className="text-[11px] text-slate-400">
                  Share by <span className="font-semibold text-slate-600 dark:text-slate-300">{pieCategoryLabel}</span>
                </p>
              </div>
            </div>

            {/* Dynamic Controls */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Category:</span>
                <select
                  value={pieCategoryField}
                  onChange={(e) => setPieCategoryField(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  {availableFields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Value:</span>
                <select
                  value={pieValueField}
                  onChange={(e) => {
                    const newField = e.target.value;
                    setPieValueField(newField);
                    if (newField === '__count__') {
                      setPieAggregation('count');
                    } else if (pieAggregation === 'count') {
                      setPieAggregation('sum');
                    }
                  }}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="__count__">Record Count</option>
                  {numericFields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {pieValueField !== '__count__' && (
                <select
                  value={pieAggregation}
                  onChange={(e) => setPieAggregation(e.target.value as AggregationType)}
                  className="text-xs bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2 py-1 text-indigo-700 dark:text-indigo-300 font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="sum">Sum</option>
                  <option value="avg">Average</option>
                  <option value="max">Maximum</option>
                  <option value="min">Minimum</option>
                  <option value="count">Count</option>
                </select>
              )}
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    animationDuration={600}
                  >
                    {pieChartData.map((_, index) => (
                      <Cell key={`pie-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => {
                      const total = pieChartData.reduce((acc, cur) => acc + (cur.value || 0), 0);
                      const pct = total > 0 ? ((Number(val) / total) * 100).toFixed(1) : '0';
                      const valStr = typeof val === 'number' ? val.toLocaleString() : val;
                      return [
                        `${valStr} (${pct}%)`,
                        pieValueField === '__count__' ? 'Record Count' : `${pieAggregation.toUpperCase()} of ${pieValueLabel}`,
                      ];
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(val) => <span className="text-xs text-slate-600 dark:text-slate-400">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No categorical slices available.
              </div>
            )}
          </div>
        </div>

        {/* 3. Dynamic Area & Line Trend Analysis Chart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Value Trend & Distribution Analysis
                </h3>
                <p className="text-[11px] text-slate-400">
                  Tracking <span className="font-semibold text-slate-600 dark:text-slate-300">{trendValueLabel}</span> across records
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* X-Axis Selector */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">X-Axis:</span>
                <select
                  value={trendXField}
                  onChange={(e) => setTrendXField(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="__record_name__">Individual Records (Sequential)</option>
                  {availableFields.map((f) => (
                    <option key={f.key} value={f.key}>
                      Grouped by {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Value Metric Selector */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Metric:</span>
                <select
                  value={trendValueField}
                  onChange={(e) => setTrendValueField(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  {numericFields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                  <option value="__count__">Record Count</option>
                </select>
              </div>

              {/* Aggregation if Grouped */}
              {trendXField !== '__record_name__' && trendValueField !== '__count__' && (
                <select
                  value={trendAggregation}
                  onChange={(e) => setTrendAggregation(e.target.value as AggregationType)}
                  className="text-xs bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2 py-1 text-emerald-700 dark:text-emerald-300 font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="avg">Average</option>
                  <option value="sum">Sum</option>
                  <option value="max">Maximum</option>
                  <option value="min">Minimum</option>
                </select>
              )}

              {/* Chart Mode Toggle */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setTrendChartType('area')}
                  className={`px-2 py-1 text-xs font-semibold rounded-md transition-all ${
                    trendChartType === 'area'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Area
                </button>
                <button
                  onClick={() => setTrendChartType('line')}
                  className={`px-2 py-1 text-xs font-semibold rounded-md transition-all ${
                    trendChartType === 'line'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Line
                </button>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            {trendChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {trendChartType === 'area' ? (
                  <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      interval={0}
                      angle={trendChartData.length > 6 ? -25 : 0}
                      textAnchor={trendChartData.length > 6 ? 'end' : 'middle'}
                    />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                      formatter={(val: any) => [
                        typeof val === 'number' ? val.toLocaleString() : val,
                        trendValueLabel,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="val"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorVal)"
                    />
                  </AreaChart>
                ) : (
                  <LineChart data={trendChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      interval={0}
                      angle={trendChartData.length > 6 ? -25 : 0}
                      textAnchor={trendChartData.length > 6 ? 'end' : 'middle'}
                    />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                      formatter={(val: any) => [
                        typeof val === 'number' ? val.toLocaleString() : val,
                        trendValueLabel,
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="val"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#10b981' }}
                      activeDot={{ r: 6, fill: '#059669' }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No trend data available for the chosen metric.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
