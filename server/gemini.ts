import { GoogleGenAI } from '@google/genai';
import { dbStore } from './dbStore.js';
import { AIQueryResponse, AIChartConfig, DatabaseSchema, RecordItem, AIReportData } from '../src/types.js';

let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export interface GeminiCallParams {
  contents: any;
  systemInstruction?: string;
  responseMimeType?: string;
  temperature?: number;
  responseSchema?: any;
}

/**
 * Resilient Gemini caller that retries transient 503 high-demand / 429 rate limit errors
 * and gracefully cascades through fallback models ('gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest').
 */
export async function generateContentWithRetryAndFallback(
  ai: GoogleGenAI,
  params: GeminiCallParams,
  preferredModel: string = 'gemini-3.7-flash'
): Promise<{ text: string; modelUsed: string } | null> {
  const candidateModels = Array.from(
    new Set([preferredModel, 'gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'])
  );

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const config: any = {};
        if (params.systemInstruction) config.systemInstruction = params.systemInstruction;
        if (params.responseMimeType) config.responseMimeType = params.responseMimeType;
        if (params.temperature !== undefined) config.temperature = params.temperature;
        if (params.responseSchema) config.responseSchema = params.responseSchema;

        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: Object.keys(config).length > 0 ? config : undefined,
        });

        const text = response?.text?.trim();
        if (text) {
          return { text, modelUsed: model };
        }
      } catch (err: any) {
        const isTemporarySpike =
          err?.status === 503 ||
          err?.status === 'UNAVAILABLE' ||
          err?.code === 503 ||
          err?.message?.includes('503') ||
          err?.message?.includes('high demand') ||
          err?.message?.includes('UNAVAILABLE') ||
          err?.message?.includes('429') ||
          err?.message?.includes('RESOURCE_EXHAUSTED');

        if (isTemporarySpike && attempt === 1) {
          // Brief jitter backoff before retrying
          await new Promise((resolve) => setTimeout(resolve, 400));
          continue;
        }

        console.warn(
          `[Gemini Resilient Engine] Model "${model}" ${
            isTemporarySpike ? 'is experiencing temporary demand spike (503/429/UNAVAILABLE)' : `encountered: ${err?.message || 'Error'}`
          }. Cascading to fallback...`
        );
        break; // Move to next candidate model
      }
    }
  }

  return null;
}

interface DetectedField {
  name: string;
  label: string;
  type: string;
  options?: string[];
  sampleValues: any[];
}

interface DatabaseStats {
  totalRecords: number;
  fields: DetectedField[];
  numericStats: Record<
    string,
    {
      count: number;
      sum: number;
      avg: number;
      min: number;
      max: number;
      topRecords: { id: string; name: string; value: number }[];
      bottomRecords: { id: string; name: string; value: number }[];
    }
  >;
  categoricalStats: Record<
    string,
    {
      uniqueValuesCount: number;
      distribution: Record<string, number>;
    }
  >;
  duplicates: {
    count: number;
    duplicateRecordIds: string[];
    details: string[];
  };
}

// Extract all known field definitions and dynamically detected fields from records
function extractFields(targetDb: DatabaseSchema | undefined, records: RecordItem[]): DetectedField[] {
  const fieldMap = new Map<string, DetectedField>();

  // 1. Add fields defined in database schema
  if (targetDb?.fields) {
    for (const f of targetDb.fields) {
      fieldMap.set(f.name.toLowerCase(), {
        name: f.name,
        label: f.label || f.name,
        type: f.type || 'Text',
        options: f.options,
        sampleValues: [],
      });
    }
  }

  // 2. Dynamically scan all keys in records' data
  for (const r of records) {
    if (!r.data) continue;
    for (const [key, val] of Object.entries(r.data)) {
      const keyLower = key.toLowerCase();
      if (!fieldMap.has(keyLower)) {
        let inferredType = 'Text';
        if (typeof val === 'number') inferredType = 'Number';
        else if (typeof val === 'boolean') inferredType = 'Boolean';
        else if (typeof val === 'string' && !isNaN(Date.parse(val)) && (val.includes('-') || val.includes('/'))) inferredType = 'Date';

        const label = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/[_-]/g, ' ')
          .trim()
          .replace(/^./, (str) => str.toUpperCase());

        fieldMap.set(keyLower, {
          name: key,
          label,
          type: inferredType,
          sampleValues: [],
        });
      }

      if (val !== undefined && val !== null && val !== '') {
        const item = fieldMap.get(keyLower)!;
        if (item.sampleValues.length < 5 && !item.sampleValues.includes(val)) {
          item.sampleValues.push(val);
        }
      }
    }
  }

  return Array.from(fieldMap.values());
}

// Compute comprehensive statistics across all real database records
function computeStats(targetDb: DatabaseSchema | undefined, records: RecordItem[]): DatabaseStats {
  const fields = extractFields(targetDb, records);
  const numericStats: DatabaseStats['numericStats'] = {};
  const categoricalStats: DatabaseStats['categoricalStats'] = {};

  for (const field of fields) {
    const rawValues = records
      .map((r) => ({ id: r.id, val: r.data?.[field.name], name: getRecordDisplayName(r) }))
      .filter((item) => item.val !== undefined && item.val !== null && item.val !== '');

    // Check if values are mostly numeric
    const numericItems = rawValues
      .map((item) => ({ id: item.id, num: Number(item.val), name: item.name }))
      .filter((item) => !isNaN(item.num) && typeof item.num === 'number');

    if (numericItems.length > 0 && (field.type === 'Number' || numericItems.length >= rawValues.length * 0.7)) {
      const nums = numericItems.map((i) => i.num);
      const sum = nums.reduce((a, b) => a + b, 0);
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const avg = Number((sum / nums.length).toFixed(2));

      const sortedDesc = [...numericItems].sort((a, b) => b.num - a.num);
      const sortedAsc = [...numericItems].sort((a, b) => a.num - b.num);

      numericStats[field.name] = {
        count: nums.length,
        sum: Number(sum.toFixed(2)),
        avg,
        min,
        max,
        topRecords: sortedDesc.slice(0, 5).map((i) => ({ id: i.id, name: i.name, value: i.num })),
        bottomRecords: sortedAsc.slice(0, 5).map((i) => ({ id: i.id, name: i.name, value: i.num })),
      };
    }

    // Categorical frequency distribution
    const dist: Record<string, number> = {};
    for (const item of rawValues) {
      const str = String(item.val).trim();
      dist[str] = (dist[str] || 0) + 1;
    }

    categoricalStats[field.name] = {
      uniqueValuesCount: Object.keys(dist).length,
      distribution: dist,
    };
  }

  // Duplicate records detection
  const seenIdent = new Map<string, string>();
  const duplicateIds: string[] = [];
  const duplicateDetails: string[] = [];

  for (const r of records) {
    // Primary unique keys
    const ident =
      r.data?.regNumber ||
      r.data?.email ||
      r.data?.sku ||
      r.data?.patientId ||
      r.data?.studentId ||
      r.data?.employeeId ||
      r.data?.id;

    if (ident) {
      const key = `${ident}`.toLowerCase().trim();
      if (seenIdent.has(key)) {
        duplicateIds.push(r.id);
        duplicateDetails.push(`Duplicate identifier "${ident}" in record "${getRecordDisplayName(r)}"`);
      } else {
        seenIdent.set(key, r.id);
      }
    }
  }

  return {
    totalRecords: records.length,
    fields,
    numericStats,
    categoricalStats,
    duplicates: {
      count: duplicateIds.length,
      duplicateRecordIds: duplicateIds,
      details: duplicateDetails,
    },
  };
}

function getRecordDisplayName(record: RecordItem): string {
  if (!record.data) return 'Record ' + record.id.slice(-4);
  return (
    record.data.studentName ||
    record.data.fullName ||
    record.data.name ||
    record.data.productName ||
    record.data.patientName ||
    record.data.itemTitle ||
    record.data.title ||
    record.data.email ||
    'Record ' + record.id.slice(-4)
  );
}

// Find if a field is requested in prompt and check if it exists in the database
function checkFieldExistence(
  prompt: string,
  fields: DetectedField[],
  records: RecordItem[]
): { requestedField: string | null; exists: boolean; matchedField?: DetectedField } {
  const pLower = prompt.toLowerCase();

  // Known target field keywords to check
  const commonConcepts: { concept: string; aliases: string[] }[] = [
    { concept: 'age', aliases: ['age', 'years old', 'aged'] },
    { concept: 'salary', aliases: ['salary', 'salaries', 'pay', 'paid', 'earner', 'earning', 'compensation', 'wage', 'wages', 'deal value'] },
    { concept: 'price', aliases: ['price', 'prices', 'pricing', 'unit price', 'cost', 'costs', 'priced', 'rate'] },
    { concept: 'attendance', aliases: ['attendance', 'present', 'presence', 'attended'] },
    { concept: 'cgpa', aliases: ['cgpa', 'gpa', 'grade', 'marks', 'score', 'scores'] },
    { concept: 'blood group', aliases: ['blood group', 'bloodgroup', 'blood_group', 'blood type', 'bloodtype', 'blood'] },
    { concept: 'department', aliases: ['department', 'dept', 'branch', 'major', 'faculty'] },
    { concept: 'colombo', aliases: ['colombo', 'city', 'location', 'address', 'country', 'place'] },
    { concept: 'quantity', aliases: ['quantity', 'stock', 'qty', 'inventory', 'units'] },
    { concept: 'triage status', aliases: ['triage', 'triage status', 'urgency', 'severity'] },
    { concept: 'doctor', aliases: ['doctor', 'physician', 'attending doctor'] },
    { concept: 'gender', aliases: ['gender', 'sex'] },
    { concept: 'phone', aliases: ['phone', 'contact', 'mobile', 'telephone'] },
    { concept: 'email', aliases: ['email', 'email address', 'mail'] },
  ];

  for (const item of commonConcepts) {
    const isAsked = item.aliases.some((alias) => {
      const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(pLower);
    });

    if (isAsked) {
      // Check if any field or record property matches this concept
      const matched = fields.find((f) => {
        const fNameLower = f.name.toLowerCase();
        const fLabelLower = f.label.toLowerCase();
        return item.aliases.some((alias) => fNameLower.includes(alias) || fLabelLower.includes(alias));
      });

      // Also check if any record contains a matching key
      const keyInRecords = records.some((r) =>
        r.data &&
        Object.keys(r.data).some((k) =>
          item.aliases.some((alias) => k.toLowerCase().includes(alias))
        )
      );

      if (matched || keyInRecords) {
        return { requestedField: item.concept, exists: true, matchedField: matched };
      } else {
        // The user specifically asked for this field, but it doesn't exist in the database!
        return { requestedField: item.concept, exists: false };
      }
    }
  }

  return { requestedField: null, exists: true };
}

