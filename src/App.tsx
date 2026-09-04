import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { DatabaseProvider, useDatabase } from './context/DatabaseContext.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import { Header } from './components/common/Header.tsx';
import { Toaster } from './components/common/Toaster.tsx';
import { Sidebar } from './components/common/Sidebar.tsx';
import { LandingPage } from './components/landing/LandingPage.tsx';
import { DashboardOverview } from './components/dashboard/DashboardOverview.tsx';
import { DynamicTable } from './components/database/DynamicTable.tsx';
import { DynamicForm } from './components/database/DynamicForm.tsx';
import { SchemaBuilderModal } from './components/database/SchemaBuilderModal.tsx';
import { ImportExportModal } from './components/database/ImportExportModal.tsx';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard.tsx';
import { AIAssistantModal } from './components/ai/AIAssistantModal.tsx';
import { AdminPanel } from './components/admin/AdminPanel.tsx';
import { SettingsView } from './components/settings/SettingsView.tsx';
import { AuthModal } from './components/auth/AuthModal.tsx';
import { ShareModal } from './components/database/ShareModal.tsx';
import { AIDatabaseCreatorModal } from './components/database/AIDatabaseCreatorModal.tsx';
import { SummaryReportModal } from './components/database/SummaryReportModal.tsx';
import { ResetPasswordModal } from './components/auth/ResetPasswordModal.tsx';
import { AIInsightsSection } from './components/dashboard/AIInsightsSection.tsx';
import { AICleaningModal } from './components/database/AICleaningModal.tsx';
import { AIReportGeneratorModal } from './components/database/AIReportGeneratorModal.tsx';
import { ActivityTimeline } from './components/activity/ActivityTimeline.tsx';
import { RecordItem, AIQueryResponse, DataCleaningFixItem } from './types.js';
import { Plus, Table, BarChart2, FileSpreadsheet, Sparkles, X, Edit2, Database, Share2, Wand2, FileText, Star } from 'lucide-react';

