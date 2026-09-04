export type Role = 'Admin' | 'Editor' | 'Viewer';

export type FieldType =
  | 'Text'
  | 'Number'
  | 'Email'
  | 'Phone'
  | 'Date'
  | 'Boolean'
  | 'Dropdown'
  | 'Checkbox'
  | 'Image Upload'
  | 'File Upload'
  | 'Long Text'
  | 'URL';

export interface FieldSchema {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // for Dropdown
  defaultValue?: any;
  description?: string;
  isPrimary?: boolean; // Main display column
}

export interface Collaborator {
  userId: string;
  email: string;
  name: string;
  avatar?: string;
  role: Role;
  addedAt: string;
  status: 'pending' | 'accepted';
}

export interface ShareLink {
  id: string;
  token: string;
  type?: 'private' | 'readonly' | 'editable';
  role?: Role;
  allowPublicEdit?: boolean;
  password?: string;
  expiresAt?: string; // ISO String or null/empty for 'Never'
  expirationOption?: '24h' | '7d' | '30d' | 'never';
  maxUses?: number;
  currentUses: number;
  createdAt: string;
  active: boolean;
}

export interface DatabaseSchema {
  id: string;
  userId?: string;
  ownerName?: string;
  ownerEmail?: string;
  name: string;
  slug: string;
  description: string;
  category: 'Education' | 'Operations' | 'Human Resources' | 'Sales' | 'Healthcare' | 'Custom' | 'Inventory';
  icon: string;
  color: string;
  fields: FieldSchema[];
  collaborators?: Collaborator[];
  shareLinks?: ShareLink[];
  createdAt: string;
  updatedAt: string;
  recordCount?: number;
  isArchived?: boolean;
  isSharedWithMe?: boolean;
  myRole?: Role;
  isFavorite?: boolean;
  favoriteUserIds?: string[];
}

export interface RecordItem {
  id: string;
  userId?: string;
  databaseId: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  department?: string;
  themePreference?: 'light' | 'dark' | 'system';
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'share' | 'invite' | 'import' | 'export' | 'ai' | 'system';
  isRead: boolean;
  createdAt: string;
  link?: string;
  databaseId?: string;
}

export interface SystemLog {
  id: string;
  userId?: string;
  timestamp: string;
  action: string;
  user: string;
  type: 'info' | 'success' | 'warning' | 'error';
  details: string;
  category?: string;
}

export interface AIChartConfig {
  chartType: 'pie' | 'bar' | 'line' | 'area';
  categoryField: string;
  valueField: string;
  aggregation?: 'count' | 'avg' | 'sum' | 'min' | 'max';
  title?: string;
  description?: string;
  xAxisField?: string;
  yAxisField?: string;
}

export interface AIQueryResponse {
  answer: string;
  suggestedFilter?: Record<string, any>;
  highlightedRecordIds?: string[];
  insights?: string[];
  suggestedActions?: string[];
  queryType?: 'filter' | 'summary' | 'insight' | 'anomaly' | 'report' | 'chart';
  chartConfig?: AIChartConfig;
  targetDatabaseId?: string;
}

export interface FieldMissingCount {
  field: string;
  label: string;
  missingCount: number;
}

export interface CategoryDistributionItem {
  field: string;
  label: string;
  topValue: string;
  count: number;
  percentage: number;
}

export interface NumericExtremeItem {
  field: string;
  label: string;
  recordName: string;
  recordId: string;
  value: number;
}

export interface NumericAverageItem {
  field: string;
  label: string;
  avg: number;
  sum: number;
  min: number;
  max: number;
  count: number;
}

export interface DatabaseInsightsData {
  databaseId: string;
  databaseName: string;
  totalRecords: number;
  missingValues: {
    totalMissing: number;
    fields: FieldMissingCount[];
  };
  duplicates: {
    count: number;
    details: string[];
    duplicateIds: string[];
  };
  mostCommonCategories: CategoryDistributionItem[];
  highestValues: NumericExtremeItem[];
  lowestValues: NumericExtremeItem[];
  numericAverages: NumericAverageItem[];
  insights: string[];
  recommendations: string[];
  analyzedAt: string;
  isAiGenerated?: boolean;
}

export type DataCleaningIssueType =
  | 'duplicate'
  | 'missing_value'
  | 'invalid_email'
  | 'invalid_phone'
  | 'invalid_date'
  | 'extra_spaces'
  | 'mixed_casing';

export interface DataCleaningFixItem {
  id: string;
  recordId: string;
  recordName: string;
  fieldName: string;
  fieldLabel: string;
  issueType: DataCleaningIssueType;
  issueDescription: string;
  currentValue: any;
  suggestedValue: any;
  action: 'update_field' | 'delete_duplicate' | 'fill_missing';
  approved: boolean;
  severity: 'high' | 'medium' | 'low';
}

export interface DataCleaningResult {
  databaseId: string;
  databaseName: string;
  totalRecordsAnalyzed: number;
  totalIssuesFound: number;
  fixes: DataCleaningFixItem[];
  summary: {
    duplicates: number;
    missingValues: number;
    invalidEmails: number;
    invalidPhones: number;
    invalidDates: number;
    extraSpaces: number;
    mixedCasing: number;
  };
  aiAssessment: string;
}

export interface AIReportMetric {
  fieldName: string;
  fieldLabel: string;
  type: string;
  count: number;
  average?: number;
  min?: number;
  max?: number;
  sum?: number;
  topCategory?: string;
  topCategoryPercent?: string;
  distribution?: Array<{ label: string; count: number; percentage: number }>;
}

export interface AIReportTrend {
  title: string;
  description: string;
  impact: 'positive' | 'neutral' | 'negative' | 'critical';
  metricContext?: string;
}

export interface AIReportRecommendation {
  title: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  expectedOutcome: string;
}

export interface AIReportPotentialIssue {
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  suggestedRemedy: string;
}

export interface AIReportData {
  databaseId: string;
  databaseName: string;
  category: string;
  generatedAt: string;
  totalRecords: number;
  activeRecords: number;
  archivedRecords: number;
  totalFields: number;
  executiveSummary: string;
  statistics: {
    totalRecords: number;
    activeRecords: number;
    archivedRecords: number;
    completenessRate: string;
    metrics: AIReportMetric[];
    insightsSummary?: string;
  };
  keyTrends: AIReportTrend[];
  recommendations: AIReportRecommendation[];
  potentialIssues: AIReportPotentialIssue[];
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}