// Deterministic chart query detection and configuration generator
function detectChartQuery(
  prompt: string,
  targetDb: DatabaseSchema | undefined,
  records: RecordItem[],
  stats: DatabaseStats
): AIQueryResponse | null {
  const pLower = prompt.toLowerCase();

  const chartKeywords = [
    'chart',
    'pie chart',
    'bar chart',
    'line chart',
    'area chart',
    'donut chart',
    'donut',
    'graph',
    'plot',
    'histogram',
    'trend chart',
    'visualize',
    'visualization',
  ];

  const hasChartKeyword = chartKeywords.some((kw) => pLower.includes(kw));
  const hasActionPhrase =
    pLower.startsWith('show a ') ||
    pLower.startsWith('create a ') ||
    pLower.startsWith('generate a ') ||
    pLower.startsWith('display a ') ||
    pLower.startsWith('draw a ') ||
    pLower.startsWith('plot a ') ||
    pLower.startsWith('make a ') ||
    pLower.startsWith('build a ');

  if (!hasChartKeyword && !(hasActionPhrase && (pLower.includes('pie') || pLower.includes('bar') || pLower.includes('line') || pLower.includes('trend')))) {
    return null;
  }

  // Determine chart type
  let chartType: 'pie' | 'bar' | 'line' | 'area' = 'bar';
  if (
    pLower.includes('pie') ||
    pLower.includes('donut') ||
    pLower.includes('proportion') ||
    pLower.includes('share of') ||
    pLower.includes('share by')
  ) {
    chartType = 'pie';
  } else if (
    pLower.includes('line') ||
    pLower.includes('monthly') ||
    pLower.includes('timeline') ||
    pLower.includes('over time') ||
    (pLower.includes('trend') && !pLower.includes('bar'))
  ) {
    chartType = 'line';
  } else if (pLower.includes('area')) {
    chartType = 'area';
  } else if (pLower.includes('bar') || pLower.includes('column') || pLower.includes('histogram')) {
    chartType = 'bar';
  }

  const dbName = targetDb ? targetDb.name : 'Selected Database';
  const fields = stats.fields;
  const numericFieldNames = Object.keys(stats.numericStats);

  // Field detection algorithms:
  let categoryField = '';
  let valueField = '__count__';
  let aggregation: 'count' | 'avg' | 'sum' | 'min' | 'max' = 'count';

  // 1. Department field match
  const deptField = fields.find(
    (f) =>
      f.name.toLowerCase().includes('dept') ||
      f.name.toLowerCase().includes('department') ||
      f.label.toLowerCase().includes('department') ||
      f.label.toLowerCase().includes('dept')
  );

  // 2. Attendance field match
  const attField = fields.find(
    (f) =>
      f.name.toLowerCase().includes('attendance') ||
      f.label.toLowerCase().includes('attendance') ||
      f.name.toLowerCase().includes('presence')
  );

  // 3. Sales / Revenue / Deal / Price / Amount match
  const salesField = fields.find(
    (f) =>
      f.name.toLowerCase().includes('sales') ||
      f.name.toLowerCase().includes('revenue') ||
      f.name.toLowerCase().includes('dealvalue') ||
      f.name.toLowerCase().includes('deal') ||
      f.name.toLowerCase().includes('amount') ||
      f.name.toLowerCase().includes('price') ||
      f.label.toLowerCase().includes('sales') ||
      f.label.toLowerCase().includes('revenue') ||
      f.label.toLowerCase().includes('deal') ||
      f.label.toLowerCase().includes('price')
  );

  // 4. Salary match
  const salField = fields.find(
    (f) =>
      f.name.toLowerCase().includes('salary') ||
      f.label.toLowerCase().includes('salary') ||
      f.name.toLowerCase().includes('pay') ||
      f.name.toLowerCase().includes('wage')
  );

  // 5. Date / Month match
  const dateField = fields.find(
    (f) =>
      f.type === 'Date' ||
      f.name.toLowerCase().includes('month') ||
      f.name.toLowerCase().includes('date') ||
      f.label.toLowerCase().includes('month') ||
      f.label.toLowerCase().includes('date')
  );

  // 6. Generic Category / Status / Role / City match
  const catField = fields.find(
    (f) =>
      f.name.toLowerCase().includes('category') ||
      f.label.toLowerCase().includes('category') ||
      f.name.toLowerCase().includes('status') ||
      f.label.toLowerCase().includes('status') ||
      f.name.toLowerCase().includes('role') ||
      f.label.toLowerCase().includes('role')
  );

  // 7. Student Name or Primary Title
  const nameField = fields.find(
    (f) =>
      f.name.toLowerCase().includes('studentname') ||
      f.name.toLowerCase().includes('fullname') ||
      f.name.toLowerCase().includes('name') ||
      f.label.toLowerCase().includes('student') ||
      f.label.toLowerCase().includes('name')
  );

  // Match Department query (e.g. "pie chart of students by department", "bar chart by department")
  if (pLower.includes('department') || pLower.includes('dept')) {
    if (deptField) {
      categoryField = deptField.name;
    }
  }

  // Match Attendance query (e.g. "bar chart of attendance", "attendance chart")
  if (pLower.includes('attendance') || pLower.includes('attended') || pLower.includes('presence')) {
    if (attField) {
      valueField = attField.name;
      aggregation = 'avg';
      if (!categoryField) {
        if (deptField) categoryField = deptField.name;
        else if (catField) categoryField = catField.name;
        else if (nameField) categoryField = nameField.name;
      }
    }
  }

  // Match Sales query (e.g. "line chart of monthly sales", "sales chart")
  if (
    pLower.includes('sales') ||
    pLower.includes('monthly') ||
    pLower.includes('revenue') ||
    pLower.includes('deal') ||
    pLower.includes('orders')
  ) {
    if (salesField) {
      valueField = salesField.name;
      aggregation = 'sum';
      if (dateField) {
        categoryField = dateField.name;
      } else if (catField) {
        categoryField = catField.name;
      }
    }
  }

  // Match Salary query (e.g. "chart of salary", "salaries by department")
  if (pLower.includes('salary') || pLower.includes('salaries') || pLower.includes('pay')) {
    if (salField) {
      valueField = salField.name;
      aggregation = 'avg';
      if (!categoryField && deptField) categoryField = deptField.name;
    }
  }

  // If no category matched yet, scan all fields against the prompt
  if (!categoryField) {
    for (const f of fields) {
      if (pLower.includes(f.name.toLowerCase()) || pLower.includes(f.label.toLowerCase())) {
        if (numericFieldNames.includes(f.name)) {
          valueField = f.name;
          aggregation = chartType === 'pie' ? 'sum' : 'avg';
        } else {
          categoryField = f.name;
        }
      }
    }
  }

  // Fallback category field if still empty
  if (!categoryField) {
    const defaultCat =
      deptField ||
      catField ||
      fields.find(
        (f) =>
          f.type === 'Dropdown' ||
          (!numericFieldNames.includes(f.name) && f.name !== 'id' && f.name !== 'userId')
      );
    categoryField = defaultCat ? defaultCat.name : fields[0]?.name || '';
  }

  if (valueField === '__count__') {
    aggregation = 'count';
  }

  const catObj = fields.find((f) => f.name === categoryField);
  const catLabel = catObj?.label || categoryField || 'Category';
  const valObj = fields.find((f) => f.name === valueField);
  const valLabel = valueField === '__count__' ? 'Record Count' : valObj?.label || valueField;

  let title = '';
  let description = '';

  if (chartType === 'pie') {
    title =
      valueField === '__count__'
        ? `${targetDb?.name || 'Dataset'} by ${catLabel}`
        : `${valLabel} Share by ${catLabel}`;
    description = `Pie chart displaying proportional breakdown of ${
      valueField === '__count__' ? 'records' : valLabel.toLowerCase()
    } grouped by ${catLabel}.`;
  } else if (chartType === 'bar') {
    title =
      valueField === '__count__'
        ? `Distribution across ${catLabel}`
        : `${aggregation.toUpperCase()} ${valLabel} by ${catLabel}`;
    description = `Bar chart comparing ${
      valueField === '__count__' ? 'record counts' : `${aggregation} ${valLabel.toLowerCase()}`
    } across ${catLabel}.`;
  } else {
    title = valueField === '__count__' ? `Record Timeline Trend` : `${valLabel} Trend Analysis`;
    description = `Line chart visualizing dynamic trend of ${valLabel.toLowerCase()} across records.`;
  }

  // Compute live breakdown for synthesis answer
  const groups: Record<string, { count: number; nums: number[] }> = {};
  for (const r of records) {
    const rawCat = r.data?.[categoryField];
    const catName =
      rawCat !== undefined && rawCat !== null && String(rawCat).trim() !== ''
        ? String(rawCat).trim()
        : 'Unassigned';
    if (!groups[catName]) groups[catName] = { count: 0, nums: [] };
    groups[catName].count++;
    if (valueField !== '__count__' && r.data?.[valueField] !== undefined) {
      const n = Number(r.data[valueField]);
      if (!isNaN(n)) groups[catName].nums.push(n);
    }
  }

  const breakdownLines = Object.entries(groups).map(([name, g]) => {
    if (valueField === '__count__' || aggregation === 'count') {
      const pct = records.length ? Math.round((g.count / records.length) * 100) : 0;
      return `• **${name}**: **${g.count}** record${g.count === 1 ? '' : 's'} (${pct}%)`;
    } else {
      const sum = g.nums.reduce((a, b) => a + b, 0);
      const avg = g.nums.length ? (sum / g.nums.length).toFixed(1) : '0';
      let metric = avg;
      const aggType: string = aggregation;
      if (aggType === 'sum') {
        metric = sum.toLocaleString();
      } else if (aggType === 'max' && g.nums.length > 0) {
        metric = Math.max(...g.nums).toLocaleString();
      } else if (aggType === 'min' && g.nums.length > 0) {
        metric = Math.min(...g.nums).toLocaleString();
      }
      return `• **${name}**: ${aggregation.toUpperCase()} ${valLabel} = **${metric}** (${g.count} records)`;
    }
  });

  const chartConfig: AIChartConfig = {
    chartType,
    categoryField,
    valueField,
    aggregation,
    title,
    description,
    xAxisField: chartType === 'line' || chartType === 'area' ? categoryField : undefined,
    yAxisField: chartType === 'line' || chartType === 'area' ? valueField : undefined,
  };

  const chartTypeCapitalized = chartType.charAt(0).toUpperCase() + chartType.slice(1);

  return {
    answer: `### Generated ${chartTypeCapitalized} Chart: **${title}**\n\nI have generated a **${chartType} chart** targeting **${catLabel}** ${
      valueField !== '__count__'
        ? `and measuring **${valLabel}** (${aggregation.toUpperCase()})`
        : 'proportional distribution'
    } for **${dbName}**.\n\n**Data Breakdown:**\n${
      breakdownLines.slice(0, 8).join('\n') || 'No record groups found.'
    }\n\n*This chart is ready to be displayed directly inside the **Analytics page**.*`,
    highlightedRecordIds: records.slice(0, 15).map((r) => r.id),
    insights: [
      `Generated ${chartType} chart visualization configured from ${records.length} live records.`,
      `Grouped by "${catLabel}" across ${Object.keys(groups).length} distinct segment${
        Object.keys(groups).length === 1 ? '' : 's'
      }.`,
    ],
    suggestedActions: [
      `Click "Display inside Analytics Page" to view live chart and interactions.`,
      `Customize aggregation measures and metrics inside the Analytics Dashboard.`,
    ],
    queryType: 'chart',
    chartConfig,
    targetDatabaseId: targetDb?.id,
  };
}