const MainContent: React.FC = () => {
  const { user, token, loading: authLoading } = useAuth();
  const {
    databases,
    activeDatabase,
    setActiveDatabase,
    records,
    createRecord,
    updateRecord,
    applyDataCleaningFixes,
    toggleFavoriteDatabase,
  } = useDatabase();

  console.log('[DEBUG] App re-rendered');

  const [activeView, setActiveView] = useState<string>(() => {
    return localStorage.getItem('nexus_token') ? 'dashboard' : 'landing';
  });
  const [subView, setSubView] = useState<'records' | 'analytics'>('records');
  const initializedRef = useRef(false);

  useEffect(() => {
    console.log('[DEBUG] App mounted');
  }, []);

  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showCreateDbModal, setShowCreateDbModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordItem | null>(null);
  const [importExportMode, setImportExportMode] = useState<'import' | 'export' | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [initialAiResult, setInitialAiResult] = useState<AIQueryResponse | null>(null);
  const [showSummaryReportModal, setShowSummaryReportModal] = useState(false);
  const [summaryReportAiResult, setSummaryReportAiResult] = useState<AIQueryResponse | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAICreatorModal, setShowAICreatorModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showCleaningModal, setShowCleaningModal] = useState(false);
  const [showAIReportModal, setShowAIReportModal] = useState(false);

  // Protected Route enforcement: Only run ONCE when auth finishes loading
  useEffect(() => {
    if (authLoading) return; // Don't run until auth is loaded
    
    if (!token && activeView !== 'landing') {
      setActiveView('landing');
      setShowAuthModal(true);
    } else if (token && activeView === 'landing' && !initializedRef.current) {
      setActiveView('dashboard');
      initializedRef.current = true;
    } else if (!token) {
      initializedRef.current = false;
    }
  }, [token, authLoading]); // Remove activeView from deps to prevent circular updates

  const activeDatabaseRecords = records.filter(
    (r) => activeDatabase && r.databaseId === activeDatabase.id
  );

  const handleSaveRecord = useCallback(async (formData: Record<string, any>) => {
    if (!activeDatabase) return;
    if (editingRecord) {
      await updateRecord(editingRecord.id, formData);
    } else {
      await createRecord(activeDatabase.id, formData);
    }
    setShowRecordModal(false);
    setEditingRecord(null);
  }, [activeDatabase, editingRecord, updateRecord, createRecord]);

  const handleViewChange = useCallback((view: string) => {
    if (!token && view !== 'landing') {
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }
    setActiveView(view);
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <Header
        onOpenAI={() => setShowAIModal(true)}
        onOpenCreateDb={() => setShowCreateDbModal(true)}
        activeView={activeView}
        setActiveView={handleViewChange}
      />
      <Toaster />

      {activeView === 'landing' || !token ? (
        <LandingPage
          onGetStarted={() => {
            if (token) {
              setActiveView('dashboard');
            } else {
              setAuthMode('register');
              setShowAuthModal(true);
            }
          }}
          onOpenAuth={(mode) => {
            setAuthMode(mode);
            setShowAuthModal(true);
          }}
        />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {(() => {
            console.log('[DEBUG] Protected route rendered');
            return null;
          })()}
          <Sidebar
            activeView={activeView}
            setActiveView={handleViewChange}
            onOpenCreateDb={() => setShowCreateDbModal(true)}
            onOpenAI={() => setShowAIModal(true)}
            onOpenAICreator={() => setShowAICreatorModal(true)}
          />

          <main className="flex-1 overflow-y-auto min-h-[calc(100vh-4rem)]">
            {activeView === 'dashboard' && (
              <DashboardOverview
                onSelectDatabase={(db) => {
                  setActiveDatabase(db);
                  setActiveView('database');
                  setSubView('records');
                }}
                onOpenCreateDb={() => setShowCreateDbModal(true)}
                onOpenAI={() => setShowAIModal(true)}
                onOpenImport={() => {
                  setImportExportMode('import');
                }}
                onOpenAICreator={() => setShowAICreatorModal(true)}
                setActiveView={handleViewChange}
              />
            )}

            {activeView === 'database' && activeDatabase && (
              <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
                {/* Database Title Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                          {activeDatabase.name}
                        </h1>
                        <button
                          type="button"
                          id={`header-toggle-fav-btn-${activeDatabase.id}`}
                          onClick={() => toggleFavoriteDatabase(activeDatabase.id)}
                          title={activeDatabase.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            activeDatabase.isFavorite
                              ? 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-950/40'
                              : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${activeDatabase.isFavorite ? 'fill-amber-400 text-amber-500' : ''}`} />
                        </button>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {activeDatabase.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {activeDatabase.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      id="generate-ai-report-header-btn"
                      onClick={() => setShowAIReportModal(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-xs font-bold text-white shadow-md shadow-indigo-500/20 transition-all hover:scale-105"
                      title="Generate Executive AI Report with Executive Summary, Statistics, Key Trends, Recommendations, and Potential Issues"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-200" />
                      <span>Generate AI Report</span>
                    </button>
                    <button
                      id="clean-data-with-ai-header-btn"
                      onClick={() => setShowCleaningModal(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:scale-105"
                      title="Analyze database for duplicates, invalid data, missing values and clean with AI"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                      <span>Clean Data with AI</span>
                    </button>
                    <button
                      id="header-share-db-btn"
                      onClick={() => setShowShareModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900 text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share DB</span>
                    </button>
                    <button
                      onClick={() => setImportExportMode('export')}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      Export
                    </button>
                    <button
                      onClick={() => setShowCreateDbModal(true)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Schema</span>
                    </button>
                  </div>
                </div>

                {/* AI Insights Section */}
                <AIInsightsSection
                  database={activeDatabase}
                  records={activeDatabaseRecords}
                  onViewAnalytics={() => setSubView('analytics')}
                  onOpenCleaning={() => setShowCleaningModal(true)}
                  onOpenReport={() => setShowAIReportModal(true)}
                />

                {/* Sub-View Navigation Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <button
                    id="subview-records-tab-btn"
                    onClick={() => setSubView('records')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subView === 'records'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Table className="w-4 h-4" />
                    <span>Dynamic Table View ({activeDatabaseRecords.length})</span>
                  </button>

                  <button
                    id="subview-analytics-tab-btn"
                    onClick={() => setSubView('analytics')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subView === 'analytics'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <BarChart2 className="w-4 h-4" />
                    <span>Live Analytics & Charts</span>
                  </button>
                </div>

                {/* Sub-View Content */}
                {subView === 'records' ? (
                  <DynamicTable
                    database={activeDatabase}
                    records={activeDatabaseRecords}
                    onAddRecord={() => {
                      setEditingRecord(null);
                      setShowRecordModal(true);
                    }}
                    onEditRecord={(record) => {
                      setEditingRecord(record);
                      setShowRecordModal(true);
                    }}
                    onOpenImport={() => setImportExportMode('import')}
                    onOpenCleaning={() => setShowCleaningModal(true)}
                    onOpenReport={() => setShowAIReportModal(true)}
                  />
                ) : (
                  <AnalyticsDashboard database={activeDatabase} records={activeDatabaseRecords} />
                )}
              </div>
            )}

            {activeView === 'analytics' && (
              <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Platform Analytics {activeDatabase ? `(${activeDatabase.name})` : ''}
                  </h1>
                </div>
                {activeDatabase || databases.length > 0 ? (
                  <AnalyticsDashboard
                    database={activeDatabase || databases[0]}
                    records={records.filter(r => r.databaseId === (activeDatabase?.id || databases[0]?.id))}
                  />
                ) : (
                  <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                    <p className="text-sm font-semibold text-slate-500">No databases created yet to analyze.</p>
                  </div>
                )}
              </div>
            )}

            {activeView === 'activity' && <ActivityTimeline />}
            {activeView === 'admin' && <AdminPanel />}
            {activeView === 'settings' && <SettingsView />}
          </main>
        </div>
      )}

      {/* Modals */}
      {showCreateDbModal && (
        <SchemaBuilderModal
          existingDatabase={activeDatabase}
          onClose={() => setShowCreateDbModal(false)}
        />
      )}

      {showRecordModal && activeDatabase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {editingRecord ? `Edit ${activeDatabase.name} Record` : `Add New ${activeDatabase.name} Record`}
              </h3>
              <button
                onClick={() => setShowRecordModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <DynamicForm
              database={activeDatabase}
              record={editingRecord}
              onSubmit={handleSaveRecord}
              onCancel={() => setShowRecordModal(false)}
            />
          </div>
        </div>
      )}

      {importExportMode && (importExportMode === 'import' || activeDatabase) && (
        <ImportExportModal
          database={activeDatabase}
          records={activeDatabaseRecords}
          mode={importExportMode}
          onClose={() => setImportExportMode(null)}
          onGenerateDashboard={(targetDb) => {
            setActiveDatabase(targetDb);
            setActiveView('database');
            setSubView('records');
            setImportExportMode(null);
          }}
          onGenerateCharts={(targetDb) => {
            setActiveDatabase(targetDb);
            setActiveView('database');
            setSubView('analytics');
            setImportExportMode(null);
          }}
          onGenerateAIInsights={(targetDb, aiResult) => {
            setActiveDatabase(targetDb);
            setInitialAiResult(aiResult);
            setShowAIModal(true);
            setImportExportMode(null);
          }}
          onGenerateSummaryReport={(targetDb, aiResult) => {
            setActiveDatabase(targetDb);
            setSummaryReportAiResult(aiResult);
            setShowSummaryReportModal(true);
            setImportExportMode(null);
          }}
        />
      )}

      {showAIModal && (
        <AIAssistantModal
          initialResult={initialAiResult}
          initialPrompt={initialAiResult ? 'AI Dataset Analysis Results' : ''}
          onClose={() => {
            setShowAIModal(false);
            setInitialAiResult(null);
          }}
          onDisplayChart={(chartConfig, targetDatabaseId) => {
            if (targetDatabaseId) {
              const target = databases.find((d) => d.id === targetDatabaseId);
              if (target) setActiveDatabase(target);
            }
            setActiveView('database');
            setSubView('analytics');
            setShowAIModal(false);
            setInitialAiResult(null);
          }}
        />
      )}

      {showSummaryReportModal && activeDatabase && (
        <SummaryReportModal
          database={activeDatabase}
          records={activeDatabaseRecords}
          aiAnalysis={summaryReportAiResult}
          onClose={() => {
            setShowSummaryReportModal(false);
            setSummaryReportAiResult(null);
          }}
        />
      )}
      {showAIReportModal && activeDatabase && (
        <AIReportGeneratorModal
          isOpen={showAIReportModal}
          onClose={() => setShowAIReportModal(false)}
          database={activeDatabase}
          records={activeDatabaseRecords}
        />
      )}
      {showCleaningModal && activeDatabase && (
        <AICleaningModal
          isOpen={showCleaningModal}
          onClose={() => setShowCleaningModal(false)}
          database={activeDatabase}
          records={activeDatabaseRecords}
          onApplyFixes={async (approvedFixes) => {
            return await applyDataCleaningFixes(activeDatabase.id, approvedFixes);
          }}
        />
      )}
      {showAICreatorModal && (
        <AIDatabaseCreatorModal
          onClose={() => setShowAICreatorModal(false)}
          onSuccess={() => {
            setActiveView('database');
          }}
        />
      )}
      {showShareModal && activeDatabase && (
        <ShareModal database={activeDatabase} onClose={() => setShowShareModal(false)} />
      )}
      {showResetPasswordModal && (
        <ResetPasswordModal
          onClose={() => setShowResetPasswordModal(false)}
          onSuccess={() => {
            setAuthMode('login');
            setShowAuthModal(true);
          }}
        />
      )}
      {showAuthModal && (
        <AuthModal
          initialMode={authMode}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setActiveView('dashboard');
          }}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <DatabaseProvider>
            <MainContent />
          </DatabaseProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
