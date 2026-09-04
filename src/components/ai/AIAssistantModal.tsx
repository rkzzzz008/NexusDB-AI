import React, { useState, useCallback } from 'react';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import { AIQueryResponse, AIChartConfig } from '../../types.js';
import {
  Sparkles,
  Send,
  CheckCircle2,
  ArrowRight,
  X,
  AlertCircle,
  Filter,
  Lightbulb,
  ListChecks,
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
} from 'lucide-react';

interface AIAssistantModalProps {
  onClose: () => void;
  onApplyFilter?: (recordIds: string[]) => void;
  onDisplayChart?: (chartConfig: AIChartConfig, targetDatabaseId?: string) => void;
  initialResult?: AIQueryResponse | null;
  initialPrompt?: string;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  onClose,
  onApplyFilter,
  onDisplayChart,
  initialResult = null,
  initialPrompt = '',
}) => {
  const { activeDatabase, queryAI, setActiveRecordFilterIds, setActiveChartConfig, addToast } = useDatabase();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIQueryResponse | null>(initialResult);

  const quickPrompts = [
    'Show a pie chart of students by department',
    'Create a bar chart of attendance',
    'Generate a line chart of monthly sales',
    'Show students with attendance below 75%',
    'Which employee has highest salary?',
    'Find duplicate records',
  ];

  const handleRunQuery = useCallback(async (queryText?: string) => {
    const q = queryText || prompt;
    if (!q.trim()) return;

    setLoading(true);
    try {
      const res = await queryAI(q, activeDatabase?.id);
      if (res) {
        setResult(res);
        if (res.chartConfig) {
          addToast('Chart Generated', `AI configured a ${res.chartConfig.chartType.toUpperCase()} chart: "${res.chartConfig.title}"`, 'success');
        } else {
          addToast('AI Insights Ready', 'Gemini AI completed analysis.', 'success');
        }
      } else {
        // Error toast is shown by queryAI, but ensure loading is cleared
        setResult(null);
      }
    } finally {
      setLoading(false);
    }
  }, [prompt, activeDatabase?.id, queryAI, addToast]);

  const handleApplyFilter = useCallback(() => {
    if (result?.highlightedRecordIds) {
      setActiveRecordFilterIds(result.highlightedRecordIds);
      if (onApplyFilter) onApplyFilter(result.highlightedRecordIds);
      addToast('Filter Applied', `Filtered live table to ${result.highlightedRecordIds.length} matching records.`, 'info');
      onClose();
    }
  }, [result, setActiveRecordFilterIds, onApplyFilter, addToast, onClose]);

  const handleDisplayChartInAnalytics = useCallback(() => {
    if (result?.chartConfig) {
      setActiveChartConfig(result.chartConfig);
      if (onDisplayChart) {
        onDisplayChart(result.chartConfig, result.targetDatabaseId || activeDatabase?.id);
      }
      addToast(
        'Displaying in Analytics',
        `Showing ${result.chartConfig.chartType.toUpperCase()} chart inside the Analytics page.`,
        'success'
      );
      onClose();
    }
  }, [result, setActiveChartConfig, onDisplayChart, activeDatabase?.id, addToast, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>NexusDB Gemini AI Assistant</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  Gemini 3.7 Flash
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Context: <strong className="text-blue-600 dark:text-blue-400">{activeDatabase?.name || 'All System Databases'}</strong>
              </p>
            </div>
          </div>

          <button
            id="ai-assistant-modal-close-btn"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="space-y-3">
          <div className="relative">
            <input
              id="ai-assistant-query-input"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunQuery()}
              placeholder="Ask natural language questions about your records..."
              className="w-full pl-4 pr-12 py-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-inner"
            />
            <button
              id="ai-assistant-query-send-btn"
              disabled={loading || !prompt.trim()}
              onClick={() => handleRunQuery()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Suggestions */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Quick Suggestions:</span>
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setPrompt(p);
                  handleRunQuery(p);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 text-[11px] text-slate-700 dark:text-slate-300 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="p-8 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Gemini AI is analyzing records and synthesizing response...
            </p>
          </div>
        )}

        {/* Results Card */}
        {result && !loading && (
          <div className="space-y-4 pt-2">
            {/* Main Answer Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-500 dark:text-blue-400" /> AI Synthesis
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">
                  Type: {result.queryType || 'insight'}
                </span>
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                {result.answer}
              </div>
            </div>

            {/* AI Generated Chart Preview Card */}
            {result.chartConfig && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-600 text-white">
                      {result.chartConfig.chartType === 'pie' ? (
                        <PieIcon className="w-4 h-4" />
                      ) : result.chartConfig.chartType === 'line' || result.chartConfig.chartType === 'area' ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <BarChart3 className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>AI Chart: {result.chartConfig.title || 'Configured Chart'}</span>
                        <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          {result.chartConfig.chartType}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        {result.chartConfig.description || 'Chart automatically configured from your natural language request.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-blue-100 dark:border-blue-900/60">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Target Field: <span className="font-semibold text-slate-700 dark:text-slate-200">{result.chartConfig.categoryField}</span>
                    {result.chartConfig.valueField !== '__count__' && (
                      <span> • Metric: <span className="font-semibold text-slate-700 dark:text-slate-200">{result.chartConfig.valueField} ({result.chartConfig.aggregation?.toUpperCase()})</span></span>
                    )}
                  </div>
                  <button
                    onClick={handleDisplayChartInAnalytics}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Display inside Analytics Page</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Insights */}
            {result.insights && result.insights.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-slate-800/40 border border-amber-200/60 dark:border-slate-700/60 space-y-2">
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4" /> Identified Key Trends & Anomalies
                </h4>
                <ul className="space-y-1">
                  {result.insights.map((ins, i) => (
                    <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{ins}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.suggestedActions && result.suggestedActions.length > 0 && (
              <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-slate-800/40 border border-emerald-200/60 dark:border-slate-700/60 space-y-2">
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4" /> Action Recommendations
                </h4>
                <ul className="space-y-1">
                  {result.suggestedActions.map((act, i) => (
                    <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions Footer */}
            <div className="pt-2 flex items-center justify-between">
              {result.highlightedRecordIds && result.highlightedRecordIds.length > 0 ? (
                <button
                  onClick={handleApplyFilter}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20"
                >
                  <Filter className="w-4 h-4" />
                  <span>Apply Filter to Table ({result.highlightedRecordIds.length} Records)</span>
                </button>
              ) : (
                <div />
              )}

              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
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