// Deterministic query processing grounded 100% in real data
function executeDeterministicQuery(
  prompt: string,
  targetDb: DatabaseSchema | undefined,
  records: RecordItem[],
  stats: DatabaseStats
): AIQueryResponse {
  const pLower = prompt.toLowerCase();
  const dbName = targetDb ? targetDb.name : 'Selected Database';

  // 1. Check Field Non-Existence (Requirement 6)
  const fieldCheck = checkFieldExistence(prompt, stats.fields, records);
  if (!fieldCheck.exists && fieldCheck.requestedField) {
    const availableFieldList = stats.fields.map((f) => `**${f.label || f.name}** (${f.type})`).join(', ');
    return {
      answer: `I couldn't find that field in the selected database.\n\nAvailable fields in **${dbName}** are:\n${availableFieldList || 'None found.'}`,
      highlightedRecordIds: [],
      insights: [
        `The requested field "${fieldCheck.requestedField}" is not part of the "${dbName}" schema.`,
        `You can query any of the ${stats.fields.length} available fields: ${stats.fields.map((f) => f.label).join(', ')}.`,
      ],
      suggestedActions: [
        `Add a new "${fieldCheck.requestedField.toUpperCase()}" field via the Database Schema Editor.`,
        `Ask a question regarding existing fields: ${stats.fields.slice(0, 3).map((f) => f.label).join(', ')}.`,
      ],
      queryType: 'insight',
    };
  }

  // 2. Natural Language Chart Generation Query
  const chartQueryResult = detectChartQuery(prompt, targetDb, records, stats);
  if (chartQueryResult) {
    return chartQueryResult;
  }

  // 3. Duplicate Records Query
  if (pLower.includes('duplicate') || pLower.includes('copies') || pLower.includes('redundant')) {
    const dupCount = stats.duplicates.count;
    if (dupCount > 0) {
      return {
        answer: `Found **${dupCount} duplicate record${dupCount > 1 ? 's' : ''}** in **${dbName}** based on unique identifiers:\n\n${stats.duplicates.details.map((d) => `• ${d}`).join('\n')}`,
        highlightedRecordIds: stats.duplicates.duplicateRecordIds,
        insights: [
          `${dupCount} duplicate entries detected out of ${records.length} total records.`,
          `Database integrity requires deduplication of primary keys.`,
        ],
        suggestedActions: [
          `Select and remove duplicate records from the live table.`,
          `Enforce unique field constraints on import.`,
        ],
        queryType: 'anomaly',
      };
    } else {
      return {
        answer: `No duplicate records detected across unique identifiers in **${dbName}**. Database hygiene score is **100%** (All ${records.length} records are unique).`,
        highlightedRecordIds: [],
        insights: [
          `Total of ${records.length} verified unique records.`,
          `Zero primary key collisions or redundant entries.`,
        ],
        suggestedActions: [
          `Export clean dataset for reporting.`,
          `Continue monitoring incoming records for uniqueness.`,
        ],
        queryType: 'anomaly',
      };
    }
  }

  // 3. Count by Age (e.g. "How many people have age 20?", "people aged 20")
  if (pLower.includes('age') || pLower.includes('aged')) {
    const ageMatch = pLower.match(/\b\d+\b/);
    const targetAge = ageMatch ? parseInt(ageMatch[0], 10) : null;
    
    // Find age field
    const ageField = stats.fields.find((f) => f.name.toLowerCase() === 'age' || f.label.toLowerCase() === 'age');
    if (ageField) {
      if (targetAge !== null) {
        const matching = records.filter((r) => Number(r.data?.[ageField.name]) === targetAge);
        const names = matching.map((r) => `**${getRecordDisplayName(r)}** (Age: ${r.data[ageField.name]})`).join(', ');
        return {
          answer: `There ${matching.length === 1 ? 'is' : 'are'} **${matching.length} record${matching.length === 1 ? '' : 's'}** with age **${targetAge}** in **${dbName}**:\n\n${names || 'No matching records found.'}`,
          highlightedRecordIds: matching.map((m) => m.id),
          insights: [
            `${matching.length} out of ${records.length} total records (${records.length ? Math.round((matching.length / records.length) * 100) : 0}%) have age ${targetAge}.`,
            stats.numericStats[ageField.name]
              ? `Overall average age across database is ${stats.numericStats[ageField.name].avg} years.`
              : 'Age distribution calculated from live records.',
          ],
          suggestedActions: [
            `Click 'Apply Filter' to view only records with age ${targetAge}.`,
            `Export filtered cohort list.`,
          ],
          queryType: 'filter',
        };
      }
    }
  }

  // 4. Department / CSE query (e.g. "How many students belong to CSE?", "students in CSE", "department CSE")
  const deptMatch = pLower.match(/\b(cse|computer science|ece|electrical|mech|mechanical|civil|it|sales|marketing|hr|finance|engineering|design|management|operations|routine|urgent|critical|discharged)\b/i);
  if (deptMatch) {
    const targetTerm = deptMatch[0].toLowerCase();
    const matching = records.filter((r) => {
      if (!r.data) return false;
      return Object.values(r.data).some((val) => {
        const valStr = String(val).toLowerCase();
        if (targetTerm === 'cse') return valStr.includes('cse') || valStr.includes('computer science');
        if (targetTerm === 'ece') return valStr.includes('ece') || valStr.includes('electrical');
        if (targetTerm === 'mech') return valStr.includes('mech') || valStr.includes('mechanical');
        return valStr.includes(targetTerm);
      });
    });

    const displayTerm = targetTerm.toUpperCase();
    const names = matching.map((r) => `**${getRecordDisplayName(r)}** (${r.data?.department || r.data?.category || r.data?.status || displayTerm})`).join(', ');

    return {
      answer: `There ${matching.length === 1 ? 'is' : 'are'} **${matching.length} record${matching.length === 1 ? '' : 's'}** belonging to **${displayTerm}** in **${dbName}**:\n\n${names || 'No matching records found.'}`,
      highlightedRecordIds: matching.map((m) => m.id),
      insights: [
        `${matching.length} out of ${records.length} records represent the ${displayTerm} segment (${records.length ? Math.round((matching.length / records.length) * 100) : 0}% of total).`,
        `Distribution across categories updated from live database records.`,
      ],
      suggestedActions: [
        `Filter live table to view the ${matching.length} ${displayTerm} records.`,
        `Review performance metrics for ${displayTerm}.`,
      ],
      queryType: 'filter',
    };
  }

  // 5. Blood Group Query (e.g. "Show all people with blood group O+", "blood group A+", etc.)
  const bloodMatch = pLower.match(/\b(o\+|o-|a\+|a-|b\+|b-|ab\+|ab-)\b/i);
  if (bloodMatch || pLower.includes('blood')) {
    const bloodType = bloodMatch ? bloodMatch[0].toUpperCase() : null;
    const bloodField = stats.fields.find((f) => f.name.toLowerCase().includes('blood') || f.label.toLowerCase().includes('blood'));
    
    if (bloodField && bloodType) {
      const matching = records.filter((r) => String(r.data?.[bloodField.name]).toUpperCase().trim() === bloodType);
      const names = matching.map((r) => `**${getRecordDisplayName(r)}** (Blood Group: ${r.data[bloodField.name]})`).join(', ');
      return {
        answer: `Found **${matching.length} record${matching.length === 1 ? '' : 's'}** with blood group **${bloodType}** in **${dbName}**:\n\n${names || 'None found.'}`,
        highlightedRecordIds: matching.map((m) => m.id),
        insights: [
          `${matching.length} donors/patients with ${bloodType} blood group on record.`,
          `Represents ${records.length ? Math.round((matching.length / records.length) * 100) : 0}% of the database cohort.`,
        ],
        suggestedActions: [
          `Filter table to contact ${bloodType} individuals for urgent requests.`,
          `Export emergency blood group registry.`,
        ],
        queryType: 'filter',
      };
    }
  }

  // 6. City / Location Query (e.g. "Count all people from Colombo", "people from Colombo")
  if (pLower.includes('colombo') || pLower.includes('kandy') || pLower.includes('galle') || pLower.includes('london') || pLower.includes('new york') || pLower.includes('tokyo') || pLower.includes('city') || pLower.includes('location')) {
    const cityMatch = pLower.match(/\b(colombo|kandy|galle|jaffna|london|new york|tokyo|paris|sydney|singapore|berlin)\b/i);
    const targetCity = cityMatch ? cityMatch[0] : null;

    if (targetCity) {
      const matching = records.filter((r) => {
        if (!r.data) return false;
        return Object.values(r.data).some((val) => String(val).toLowerCase().includes(targetCity.toLowerCase()));
      });

      const cityName = targetCity.charAt(0).toUpperCase() + targetCity.slice(1);
      const names = matching.map((r) => `**${getRecordDisplayName(r)}**`).join(', ');

      return {
        answer: `There ${matching.length === 1 ? 'is' : 'are'} **${matching.length} record${matching.length === 1 ? '' : 's'}** from **${cityName}** in **${dbName}**:\n\n${names || 'None found.'}`,
        highlightedRecordIds: matching.map((m) => m.id),
        insights: [
          `${matching.length} records located in ${cityName} (${records.length ? Math.round((matching.length / records.length) * 100) : 0}% of dataset).`,
          `Geographic distribution derived from real user records.`,
        ],
        suggestedActions: [
          `Filter table to show all ${cityName} residents/entries.`,
          `Generate location-based regional breakdown.`,
        ],
        queryType: 'filter',
      };
    }
  }

  // 7. Highest / Maximum Salary, Price, GPA, Attendance, Deal Value, Stock
  if (pLower.includes('highest') || pLower.includes('maximum') || pLower.includes('max') || pLower.includes('top paid') || pLower.includes('most expensive')) {
    // Check salary
    if (pLower.includes('salary') || pLower.includes('paid') || pLower.includes('earner') || pLower.includes('compensation') || pLower.includes('employee')) {
      const salField = stats.fields.find((f) => f.name.toLowerCase().includes('salary') || f.name.toLowerCase().includes('dealvalue') || f.label.toLowerCase().includes('salary'));
      if (salField && stats.numericStats[salField.name]) {
        const top = stats.numericStats[salField.name].topRecords[0];
        const topRec = records.find((r) => r.id === top?.id);
        if (top && topRec) {
          const formattedVal = `$${top.value.toLocaleString()}`;
          return {
            answer: `The highest compensation in **${dbName}** is **${getRecordDisplayName(topRec)}** with a salary of **${formattedVal}** (Department: **${topRec.data?.department || 'N/A'}**).`,
            highlightedRecordIds: [top.id],
            insights: [
              `Top salary: ${formattedVal} (Average salary across database: $${stats.numericStats[salField.name].avg.toLocaleString()}).`,
              `Maximum compensation is ${(top.value / (stats.numericStats[salField.name].avg || 1)).toFixed(1)}x the database mean.`,
            ],
            suggestedActions: [
              `Review top compensation benchmarks.`,
              `Compare department-level salary distributions.`,
            ],
            queryType: 'insight',
          };
        }
      }
    }

    // Check price
    if (pLower.includes('price') || pLower.includes('cost') || pLower.includes('product') || pLower.includes('expensive')) {
      const priceField = stats.fields.find((f) => f.name.toLowerCase().includes('price') || f.label.toLowerCase().includes('price') || f.name.toLowerCase().includes('cost'));
      if (priceField && stats.numericStats[priceField.name]) {
        const top = stats.numericStats[priceField.name].topRecords[0];
        const topRec = records.find((r) => r.id === top?.id);
        if (top && topRec) {
          const formattedVal = `$${top.value.toLocaleString()}`;
          return {
            answer: `The product with the highest price in **${dbName}** is **${getRecordDisplayName(topRec)}** (SKU: **${topRec.data?.sku || 'N/A'}**) at **${formattedVal}**.`,
            highlightedRecordIds: [top.id],
            insights: [
              `Top priced product: ${formattedVal} in category "${topRec.data?.category || 'General'}".`,
              `Average product price in database is $${stats.numericStats[priceField.name].avg.toLocaleString()}.`,
            ],
            suggestedActions: [
              `Inspect stock level for highest price item (${topRec.data?.quantityInStock || 0} in stock).`,
              `Check margin and promotional strategy.`,
            ],
            queryType: 'insight',
          };
        }
      }
    }

    // Generic highest numeric field
    for (const [fName, nStat] of Object.entries(stats.numericStats)) {
      if (pLower.includes(fName.toLowerCase())) {
        const top = nStat.topRecords[0];
        const topRec = records.find((r) => r.id === top?.id);
        if (top && topRec) {
          return {
            answer: `The highest **${fName}** in **${dbName}** belongs to **${getRecordDisplayName(topRec)}** with a value of **${top.value}**.`,
            highlightedRecordIds: [top.id],
            insights: [
              `Max ${fName}: ${top.value} | Average: ${nStat.avg} | Min: ${nStat.min}.`,
              `Top record is ${(top.value / (nStat.avg || 1)).toFixed(1)}x the database average.`,
            ],
            suggestedActions: [`Filter table to view top records.`],
            queryType: 'insight',
          };
        }
      }
    }
  }

  // 8. Lowest / Minimum Query
  if (pLower.includes('lowest') || pLower.includes('minimum') || pLower.includes('min') || pLower.includes('cheapest')) {
    for (const [fName, nStat] of Object.entries(stats.numericStats)) {
      if (pLower.includes(fName.toLowerCase()) || pLower.includes('price') || pLower.includes('salary') || pLower.includes('attendance') || pLower.includes('gpa')) {
        const bot = nStat.bottomRecords[0];
        const botRec = records.find((r) => r.id === bot?.id);
        if (bot && botRec) {
          return {
            answer: `The lowest **${fName}** in **${dbName}** is **${getRecordDisplayName(botRec)}** with a value of **${bot.value}**.`,
            highlightedRecordIds: [bot.id],
            insights: [
              `Minimum ${fName}: ${bot.value} (Database Average: ${nStat.avg}).`,
            ],
            suggestedActions: [`Filter table to inspect bottom records.`],
            queryType: 'insight',
          };
        }
      }
    }
  }

  // 9. Attendance Threshold Query (e.g. "attendance below 75%", "attendance < 75")
  if (pLower.includes('attendance') && (pLower.includes('below') || pLower.includes('<') || pLower.includes('under') || pLower.includes('less') || pLower.includes('above') || pLower.includes('>'))) {
    const attField = stats.fields.find((f) => f.name.toLowerCase().includes('attendance') || f.label.toLowerCase().includes('attendance'));
    const isBelow = pLower.includes('below') || pLower.includes('<') || pLower.includes('under') || pLower.includes('less');
    const numMatch = pLower.match(/\d+/);
    const threshold = numMatch ? parseInt(numMatch[0], 10) : 75;

    if (attField) {
      const matching = records.filter((r) => {
        const val = Number(r.data?.[attField.name]);
        return !isNaN(val) && (isBelow ? val < threshold : val >= threshold);
      });

      const names = matching.map((r) => `• **${getRecordDisplayName(r)}** — ${r.data[attField.name]}% attendance (${r.data.department || r.data.email || 'Student'})`).join('\n');

      return {
        answer: `Found **${matching.length} record${matching.length === 1 ? '' : 's'}** with attendance ${isBelow ? 'below' : 'at or above'} **${threshold}%** in **${dbName}**:\n\n${names || 'None found.'}`,
        highlightedRecordIds: matching.map((m) => m.id),
        insights: [
          `${matching.length} out of ${records.length} records (${records.length ? Math.round((matching.length / records.length) * 100) : 0}%) have attendance ${isBelow ? '<' : '>='} ${threshold}%.`,
          stats.numericStats[attField.name]
            ? `Cohort average attendance is ${stats.numericStats[attField.name].avg}%.`
            : `Attendance criteria evaluated directly from active database records.`,
        ],
        suggestedActions: [
          isBelow ? `Schedule counselor outreach for the ${matching.length} flagged students.` : `Acknowledge top attendees.`,
          `Apply filter to view these ${matching.length} records in the live table.`,
        ],
        queryType: 'filter',
      };
    }
  }

  // 10. General Aggregation (Average, Sum, Count, Grouping)
  if (pLower.includes('average') || pLower.includes('mean') || pLower.includes('avg')) {
    const lines: string[] = [];
    for (const [col, stat] of Object.entries(stats.numericStats)) {
      lines.push(`• **Average ${col}**: ${stat.avg.toLocaleString()} (Min: ${stat.min}, Max: ${stat.max})`);
    }
    return {
      answer: `### Computed Averages for **${dbName}** (${records.length} Records)\n\n${lines.join('\n') || 'No numeric columns detected for mathematical average.'}`,
      highlightedRecordIds: records.slice(0, 5).map((r) => r.id),
      insights: [
        `Computed across ${records.length} verified real database records.`,
        `Data distribution verified for all active numeric fields.`,
      ],
      suggestedActions: [`Export comprehensive statistical report.`],
      queryType: 'summary',
    };
  }

  if (pLower.includes('sum') || pLower.includes('total value') || pLower.includes('total salary')) {
    const lines: string[] = [];
    for (const [col, stat] of Object.entries(stats.numericStats)) {
      lines.push(`• **Total Sum of ${col}**: ${stat.sum.toLocaleString()} across ${stat.count} entries`);
    }
    return {
      answer: `### Mathematical Sums for **${dbName}**\n\n${lines.join('\n') || 'No numeric fields to sum.'}`,
      highlightedRecordIds: [],
      insights: [`Sum calculations computed from live records.`],
      suggestedActions: [`Export financial/operational audit summary.`],
      queryType: 'summary',
    };
  }

  // Default Comprehensive Database Summary
  const fieldList = stats.fields.map((f) => `**${f.label}** (${f.type})`).join(', ');
  const statBullets = Object.entries(stats.numericStats)
    .map(([col, s]) => `• **${col}**: Avg ${s.avg}, Min ${s.min}, Max ${s.max}`)
    .join('\n');

  return {
    answer: `### Database Analysis for **${dbName}**\n\n- **Total Active Records**: **${records.length}**\n- **Available Fields**: ${fieldList}\n\n**Numeric Summary:**\n${statBullets || 'No numeric measures in this schema.'}`,
    highlightedRecordIds: records.slice(0, 5).map((r) => r.id),
    insights: [
      `Database "${dbName}" currently contains ${records.length} structured records.`,
      `Zero data corruption detected; schema fields mapped dynamically.`,
    ],
    suggestedActions: [
      `Ask targeted questions (e.g. "attendance below 75%", "highest salary", "count by department").`,
      `Export data to Excel or JSON.`,
    ],
    queryType: 'summary',
  };
}

export async function processAIQuery(
  prompt: string,
  userId: string,
  databaseId?: string
): Promise<AIQueryResponse> {
  const ai = getGenAI();

  // 1. Retrieve all user databases and determine target database
  const userDbs = dbStore.getDatabasesForUser(userId);
  let targetDb: DatabaseSchema | undefined;

  if (databaseId) {
    targetDb = userDbs.find((d) => d.id === databaseId) || dbStore.getDatabaseById(databaseId, userId);
  }

  // If no databaseId is explicitly passed, try to detect if prompt mentions a database by name
  if (!targetDb && userDbs.length > 0) {
    const pLower = prompt.toLowerCase();
    const matched = userDbs.find((d) => pLower.includes(d.name.toLowerCase()) || pLower.includes(d.category.toLowerCase()));
    targetDb = matched || userDbs[0];
  }

  // 2. Retrieve actual database records for the user from MongoDB / dbStore
  const records = dbStore.getRecordsForUser(userId, targetDb?.id, false);

  // 3. Compute detailed real-data statistics, field mapping, and pre-calculated metrics
  const stats = computeStats(targetDb, records);

  // 4. Pre-check for missing field queries (Requirement 6)
  const fieldCheck = checkFieldExistence(prompt, stats.fields, records);
  if (!fieldCheck.exists && fieldCheck.requestedField) {
    const availableFieldList = stats.fields.map((f) => `**${f.label || f.name}** (${f.type})`).join(', ');
    const dbName = targetDb ? targetDb.name : 'Selected Database';
    return {
      answer: `I couldn't find that field in the selected database.\n\nAvailable fields in **${dbName}** are:\n${availableFieldList || 'None found.'}`,
      highlightedRecordIds: [],
      insights: [
        `The requested field "${fieldCheck.requestedField}" does not exist in the "${dbName}" schema.`,
        `Available fields: ${stats.fields.map((f) => f.label).join(', ')}.`,
      ],
      suggestedActions: [
        `Add a new field for "${fieldCheck.requestedField}" in Database Schema Settings.`,
        `Ask questions using the existing fields: ${stats.fields.slice(0, 3).map((f) => f.label).join(', ')}.`,
      ],
      queryType: 'insight',
    };
  }

  // 5. Pre-execute deterministic analysis for ground-truth reference
  const deterministicResult = executeDeterministicQuery(prompt, targetDb, records, stats);

  // If no Gemini AI client is available, return the deterministic result
  if (!ai) {
    dbStore.addLog('AI Query Processed', 'Deterministic Engine', 'success', `Query: "${prompt.slice(0, 40)}..."`, userId, 'AI Assistant');
    return deterministicResult;
  }

  // 6. Construct grounded payload for Gemini 3.7 Flash
  try {
    const compactRecordsSample = records.slice(0, 100).map((r) => ({
      id: r.id,
      displayName: getRecordDisplayName(r),
      ...r.data,
    }));

    const groundTruthContext = {
      database: {
        id: targetDb?.id,
        name: targetDb?.name || 'Selected Database',
        category: targetDb?.category || 'Custom',
        totalRecordsCount: records.length,
      },
      availableFields: stats.fields.map((f) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        sampleValues: f.sampleValues,
      })),
      preComputedStatistics: {
        numericMetrics: stats.numericStats,
        categoricalFrequencies: stats.categoricalStats,
        duplicatesFound: stats.duplicates,
      },
      exactRecordsDataset: compactRecordsSample,
    };

    const systemInstruction = `
You are NexusDB AI, an intelligent, precision database assistant directly connected to the user's live database.
You have access to the user's REAL database schema, pre-calculated statistical aggregations, and exact record dataset.

STRICT GROUNDING DIRECTIVES:
1. Base ALL answers strictly and purely on the provided real database records and pre-calculated statistics. Never guess, approximate, or hallucinate records, names, or values.
2. FIELD VALIDATION: If the user asks about an attribute/column/field (such as age, blood group, salary, price, attendance, department, cgpa, etc.) that does NOT exist in the provided 'availableFields' or record data, your 'answer' MUST say:
   "I couldn't find that field in the selected database."
   and list the available fields in this database.
3. For COUNT queries (e.g. "How many people have age 20?", "How many students belong to CSE?", "Count all people from Colombo"):
   State the exact count and list the matching records with their values. Return all matching record IDs in 'highlightedRecordIds'.
4. For MAX/MIN/TOP/BOTTOM queries (e.g. "Which employee has the highest salary?", "Which product has the highest price?"):
   Identify the exact record(s) and their values, and return their IDs in 'highlightedRecordIds'.
5. For FILTER/THRESHOLD queries (e.g. "Which records have attendance below 75%?"):
   Evaluate the exact threshold on real record values, list all matching records, and return all matching record IDs in 'highlightedRecordIds'.
6. For DUPLICATE queries (e.g. "Find duplicate records"):
   Report the exact duplicate records found, or confirm that 0 duplicates exist.
7. For CHART / VISUALIZATION queries (e.g. "Show a pie chart of students by department.", "Create a bar chart of attendance.", "Generate a line chart of monthly sales."):
   - Identify the chart type: "pie" | "bar" | "line" | "area".
   - Identify the correct database category/dimension field (e.g. "department", "category", "status", "role", "city", "date", "month") and metric/value field (e.g. "__count__" for counts, or numeric fields like "attendance", "salary", "sales", "price").
   - Include the "chartConfig" object in your JSON response.
   - Set "queryType": "chart".
8. Return JSON strictly matching this schema:
{
  "answer": "Rich markdown string providing the exact, mathematically accurate answer with bold names and numbers",
  "highlightedRecordIds": ["id1", "id2"],
  "insights": ["Key factual pattern or takeaway 1", "Key factual pattern or takeaway 2"],
  "suggestedActions": ["Actionable recommendation 1", "Actionable recommendation 2"],
  "queryType": "filter" | "summary" | "insight" | "anomaly" | "report" | "chart",
  "chartConfig": {
    "chartType": "pie" | "bar" | "line" | "area",
    "categoryField": "fieldName",
    "valueField": "numericFieldName" | "__count__",
    "aggregation": "count" | "avg" | "sum" | "min" | "max",
    "title": "Descriptive Chart Title",
    "description": "Short explanation of the chart"
  }
}
`;

    const genResult = await generateContentWithRetryAndFallback(ai, {
      contents: `User Question: "${prompt}"\n\nReal Database Ground-Truth Context JSON:\n${JSON.stringify(groundTruthContext, null, 2)}`,
      systemInstruction,
      responseMimeType: 'application/json',
      temperature: 0.1,
    });

    if (genResult && genResult.text) {
      try {
        const parsed = JSON.parse(genResult.text);
        dbStore.addLog('AI Query Processed', genResult.modelUsed, 'success', `Query: "${prompt.slice(0, 40)}..."`, userId, 'AI Assistant');

        // Use AI highlighted record IDs or fallback to deterministic matching if AI returned empty for a filter
        const finalHighlightedIds =
          Array.isArray(parsed.highlightedRecordIds) && parsed.highlightedRecordIds.length > 0
            ? parsed.highlightedRecordIds
            : deterministicResult.highlightedRecordIds;

        const finalChartConfig =
          parsed.chartConfig && parsed.chartConfig.categoryField
            ? parsed.chartConfig
            : deterministicResult.chartConfig;

        return {
          answer: parsed.answer || deterministicResult.answer,
          highlightedRecordIds: finalHighlightedIds,
          insights: Array.isArray(parsed.insights) && parsed.insights.length > 0 ? parsed.insights : deterministicResult.insights,
          suggestedActions: Array.isArray(parsed.suggestedActions) && parsed.suggestedActions.length > 0 ? parsed.suggestedActions : deterministicResult.suggestedActions,
          queryType: parsed.queryType || deterministicResult.queryType,
          chartConfig: finalChartConfig,
          targetDatabaseId: targetDb?.id,
        };
      } catch (jsonErr) {
        console.warn('Could not parse Gemini JSON response, using deterministic result.');
      }
    }
  } catch (error: any) {
    console.warn('Gemini API query caught error, gracefully using deterministic fallback:', error?.message || error);
    dbStore.addLog('AI Query Fallback', 'System', 'info', `Ground-truth engine used: ${error.message}`, userId, 'AI Assistant');
  }

  return deterministicResult;
}

export async function generateDatabaseWithAI(
  prompt: string,
  userId: string
): Promise<{
  name: string;
  description: string;
  category: 'Education' | 'Operations' | 'Human Resources' | 'Sales' | 'Healthcare' | 'Custom' | 'Inventory';
  icon: string;
  color: string;
  fields: any[];
  sampleRecords: any[];
}> {
  const ai = getGenAI();

  if (ai) {
    try {
      const systemInstruction = `
You are an expert database architect AI.
The user wants to generate a complete custom database schema and initial sample dataset based on a natural language prompt.

Respond strictly in JSON matching this schema:
{
  "name": "Database Title (e.g. Student Information Portal)",
  "description": "Short 1-sentence description",
  "category": "Education" | "Operations" | "Human Resources" | "Sales" | "Healthcare" | "Custom" | "Inventory",
  "icon": "Lucide icon name like GraduationCap, Package, Users, Activity, Briefcase, ShoppingCart, Database",
  "color": "blue" | "emerald" | "purple" | "amber" | "rose" | "indigo",
  "fields": [
    {
      "id": "f_1",
      "name": "camelCaseFieldName",
      "label": "User Friendly Label",
      "type": "Text" | "Number" | "Email" | "Phone" | "Date" | "Boolean" | "Dropdown" | "Long Text" | "URL",
      "required": true,
      "options": ["Option 1", "Option 2"]
    }
  ],
  "sampleRecords": [
    {
      "camelCaseFieldName1": "Value 1",
      "camelCaseFieldName2": 100
    }
  ]
}

Ensure you generate 4-7 well-designed fields and 5 realistic sample records matching the schema!
`;

      const genResult = await generateContentWithRetryAndFallback(ai, {
        contents: `Create database structure for prompt: "${prompt}"`,
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.3,
      });

      if (genResult && genResult.text) {
        const parsed = JSON.parse(genResult.text);
        if (parsed.name && Array.isArray(parsed.fields)) {
          return {
            name: parsed.name,
            description: parsed.description || `Generated AI Database for ${parsed.name}`,
            category: parsed.category || 'Custom',
            icon: parsed.icon || 'Database',
            color: parsed.color || 'blue',
            fields: parsed.fields.map((f: any, idx: number) => ({
              id: 'f_' + (idx + 1) + '_' + Date.now(),
              name: f.name || `field_${idx}`,
              label: f.label || f.name || `Field ${idx + 1}`,
              type: f.type || 'Text',
              required: f.required !== false,
              options: f.options || [],
              isPrimary: idx === 0,
            })),
            sampleRecords: Array.isArray(parsed.sampleRecords) ? parsed.sampleRecords : [],
          };
        }
      }
    } catch (err) {
      console.error('Gemini AI database generation error:', err);
    }
  }

  return fallbackGeneratedDatabase(prompt);
}

function fallbackGeneratedDatabase(prompt: string) {
  const pLower = prompt.toLowerCase();

  if (pLower.includes('student') || pLower.includes('school') || pLower.includes('university') || pLower.includes('college')) {
    return {
      name: 'Student Directory & Performance',
      description: 'Comprehensive student management system tracking GPA, attendance, and department enrollment.',
      category: 'Education' as const,
      icon: 'GraduationCap',
      color: 'blue',
      fields: [
        { id: 'f_1', name: 'studentName', label: 'Student Name', type: 'Text', required: true, isPrimary: true },
        { id: 'f_2', name: 'regNumber', label: 'Register Number', type: 'Text', required: true },
        { id: 'f_3', name: 'email', label: 'Email Address', type: 'Email', required: true },
        { id: 'f_4', name: 'department', label: 'Department', type: 'Dropdown', options: ['Computer Science', 'Mechanical Eng', 'Electrical Eng', 'Civil Eng'], required: true },
        { id: 'f_5', name: 'gpa', label: 'Cumulative GPA', type: 'Number', required: true },
        { id: 'f_6', name: 'attendance', label: 'Attendance %', type: 'Number', required: true },
      ],
      sampleRecords: [
        { studentName: 'Alex Rivera', regNumber: 'STU-2026-001', email: 'alex.rivera@university.edu', department: 'Computer Science', gpa: 3.85, attendance: 94 },
        { studentName: 'Sophia Chen', regNumber: 'STU-2026-002', email: 'sophia.chen@university.edu', department: 'Electrical Eng', gpa: 3.92, attendance: 98 },
        { studentName: 'Marcus Vance', regNumber: 'STU-2026-003', email: 'marcus.vance@university.edu', department: 'Mechanical Eng', gpa: 2.74, attendance: 68 },
        { studentName: 'Emily Watson', regNumber: 'STU-2026-004', email: 'emily.watson@university.edu', department: 'Computer Science', gpa: 3.65, attendance: 88 },
        { studentName: 'David Miller', regNumber: 'STU-2026-005', email: 'david.miller@university.edu', department: 'Civil Eng', gpa: 3.12, attendance: 72 },
      ],
    };
  }

  if (pLower.includes('inventory') || pLower.includes('stock') || pLower.includes('product') || pLower.includes('warehouse')) {
    return {
      name: 'Inventory & Stock Control',
      description: 'Real-time product stock tracking, SKU management, unit pricing, and reorder levels.',
      category: 'Inventory' as const,
      icon: 'Package',
      color: 'emerald',
      fields: [
        { id: 'f_1', name: 'productName', label: 'Product Name', type: 'Text', required: true, isPrimary: true },
        { id: 'f_2', name: 'sku', label: 'SKU Code', type: 'Text', required: true },
        { id: 'f_3', name: 'category', label: 'Category', type: 'Dropdown', options: ['Electronics', 'Office Supplies', 'Hardware', 'Accessories'], required: true },
        { id: 'f_4', name: 'unitPrice', label: 'Unit Price ($)', type: 'Number', required: true },
        { id: 'f_5', name: 'quantityInStock', label: 'Quantity in Stock', type: 'Number', required: true },
        { id: 'f_6', name: 'reorderPoint', label: 'Reorder Point', type: 'Number', required: true },
      ],
      sampleRecords: [
        { productName: 'Wireless Ergonomic Mouse', sku: 'SKU-ELEC-101', category: 'Electronics', unitPrice: 49.99, quantityInStock: 142, reorderPoint: 25 },
        { productName: 'UltraWide Curved Monitor 34"', sku: 'SKU-ELEC-204', category: 'Electronics', unitPrice: 499.00, quantityInStock: 18, reorderPoint: 10 },
        { productName: 'Mechanical RGB Keyboard', sku: 'SKU-ELEC-109', category: 'Electronics', unitPrice: 89.50, quantityInStock: 85, reorderPoint: 20 },
        { productName: 'Ergonomic Mesh Chair', sku: 'SKU-FURN-501', category: 'Office Supplies', unitPrice: 220.00, quantityInStock: 7, reorderPoint: 12 },
      ],
    };
  }

  if (pLower.includes('hospital') || pLower.includes('patient') || pLower.includes('medical') || pLower.includes('clinic')) {
    return {
      name: 'Hospital Patient Management',
      description: 'Healthcare tracking portal for patient check-ins, attending physicians, and triage statuses.',
      category: 'Healthcare' as const,
      icon: 'Activity',
      color: 'rose',
      fields: [
        { id: 'f_1', name: 'patientName', label: 'Patient Name', type: 'Text', required: true, isPrimary: true },
        { id: 'f_2', name: 'patientId', label: 'Patient ID', type: 'Text', required: true },
        { id: 'f_3', name: 'triageStatus', label: 'Triage Status', type: 'Dropdown', options: ['Routine', 'Urgent', 'Critical', 'Discharged'], required: true },
        { id: 'f_4', name: 'attendingDoctor', label: 'Attending Physician', type: 'Text', required: true },
        { id: 'f_5', name: 'roomNumber', label: 'Room / Ward', type: 'Text', required: true },
        { id: 'f_6', name: 'admissionDate', label: 'Admission Date', type: 'Date', required: true },
      ],
      sampleRecords: [
        { patientName: 'Eleanor Vance', patientId: 'MED-9021', triageStatus: 'Routine', attendingDoctor: 'Dr. Sarah Jenkins', roomNumber: 'Ward 3B', admissionDate: '2026-08-10' },
        { patientName: 'Robert Johnson', patientId: 'MED-9022', triageStatus: 'Urgent', attendingDoctor: 'Dr. Michael Chang', roomNumber: 'ICU 12', admissionDate: '2026-08-12' },
        { patientName: 'Aria Montgomery', patientId: 'MED-9023', triageStatus: 'Discharged', attendingDoctor: 'Dr. Sarah Jenkins', roomNumber: 'Outpatient', admissionDate: '2026-08-08' },
      ],
    };
  }

  const cleanTitle = prompt.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Custom Operations Data';
  return {
    name: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
    description: `Custom AI-structured database generated for "${prompt}".`,
    category: 'Custom' as const,
    icon: 'Database',
    color: 'purple',
    fields: [
      { id: 'f_1', name: 'itemTitle', label: 'Item Name', type: 'Text', required: true, isPrimary: true },
      { id: 'f_2', name: 'category', label: 'Category', type: 'Dropdown', options: ['Type A', 'Type B', 'Type C'], required: true },
      { id: 'f_3', name: 'status', label: 'Status', type: 'Dropdown', options: ['Active', 'Pending', 'Completed', 'Archived'], required: true },
      { id: 'f_4', name: 'amount', label: 'Value / Amount', type: 'Number', required: false },
      { id: 'f_5', name: 'notes', label: 'Detailed Notes', type: 'Long Text', required: false },
    ],
    sampleRecords: [
      { itemTitle: 'Sample High-Priority Asset', category: 'Type A', status: 'Active', amount: 1250, notes: 'Automatically generated AI sample entry.' },
      { itemTitle: 'Secondary Operations Item', category: 'Type B', status: 'Pending', amount: 840, notes: 'Awaiting team review and approval.' },
      { itemTitle: 'Archived Reference Record', category: 'Type C', status: 'Completed', amount: 3100, notes: 'Completed successfully.' },
    ],
  };
}

// Compute comprehensive structured statistics and metrics for AI Insights
export function computeDatabaseMetrics(targetDb: DatabaseSchema | undefined, records: RecordItem[]) {
  const fields = extractFields(targetDb, records);
  const totalRecords = records.length;

  // 1. Missing Values Analysis
  let totalMissing = 0;
  const missingFieldList: { field: string; label: string; missingCount: number }[] = [];

  for (const f of fields) {
    let missCount = 0;
    for (const r of records) {
      const val = r.data?.[f.name];
      if (val === undefined || val === null || val === '' || (typeof val === 'string' && val.trim() === '')) {
        missCount++;
      }
    }
    if (missCount > 0) {
      totalMissing += missCount;
      missingFieldList.push({
        field: f.name,
        label: f.label,
        missingCount: missCount,
      });
    }
  }

  // 2. Duplicate Detection (check key identifiers and whole-object signatures)
  const seenKeys = new Map<string, string>();
  const duplicateIds: string[] = [];
  const duplicateDetails: string[] = [];

  for (const r of records) {
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
      const normalized = String(ident).toLowerCase().trim();
      if (seenKeys.has(normalized)) {
        if (!duplicateIds.includes(r.id)) duplicateIds.push(r.id);
        duplicateDetails.push(`Duplicate identifier "${ident}" in record "${getRecordDisplayName(r)}"`);
      } else {
        seenKeys.set(normalized, r.id);
      }
    }
  }

  // 3. Most Common Categories
  const mostCommonCategories: { field: string; label: string; topValue: string; count: number; percentage: number }[] = [];
  for (const f of fields) {
    if (f.type === 'Dropdown' || f.type === 'Text') {
      const counts: Record<string, number> = {};
      let totalValid = 0;
      for (const r of records) {
        const val = r.data?.[f.name];
        if (val !== undefined && val !== null && val !== '') {
          const str = String(val).trim();
          counts[str] = (counts[str] || 0) + 1;
          totalValid++;
        }
      }

      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      if (entries.length > 0 && totalValid > 0) {
        const [topVal, count] = entries[0];
        const pct = Math.round((count / totalValid) * 100);
        // Only include if there's meaningful categorization (less than total unique per record)
        if (entries.length <= records.length * 0.8 || f.type === 'Dropdown') {
          mostCommonCategories.push({
            field: f.name,
            label: f.label,
            topValue: topVal,
            count,
            percentage: pct,
          });
        }
      }
    }
  }

  // 4. Numeric Column Extremes & Averages
  const highestValues: { field: string; label: string; recordName: string; recordId: string; value: number }[] = [];
  const lowestValues: { field: string; label: string; recordName: string; recordId: string; value: number }[] = [];
  const numericAverages: { field: string; label: string; avg: number; sum: number; min: number; max: number; count: number }[] = [];

  for (const f of fields) {
    const numericItems: { id: string; name: string; val: number }[] = [];
    for (const r of records) {
      const raw = r.data?.[f.name];
      if (raw !== undefined && raw !== null && raw !== '') {
        const num = Number(raw);
        if (!isNaN(num)) {
          numericItems.push({
            id: r.id,
            name: getRecordDisplayName(r),
            val: num,
          });
        }
      }
    }

    if (numericItems.length > 0 && (f.type === 'Number' || numericItems.length >= records.length * 0.5)) {
      const nums = numericItems.map((i) => i.val);
      const sum = nums.reduce((a, b) => a + b, 0);
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const avg = Number((sum / nums.length).toFixed(2));

      numericAverages.push({
        field: f.name,
        label: f.label,
        avg,
        sum: Number(sum.toFixed(2)),
        min,
        max,
        count: nums.length,
      });

      const maxItem = numericItems.find((i) => i.val === max) || numericItems[0];
      const minItem = numericItems.find((i) => i.val === min) || numericItems[0];

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

  return {
    totalRecords,
    fields,
    missingValues: {
      totalMissing,
      fields: missingFieldList,
    },
    duplicates: {
      count: duplicateIds.length,
      details: duplicateDetails,
      duplicateIds,
    },
    mostCommonCategories,
    highestValues,
    lowestValues,
    numericAverages,
  };
}

// Generate intelligent AI Insights and Recommendations for a database
export async function generateDatabaseInsights(userId: string, databaseId: string) {
  const targetDb = dbStore.getDatabaseById(databaseId, userId);
  const records = dbStore.getRecordsForUser(userId, databaseId, false);
  const metrics = computeDatabaseMetrics(targetDb, records);
  const dbName = targetDb ? targetDb.name : 'Database';

  // Build high quality deterministic fallback insights and recommendations
  const fallbackInsights: string[] = [];
  const fallbackRecommendations: string[] = [];

  // Categorical insights
  if (metrics.mostCommonCategories.length > 0) {
    const topCat = metrics.mostCommonCategories[0];
    fallbackInsights.push(
      `Most records (${topCat.percentage}%) belong to ${topCat.topValue} in ${topCat.label}.`
    );
  }

  // Attendance / Stock / Specific domain checks
  for (const nav of metrics.numericAverages) {
    const nameLower = nav.field.toLowerCase();
    if (nameLower.includes('attendance')) {
      const belowThresh = records.filter((r) => Number(r.data?.[nav.field]) < 75);
      if (belowThresh.length > 0) {
        fallbackInsights.push(
          `Attendance average is ${nav.avg}%. ${belowThresh.length} record(s) currently fall below the 75% minimum threshold.`
        );
      } else {
        fallbackInsights.push(`Overall attendance rate is healthy with a ${nav.avg}% cohort average.`);
      }
    } else if (nameLower.includes('stock') || nameLower.includes('quantity')) {
      const lowStock = records.filter((r) => {
        const stock = Number(r.data?.[nav.field]);
        const reorder = Number(r.data?.reorderPoint || 15);
        return stock <= reorder;
      });
      if (lowStock.length > 0) {
        fallbackInsights.push(
          `Inventory stock is running low for ${lowStock.length} item(s) below reorder threshold.`
        );
      } else {
        fallbackInsights.push(`Inventory stock levels are currently balanced across all catalog items.`);
      }
    } else if (nameLower.includes('cgpa') || nameLower.includes('gpa')) {
      fallbackInsights.push(
        `Academic CGPA averages ${nav.avg} (ranging from ${nav.min} to ${nav.max}).`
      );
    } else if (nameLower.includes('salary') || nameLower.includes('price') || nameLower.includes('amount')) {
      fallbackInsights.push(
        `Average ${nav.label} is $${nav.avg.toLocaleString()} with total cumulative volume of $${nav.sum.toLocaleString()}.`
      );
    }
  }

  // Duplicate records check
  if (metrics.duplicates.count > 0) {
    fallbackInsights.push(
      `Detected ${metrics.duplicates.count} duplicate record identifier(s) in active dataset.`
    );
    fallbackRecommendations.push('Remove duplicate records to prevent data inconsistency.');
  } else {
    fallbackInsights.push('Zero duplicate records detected. Primary identifiers are distinct.');
  }

  // Missing values check
  if (metrics.missingValues.totalMissing > 0) {
    const missFields = metrics.missingValues.fields.map((f) => f.label).slice(0, 3).join(', ');
    fallbackInsights.push(
      `Dataset contains ${metrics.missingValues.totalMissing} missing value(s) across fields (${missFields}).`
    );
    fallbackRecommendations.push(`Complete missing values in [${missFields}] to maintain complete profiles.`);
  } else {
    fallbackInsights.push('Dataset completeness is 100% with no null or missing required fields.');
  }

  // Recommendations
  if (metrics.numericAverages.length > 0) {
    fallbackRecommendations.push('Generate charts for better visualization and trend forecasting.');
  }
  if (metrics.mostCommonCategories.length > 0) {
    fallbackRecommendations.push(`Segment analysis by ${metrics.mostCommonCategories[0].label} to balance distribution.`);
  }
  if (fallbackRecommendations.length === 0) {
    fallbackRecommendations.push('Keep database records updated regularly for real-time AI accuracy.');
  }

  let finalInsights = fallbackInsights;
  let finalRecommendations = fallbackRecommendations;
  let isAiGenerated = false;

  const ai = getGenAI();
  if (ai) {
    try {
      const recordsSample = records.slice(0, 40).map((r) => r.data);
      const promptText = `You are the lead AI Data Analyst for NexusDB. Analyze the following live database records for "${dbName}".

Database Metadata:
- Name: ${dbName}
- Category: ${targetDb?.category || 'Custom'}
- Total Records: ${metrics.totalRecords}
- Missing Values: ${metrics.missingValues.totalMissing} across fields: ${JSON.stringify(metrics.missingValues.fields)}
- Duplicate Count: ${metrics.duplicates.count} details: ${JSON.stringify(metrics.duplicates.details)}
- Most Common Categories: ${JSON.stringify(metrics.mostCommonCategories)}
- Numeric Extremes (Highest & Lowest): ${JSON.stringify({ highest: metrics.highestValues, lowest: metrics.lowestValues })}
- Numeric Averages: ${JSON.stringify(metrics.numericAverages)}

Records Sample (First ${recordsSample.length}):
${JSON.stringify(recordsSample, null, 2)}

Provide your response as a valid JSON object with EXACTLY this structure:
{
  "insights": [
    "Insight 1 (e.g. Most students belong to the CSE department, Attendance has decreased by 12%, Inventory stock is running low, etc.)",
    "Insight 2",
    "Insight 3",
    "Insight 4"
  ],
  "recommendations": [
    "Recommendation 1 (e.g. Remove duplicate records, Complete missing values, Generate charts for better visualization)",
    "Recommendation 2",
    "Recommendation 3"
  ]
}

Instructions:
1. Provide 4 to 6 concise, razor-sharp, realistic data insights derived directly from these numbers and records.
2. Provide 3 to 4 actionable recommendations.
3. Output ONLY the JSON object, with no markdown code fences or conversational text.`;

      const genResult = await generateContentWithRetryAndFallback(ai, {
        contents: promptText,
        responseMimeType: 'application/json',
        temperature: 0.2,
      });

      if (genResult && genResult.text) {
        const cleanJson = genResult.text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (Array.isArray(parsed.insights) && parsed.insights.length > 0) {
          finalInsights = parsed.insights;
          isAiGenerated = true;
        }
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          finalRecommendations = parsed.recommendations;
        }
      }
    } catch (err) {
      console.warn('Gemini AI Insights generation fell back to statistical engine:', err);
    }
  }

  return {
    databaseId,
    databaseName: dbName,
    totalRecords: metrics.totalRecords,
    missingValues: metrics.missingValues,
    duplicates: metrics.duplicates,
    mostCommonCategories: metrics.mostCommonCategories,
    highestValues: metrics.highestValues,
    lowestValues: metrics.lowestValues,
    numericAverages: metrics.numericAverages,
    insights: finalInsights,
    recommendations: finalRecommendations,
    analyzedAt: new Date().toISOString(),
    isAiGenerated,
  };
}

// Helper for Title Case conversion
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => {
      if (['and', 'or', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with'].includes(word) && word.length > 0) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

// Helper to normalize dates to YYYY-MM-DD
function parseAndNormalizeDate(val: string): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();

  // Already standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null; // Already valid
  }

  // Check if timestamp ISO
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  // Check MM/DD/YYYY or M/D/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const m = slashMatch[1].padStart(2, '0');
    const d = slashMatch[2].padStart(2, '0');
    const y = slashMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Check DD-MM-YYYY
  const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const d = dashMatch[1].padStart(2, '0');
    const m = dashMatch[2].padStart(2, '0');
    const y = dashMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Check YYYY/MM/DD
  const ymdSlash = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdSlash) {
    const y = ymdSlash[1];
    const m = ymdSlash[2].padStart(2, '0');
    const d = ymdSlash[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Try Date.parse
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    const dateObj = new Date(parsed);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

// Generate comprehensive AI Data Cleaning Analysis
export async function generateDataCleaningAnalysis(userId: string, databaseId: string) {
  const targetDb = dbStore.getDatabaseById(databaseId, userId);
  const records = dbStore.getRecordsForUser(userId, databaseId, false);
  const dbName = targetDb ? targetDb.name : 'Database';
  const fields = extractFields(targetDb, records);

  const fixes: Array<{
    id: string;
    recordId: string;
    recordName: string;
    fieldName: string;
    fieldLabel: string;
    issueType:
      | 'duplicate'
      | 'missing_value'
      | 'invalid_email'
      | 'invalid_phone'
      | 'invalid_date'
      | 'extra_spaces'
      | 'mixed_casing';
    issueDescription: string;
    currentValue: any;
    suggestedValue: any;
    action: 'update_field' | 'delete_duplicate' | 'fill_missing';
    approved: boolean;
    severity: 'high' | 'medium' | 'low';
  }> = [];

  let duplicateCount = 0;
  let missingCount = 0;
  let invalidEmailCount = 0;
  let invalidPhoneCount = 0;
  let invalidDateCount = 0;
  let extraSpacesCount = 0;
  let mixedCasingCount = 0;

  // 1. Duplicate Records Detection
  const seenKeys = new Map<string, { id: string; name: string }>();
  for (const r of records) {
    if (!r.data) continue;
    const rName = getRecordDisplayName(r);
    const ident =
      r.data.email ||
      r.data.regNumber ||
      r.data.studentId ||
      r.data.sku ||
      r.data.patientId ||
      r.data.employeeId ||
      r.data.phone;

    if (ident) {
      const normalized = String(ident).toLowerCase().trim();
      if (seenKeys.has(normalized)) {
        const original = seenKeys.get(normalized)!;
        duplicateCount++;
        fixes.push({
          id: `fix-dup-${r.id}`,
          recordId: r.id,
          recordName: rName,
          fieldName: 'record',
          fieldLabel: 'Duplicate Record',
          issueType: 'duplicate',
          issueDescription: `Duplicate identifier "${ident}" matches original record "${original.name}".`,
          currentValue: `ID: ${r.id} (${ident})`,
          suggestedValue: 'Remove duplicate record to maintain data integrity',
          action: 'delete_duplicate',
          approved: true,
          severity: 'high',
        });
      } else {
        seenKeys.set(normalized, { id: r.id, name: rName });
      }
    }
  }

  // Pre-calculate numeric averages and dominant categories for intelligent missing value imputation
  const numericAverages: Record<string, number> = {};
  const dominantCategories: Record<string, string> = {};

  for (const f of fields) {
    if (f.type === 'Number') {
      const nums = records
        .map((r) => Number(r.data?.[f.name]))
        .filter((n) => !isNaN(n) && n !== 0);
      if (nums.length > 0) {
        numericAverages[f.name] = Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
      }
    } else if (f.type === 'Dropdown') {
      const counts: Record<string, number> = {};
      for (const r of records) {
        const v = r.data?.[f.name];
        if (v) counts[String(v)] = (counts[String(v)] || 0) + 1;
      }
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        dominantCategories[f.name] = sorted[0][0];
      }
    }
  }

  // 2. Iterate each record and inspect all fields for data quality issues
  for (const r of records) {
    if (!r.data) continue;
    const rName = getRecordDisplayName(r);

    for (const f of fields) {
      const val = r.data[f.name];
      const fNameLower = f.name.toLowerCase();

      // Check A: Missing Values
      if (val === undefined || val === null || val === '' || (typeof val === 'string' && val.trim() === '')) {
        missingCount++;
        let suggested: any = 'N/A';

        if (f.type === 'Number') {
          suggested = numericAverages[f.name] ?? (fNameLower.includes('cgpa') ? 7.5 : fNameLower.includes('attendance') ? 85 : 0);
        } else if (f.type === 'Dropdown') {
          suggested = dominantCategories[f.name] || (f.options && f.options[0]) || 'Active';
        } else if (f.type === 'Email' || fNameLower.includes('email')) {
          const rawName = r.data.studentName || r.data.name || r.data.fullName || '';
          if (rawName) {
            const cleanName = String(rawName).toLowerCase().replace(/[^a-z0-9]/g, '.');
            suggested = `${cleanName}@example.edu`;
          } else {
            suggested = 'user@example.edu';
          }
        } else if (f.type === 'Date' || fNameLower.includes('date')) {
          suggested = new Date().toISOString().slice(0, 10);
        } else if (f.type === 'Boolean' || f.type === 'Checkbox') {
          suggested = false;
        } else {
          suggested = fNameLower.includes('status') ? 'Active' : fNameLower.includes('department') ? (dominantCategories[f.name] || 'General') : 'Pending';
        }

        fixes.push({
          id: `fix-miss-${r.id}-${f.name}`,
          recordId: r.id,
          recordName: rName,
          fieldName: f.name,
          fieldLabel: f.label,
          issueType: 'missing_value',
          issueDescription: `Missing value for field "${f.label}".`,
          currentValue: '(Empty / Null)',
          suggestedValue: suggested,
          action: 'fill_missing',
          approved: true,
          severity: 'medium',
        });
        continue; // Skip further checks on empty values
      }

      const strVal = String(val);

      // Check B: Extra Spaces (Leading, Trailing, Multiple Inner Spaces)
      if (typeof val === 'string') {
        const hasLeadingTrailing = strVal.startsWith(' ') || strVal.endsWith(' ');
        const hasMultipleSpaces = /\s{2,}/.test(strVal);
        if (hasLeadingTrailing || hasMultipleSpaces) {
          const cleaned = strVal.trim().replace(/\s+/g, ' ');
          if (cleaned !== strVal) {
            extraSpacesCount++;
            fixes.push({
              id: `fix-space-${r.id}-${f.name}`,
              recordId: r.id,
              recordName: rName,
              fieldName: f.name,
              fieldLabel: f.label,
              issueType: 'extra_spaces',
              issueDescription: 'Contains redundant leading, trailing, or double whitespace.',
              currentValue: `"${strVal}"`,
              suggestedValue: cleaned,
              action: 'update_field',
              approved: true,
              severity: 'low',
            });
          }
        }
      }

      // Check C: Invalid Emails
      if (f.type === 'Email' || fNameLower.includes('email') || (typeof val === 'string' && val.includes('@'))) {
        let emailStr = strVal.trim();
        let cleanedEmail = emailStr;
        let isInvalid = false;
        let reason = '';

        // Fix double @@
        if (cleanedEmail.includes('@@')) {
          cleanedEmail = cleanedEmail.replace(/@{2,}/g, '@');
          isInvalid = true;
          reason = 'Contained consecutive "@" characters.';
        }

        // Fix spaces inside email
        if (/\s/.test(cleanedEmail)) {
          cleanedEmail = cleanedEmail.replace(/\s+/g, '');
          isInvalid = true;
          reason = 'Contained spaces inside email address.';
        }

        // Fix common domain typos
        const typoMap: Record<string, string> = {
          '@gmaill.com': '@gmail.com',
          '@gmai.com': '@gmail.com',
          '@gmial.com': '@gmail.com',
          '@yaho.com': '@yahoo.com',
          '@yahou.com': '@yahoo.com',
          '@hotmial.com': '@hotmail.com',
          '@hotmaill.com': '@hotmail.com',
          '@outlok.com': '@outlook.com',
          '@outlock.com': '@outlook.com',
        };
        for (const [typo, correct] of Object.entries(typoMap)) {
          if (cleanedEmail.toLowerCase().endsWith(typo)) {
            cleanedEmail = cleanedEmail.slice(0, -typo.length) + correct;
            isInvalid = true;
            reason = `Corrected common domain typo (${typo} -> ${correct}).`;
            break;
          }
        }

        // Remove trailing dot
        if (cleanedEmail.endsWith('.')) {
          cleanedEmail = cleanedEmail.slice(0, -1);
          isInvalid = true;
          reason = 'Removed trailing dot from domain.';
        }

        // Check if missing @ or dot
        const standardEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!standardEmailRegex.test(cleanedEmail)) {
          isInvalid = true;
          reason = 'Invalid email syntax (missing domain extension or @ symbol).';
          if (!cleanedEmail.includes('@')) {
            cleanedEmail = `${cleanedEmail.replace(/[^a-zA-Z0-9.]/g, '')}@example.com`;
          } else if (!cleanedEmail.includes('.')) {
            cleanedEmail = `${cleanedEmail}.com`;
          }
        }

        if (isInvalid && cleanedEmail !== strVal) {
          invalidEmailCount++;
          fixes.push({
            id: `fix-email-${r.id}-${f.name}`,
            recordId: r.id,
            recordName: rName,
            fieldName: f.name,
            fieldLabel: f.label,
            issueType: 'invalid_email',
            issueDescription: reason || 'Invalid email address formatting.',
            currentValue: strVal,
            suggestedValue: cleanedEmail.toLowerCase(),
            action: 'update_field',
            approved: true,
            severity: 'high',
          });
        }
      }

      // Check D: Invalid Phone Numbers
      if (f.type === 'Phone' || fNameLower.includes('phone') || fNameLower.includes('mobile') || fNameLower.includes('contact')) {
        const rawPhone = strVal.trim();
        const digitsOnly = rawPhone.replace(/\D/g, '');

        if (digitsOnly.length >= 10 && digitsOnly.length <= 11) {
          let standardized = '';
          if (digitsOnly.length === 10) {
            standardized = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
          } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
            standardized = `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
          }

          if (standardized && standardized !== rawPhone) {
            invalidPhoneCount++;
            fixes.push({
              id: `fix-phone-${r.id}-${f.name}`,
              recordId: r.id,
              recordName: rName,
              fieldName: f.name,
              fieldLabel: f.label,
              issueType: 'invalid_phone',
              issueDescription: 'Non-standard phone format (normalized to standard telephone mask).',
              currentValue: rawPhone,
              suggestedValue: standardized,
              action: 'update_field',
              approved: true,
              severity: 'medium',
            });
          }
        } else if (rawPhone.length > 0 && digitsOnly.length < 10) {
          invalidPhoneCount++;
          fixes.push({
            id: `fix-phone-len-${r.id}-${f.name}`,
            recordId: r.id,
            recordName: rName,
            fieldName: f.name,
            fieldLabel: f.label,
            issueType: 'invalid_phone',
            issueDescription: `Incomplete phone number (${digitsOnly.length} digits). Requires standard 10-digit format.`,
            currentValue: rawPhone,
            suggestedValue: `(${digitsOnly.padEnd(3, '0').slice(0, 3)}) ${digitsOnly.slice(3, 6).padEnd(3, '0')}-${digitsOnly.slice(6).padEnd(4, '0')}`,
            action: 'update_field',
            approved: true,
            severity: 'medium',
          });
        }
      }

      // Check E: Incorrect Date Formats
      if (f.type === 'Date' || fNameLower.includes('date') || fNameLower.includes('dob') || fNameLower.includes('joined')) {
        const normalizedDate = parseAndNormalizeDate(strVal);
        if (normalizedDate && normalizedDate !== strVal) {
          invalidDateCount++;
          fixes.push({
            id: `fix-date-${r.id}-${f.name}`,
            recordId: r.id,
            recordName: rName,
            fieldName: f.name,
            fieldLabel: f.label,
            issueType: 'invalid_date',
            issueDescription: 'Non-standard date representation (normalized to standard ISO YYYY-MM-DD).',
            currentValue: strVal,
            suggestedValue: normalizedDate,
            action: 'update_field',
            approved: true,
            severity: 'medium',
          });
        }
      }

      // Check F: Mixed Uppercase/Lowercase Text (e.g. "cOMpUtEr ScIeNcE", "jOHN dOE", "ALEXANDER SMITH" for names/departments)
      if (f.type === 'Text' || fNameLower.includes('name') || fNameLower.includes('department') || fNameLower.includes('city') || fNameLower.includes('role')) {
        const textVal = strVal.trim();
        // Skip emails or URLs or IDs
        if (!textVal.includes('@') && !textVal.startsWith('http') && !textVal.startsWith('SKU-') && !textVal.startsWith('REG') && textVal.length > 2) {
          const isAllUpper = textVal === textVal.toUpperCase() && /[A-Z]/.test(textVal) && textVal.length > 3;
          const isAllLower = textVal === textVal.toLowerCase() && /[a-z]/.test(textVal) && (fNameLower.includes('name') || fNameLower.includes('dept') || fNameLower.includes('title'));
          const hasErraticCasing = /[a-z][A-Z]/.test(textVal) && !textVal.includes('iPhone') && !textVal.includes('eBay');

          if (isAllUpper || isAllLower || hasErraticCasing) {
            const titleCased = toTitleCase(textVal);
            if (titleCased !== textVal) {
              mixedCasingCount++;
              fixes.push({
                id: `fix-case-${r.id}-${f.name}`,
                recordId: r.id,
                recordName: rName,
                fieldName: f.name,
                fieldLabel: f.label,
                issueType: 'mixed_casing',
                issueDescription: isAllUpper ? 'ALL CAPS text formatted to clean Title Case.' : 'Inconsistent or erratic capitalization corrected to Title Case.',
                currentValue: textVal,
                suggestedValue: titleCased,
                action: 'update_field',
                approved: true,
                severity: 'low',
              });
            }
          }
        }
      }
    }
  }

  // AI Assessment text
  let aiAssessment = `Audited ${records.length} records. Identified ${fixes.length} data hygiene optimization(s) across duplicate identifiers, missing attributes, format normalizations, and casing standards.`;

  // Gemini AI synthesis (if available) to refine the assessment
  const ai = getGenAI();
  if (ai && fixes.length > 0) {
    try {
      const summaryPayload = {
        totalRecords: records.length,
        duplicateCount,
        missingCount,
        invalidEmailCount,
        invalidPhoneCount,
        invalidDateCount,
        extraSpacesCount,
        mixedCasingCount,
        sampleFixes: fixes.slice(0, 10).map((f) => ({
          field: f.fieldLabel,
          issue: f.issueType,
          before: f.currentValue,
          after: f.suggestedValue,
        })),
      };

      const promptText = `You are the lead AI Data Quality Architect for NexusDB. Review this automated cleaning audit summary for database "${dbName}":
${JSON.stringify(summaryPayload, null, 2)}

Provide a concise 2-sentence executive summary explaining the primary data quality improvements that will result from applying these proposed fixes.`;

      const genResult = await generateContentWithRetryAndFallback(ai, {
        contents: promptText,
        temperature: 0.2,
      });

      const refined = genResult?.text?.trim();
      if (refined && refined.length > 10) {
        aiAssessment = refined;
      }
    } catch (e) {
      console.warn('Gemini AI data cleaning assessment synthesis skipped:', e);
    }
  }

  return {
    databaseId,
    databaseName: dbName,
    totalRecordsAnalyzed: records.length,
    totalIssuesFound: fixes.length,
    fixes,
    summary: {
      duplicates: duplicateCount,
      missingValues: missingCount,
      invalidEmails: invalidEmailCount,
      invalidPhones: invalidPhoneCount,
      invalidDates: invalidDateCount,
      extraSpaces: extraSpacesCount,
      mixedCasing: mixedCasingCount,
    },
    aiAssessment,
  };
}

/**
 * Generate a comprehensive, executive AI report for a given database.
 * Analyzes schema, numerical aggregates, category distributions, data quality, and trends.
 */
export async function generateExecutiveAIReport(
  userId: string,
  databaseId: string
): Promise<AIReportData> {
  const targetDb = dbStore.getDatabaseById(databaseId, userId);
  const records = dbStore.getRecordsForUser(userId, databaseId, false);

  const dbName = targetDb?.name || 'Dataset';
  const dbCategory = targetDb?.category || 'General';
  const fields = targetDb?.fields || [];
  const activeRecords = records.filter((r) => !r.isArchived);
  const archivedRecords = records.filter((r) => r.isArchived);

  // 1. Calculate deterministic metrics and distributions
  let totalCellCount = 0;
  let filledCellCount = 0;

  const metrics: AIReportData['statistics']['metrics'] = [];

  for (const field of fields) {
    let fieldFilledCount = 0;
    const numericValues: number[] = [];
    const categoryFreq: Record<string, number> = {};

    for (const r of activeRecords) {
      const val = r.data?.[field.name];
      totalCellCount++;
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        fieldFilledCount++;
        filledCellCount++;

        if (field.type === 'Number') {
          const num = Number(val);
          if (!isNaN(num)) numericValues.push(num);
        }

        const catKey = String(val).trim();
        categoryFreq[catKey] = (categoryFreq[catKey] || 0) + 1;
      }
    }

    const metricItem: AIReportData['statistics']['metrics'][0] = {
      fieldName: field.name,
      fieldLabel: field.label || field.name,
      type: field.type || 'Text',
      count: fieldFilledCount,
    };

    if (field.type === 'Number' && numericValues.length > 0) {
      const sum = numericValues.reduce((a, b) => a + b, 0);
      const avg = Math.round((sum / numericValues.length) * 100) / 100;
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      metricItem.sum = sum;
      metricItem.average = avg;
      metricItem.min = min;
      metricItem.max = max;
    }

    const sortedCats = Object.entries(categoryFreq).sort((a, b) => b[1] - a[1]);
    if (sortedCats.length > 0) {
      const top = sortedCats[0];
      metricItem.topCategory = top[0];
      const pct = Math.round((top[1] / Math.max(1, activeRecords.length)) * 100);
      metricItem.topCategoryPercent = `${pct}%`;

      metricItem.distribution = sortedCats.slice(0, 6).map(([label, count]) => ({
        label,
        count,
        percentage: Math.round((count / Math.max(1, activeRecords.length)) * 100),
      }));
    }

    metrics.push(metricItem);
  }

  const completenessPct =
    totalCellCount > 0
      ? `${Math.round((filledCellCount / totalCellCount) * 100)}%`
      : '100%';

  // 2. Prepare baseline fallbacks in case AI is offline or model fails
  let executiveSummary = `Executive summary for ${dbName} (${dbCategory}): The dataset currently tracks ${activeRecords.length} active record(s) across ${fields.length} configured attribute fields with an overall data completeness score of ${completenessPct}.`;
  let insightsSummary = `Key metrics reveal ${activeRecords.length} live operational records with ${archivedRecords.length} archived entries. Quantitative indicators show steady data density across primary dimensions.`;

  let keyTrends: AIReportData['keyTrends'] = [
    {
      title: 'Dataset Volume & Population Growth',
      description: `The database contains ${activeRecords.length} active records, providing a healthy baseline for operational monitoring.`,
      impact: 'positive',
      metricContext: `${activeRecords.length} Records`,
    },
    {
      title: 'Data Field Completeness',
      description: `Attribute fill rate stands at ${completenessPct}, ensuring reliable downstream reporting and query filtering.`,
      impact: completenessPct.startsWith('100') || completenessPct.startsWith('9') ? 'positive' : 'neutral',
      metricContext: `${completenessPct} Fill Rate`,
    },
  ];

  let recommendations: AIReportData['recommendations'] = [
    {
      title: 'Maintain Regular Data Validation',
      action: 'Run automated AI cleaning periodically to catch missing values and formatting inconsistencies early.',
      priority: 'medium',
      expectedOutcome: 'High fidelity metrics and consistent standard reporting.',
    },
    {
      title: 'Optimize Core Category Groupings',
      action: 'Review low-frequency category entries and standardize dropdown choices.',
      priority: 'low',
      expectedOutcome: 'Streamlined filtering and cleaner aggregation charts.',
    },
  ];

  let potentialIssues: AIReportData['potentialIssues'] = [
    {
      title: 'Unfilled Attribute Cells',
      description: `Certain records have optional or unpopulated fields, impacting overall metric coverage.`,
      severity: 'info',
      suggestedRemedy: 'Make critical fields mandatory in schema settings.',
    },
  ];

  // 3. Call Gemini AI to produce deep, context-aware analysis
  const ai = getGenAI();
  if (ai) {
    try {
      const sampleRecords = activeRecords.slice(0, 30).map((r) => ({
        id: r.id,
        ...r.data,
      }));

      const contextPayload = {
        databaseName: dbName,
        category: dbCategory,
        totalRecords: activeRecords.length,
        archivedRecords: archivedRecords.length,
        completenessRate: completenessPct,
        fields: fields.map((f) => ({ name: f.name, label: f.label, type: f.type })),
        computedMetrics: metrics,
        sampleRecords,
      };

      const promptText = `You are a Chief Data Officer & Principal Business Intelligence Analyst generating an Executive AI Report for the database "${dbName}".

Dataset Context & Analytics:
${JSON.stringify(contextPayload, null, 2)}

Generate a comprehensive, executive-grade analysis with the following structured JSON output:
{
  "executiveSummary": "A polished, thorough 3-5 sentence executive narrative summarizing the dataset's strategic scope, total volume (${activeRecords.length} records), core highlights, and key operational takeaways.",
  "insightsSummary": "A 2-3 sentence summary of high-level statistical findings.",
  "keyTrends": [
    {
      "title": "Trend title",
      "description": "Clear explanation of what the trend is and why it matters based on the data",
      "impact": "positive" | "neutral" | "negative" | "critical",
      "metricContext": "Short metric badge like '+18% MoM' or 'High Density'"
    }
  ],
  "recommendations": [
    {
      "title": "Strategic recommendation title",
      "action": "Concrete, actionable step for the team or administrator to take",
      "priority": "high" | "medium" | "low",
      "expectedOutcome": "Anticipated business/data outcome"
    }
  ],
  "potentialIssues": [
    {
      "title": "Potential risk or anomaly title",
      "description": "Explanation of potential bottleneck, data gap, outlier, or operational risk found in the data",
      "severity": "critical" | "warning" | "info",
      "suggestedRemedy": "Specific remediation step"
    }
  ]
}

Provide 3 to 5 items for keyTrends, 3 to 5 items for recommendations, and 2 to 4 items for potentialIssues. Ground every insight in the actual fields and values provided. Return valid JSON only.`;

      const genResult = await generateContentWithRetryAndFallback(ai, {
        contents: promptText,
        responseMimeType: 'application/json',
        temperature: 0.3,
      });

      if (genResult && genResult.text) {
        const parsed = JSON.parse(genResult.text);
        if (parsed.executiveSummary) executiveSummary = parsed.executiveSummary;
        if (parsed.insightsSummary) insightsSummary = parsed.insightsSummary;
        if (Array.isArray(parsed.keyTrends) && parsed.keyTrends.length > 0) {
          keyTrends = parsed.keyTrends.map((t: any) => ({
            title: String(t.title || 'Identified Trend'),
            description: String(t.description || ''),
            impact: ['positive', 'neutral', 'negative', 'critical'].includes(t.impact)
              ? t.impact
              : 'neutral',
            metricContext: t.metricContext ? String(t.metricContext) : undefined,
          }));
        }
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          recommendations = parsed.recommendations.map((r: any) => ({
            title: String(r.title || 'Recommendation'),
            action: String(r.action || ''),
            priority: ['high', 'medium', 'low'].includes(r.priority) ? r.priority : 'medium',
            expectedOutcome: String(r.expectedOutcome || ''),
          }));
        }
        if (Array.isArray(parsed.potentialIssues) && parsed.potentialIssues.length > 0) {
          potentialIssues = parsed.potentialIssues.map((p: any) => ({
            title: String(p.title || 'Potential Issue'),
            description: String(p.description || ''),
            severity: ['critical', 'warning', 'info'].includes(p.severity) ? p.severity : 'warning',
            suggestedRemedy: String(p.suggestedRemedy || ''),
          }));
        }
      }
    } catch (err) {
      console.warn('Gemini Executive AI Report generation error, using deterministic analytics fallback:', err);
    }
  }

  return {
    databaseId,
    databaseName: dbName,
    category: dbCategory,
    generatedAt: new Date().toISOString(),
    totalRecords: records.length,
    activeRecords: activeRecords.length,
    archivedRecords: archivedRecords.length,
    totalFields: fields.length,
    executiveSummary,
    statistics: {
      totalRecords: records.length,
      activeRecords: activeRecords.length,
      archivedRecords: archivedRecords.length,
      completenessRate: completenessPct,
      metrics,
      insightsSummary,
    },
    keyTrends,
    recommendations,
    potentialIssues,
  };
}


