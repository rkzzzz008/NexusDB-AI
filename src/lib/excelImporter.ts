import * as XLSX from 'xlsx';

export type FieldType = 'Text' | 'Number' | 'Boolean' | 'Date' | 'Email' | 'URL';

export interface DetectedField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
}

export interface ParsedImportResult {
  fileName: string;
  suggestedDbName: string;
  sheetName?: string;
  totalRows: number;
  detectedFields: DetectedField[];
  rows: Record<string, any>[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^(https?:\/\/|www\.)[^\s/$.?#].[^\s]*$/i;
const DATE_REGEX = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(\s|T)?.*$/;

export function detectFieldType(values: any[]): FieldType {
  const nonEmpties = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonEmpties.length === 0) return 'Text';

  const samples = nonEmpties.slice(0, 200);

  let numCount = 0;
  let boolCount = 0;
  let dateCount = 0;
  let emailCount = 0;
  let urlCount = 0;

  for (const rawVal of samples) {
    if (rawVal instanceof Date) {
      dateCount++;
      continue;
    }

    const strVal = String(rawVal).trim();

    if (typeof rawVal === 'boolean' || ['true', 'false', 'yes', 'no'].includes(strVal.toLowerCase())) {
      boolCount++;
    } else if (EMAIL_REGEX.test(strVal)) {
      emailCount++;
    } else if (URL_REGEX.test(strVal)) {
      urlCount++;
    } else if (typeof rawVal === 'number' || (!isNaN(Number(strVal)) && strVal !== '' && !/^\d{4}-\d{2}-\d{2}/.test(strVal))) {
      numCount++;
    } else if (
      DATE_REGEX.test(strVal) ||
      (!isNaN(Date.parse(strVal)) && strVal.length >= 6 && !/^\d+$/.test(strVal) && (strVal.includes('-') || strVal.includes('/') || strVal.includes('.')))
    ) {
      dateCount++;
    }
  }

  const total = samples.length;
  if (dateCount / total >= 0.7) return 'Date';
  if (emailCount / total >= 0.7) return 'Email';
  if (urlCount / total >= 0.7) return 'URL';
  if (boolCount / total >= 0.7) return 'Boolean';
  if (numCount / total >= 0.7) return 'Number';

  return 'Text';
}

function sanitizeFieldName(label: string, index: number, seenNames: Set<string>): string {
  let name = label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!name) name = `field_${index + 1}`;

  let uniqueName = name;
  let counter = 1;
  while (seenNames.has(uniqueName)) {
    uniqueName = `${name}_${counter++}`;
  }
  seenNames.add(uniqueName);
  return uniqueName;
}

export function parseExcelBuffer(buffer: ArrayBuffer, fileName: string): ParsedImportResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(new Uint8Array(buffer), {
      type: 'array',
      cellDates: true,
      dateNF: 'yyyy-mm-dd',
    });
  } catch (err: any) {
    throw new Error(`Invalid or corrupt Excel file: ${err?.message || 'Could not parse workbook structure'}`);
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel file does not contain any valid worksheets.');
  }

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    throw new Error(`Worksheet "${firstSheetName}" is empty or unreadable.`);
  }

  const rawSheetData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });

  if (!rawSheetData || rawSheetData.length === 0) {
    throw new Error('The selected Excel worksheet contains no data.');
  }

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(15, rawSheetData.length); i++) {
    const row = rawSheetData[i];
    if (row && row.some((cell: any) => cell !== undefined && cell !== null && String(cell).trim() !== '')) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error('Could not identify a valid header row in the Excel worksheet.');
  }

  const rawHeaders = rawSheetData[headerRowIdx];
  const seenNames = new Set<string>();
  const fieldsInfo: { label: string; name: string }[] = [];

  rawHeaders.forEach((h: any, idx: number) => {
    const label = h !== undefined && h !== null && String(h).trim() !== '' ? String(h).trim() : `Column_${idx + 1}`;
    const name = sanitizeFieldName(label, idx, seenNames);
    fieldsInfo.push({ label, name });
  });

  const rawRows: Record<string, any>[] = [];
  const colValuesMap: Record<string, any[]> = {};
  fieldsInfo.forEach((f) => {
    colValuesMap[f.name] = [];
  });

  for (let i = headerRowIdx + 1; i < rawSheetData.length; i++) {
    const rowArray = rawSheetData[i];
    if (!rowArray) continue;

    const isRowEmpty = !rowArray.some((cell: any) => cell !== undefined && cell !== null && String(cell).trim() !== '');
    if (isRowEmpty) continue;

    const rowObj: Record<string, any> = {};
    fieldsInfo.forEach((f, colIdx) => {
      let val = rowArray[colIdx];
      if (val === undefined || val === null) val = '';

      if (val instanceof Date) {
        val = val.toISOString().split('T')[0];
      } else if (typeof val === 'string') {
        val = val.trim();
      }

      rowObj[f.name] = val;
      if (val !== '') colValuesMap[f.name].push(val);
    });

    rawRows.push(rowObj);
  }

  if (rawRows.length === 0) {
    throw new Error('Excel file contains headers, but no non-empty data rows were found.');
  }

  const detectedFields: DetectedField[] = fieldsInfo.map((f, idx) => ({
    id: `f_${idx + 1}_${Date.now()}`,
    name: f.name,
    label: f.label,
    type: detectFieldType(colValuesMap[f.name] || []),
    required: false,
  }));

  const typedRows = rawRows.map((r) => {
    const typedRow: Record<string, any> = {};
    detectedFields.forEach((field) => {
      const val = r[field.name];
      if (val === undefined || val === null || val === '') {
        typedRow[field.name] = '';
        return;
      }

      if (field.type === 'Number') {
        typedRow[field.name] = isNaN(Number(val)) ? 0 : Number(val);
      } else if (field.type === 'Boolean') {
        typedRow[field.name] = typeof val === 'boolean' ? val : ['true', 'yes', '1'].includes(String(val).toLowerCase());
      } else {
        typedRow[field.name] = String(val);
      }
    });
    return typedRow;
  });

  const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9 _-]/g, '');
  const suggestedDbName = baseName ? baseName.charAt(0).toUpperCase() + baseName.slice(1) : 'Imported Excel Database';

  return {
    fileName,
    suggestedDbName,
    sheetName: firstSheetName,
    totalRows: typedRows.length,
    detectedFields,
    rows: typedRows,
  };
}

export function parseCSVText(csvText: string, fileName = 'Imported_CSV.csv'): ParsedImportResult {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('CSV content must contain a header row and at least 1 data row.');
  }

  const parseCSVLine = (line: string) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values.map((v) => v.replace(/^["']|["']$/g, ''));
  };

  const rawHeaders = parseCSVLine(lines[0]);
  const seenNames = new Set<string>();
  const fieldsInfo: { label: string; name: string }[] = [];

  rawHeaders.forEach((h, idx) => {
    const label = h.trim() || `Column_${idx + 1}`;
    const name = sanitizeFieldName(label, idx, seenNames);
    fieldsInfo.push({ label, name });
  });

  const rawRows: Record<string, any>[] = [];
  const colValuesMap: Record<string, any[]> = {};
  fieldsInfo.forEach((f) => {
    colValuesMap[f.name] = [];
  });

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);

    const isEmpty = values.every((v) => !v.trim());
    if (isEmpty) continue;

    const rowObj: Record<string, any> = {};
    fieldsInfo.forEach((f, idx) => {
      const val = values[idx] || '';
      rowObj[f.name] = val;
      if (val !== '') colValuesMap[f.name].push(val);
    });
    rawRows.push(rowObj);
  }

  if (rawRows.length === 0) {
    throw new Error('CSV file contains headers, but no valid non-empty data rows.');
  }

  const detectedFields: DetectedField[] = fieldsInfo.map((f, idx) => ({
    id: `f_${idx + 1}_${Date.now()}`,
    name: f.name,
    label: f.label,
    type: detectFieldType(colValuesMap[f.name] || []),
    required: false,
  }));

  const typedRows = rawRows.map((r) => {
    const typedRow: Record<string, any> = {};
    detectedFields.forEach((field) => {
      const val = r[field.name];
      if (val === undefined || val === null || val === '') {
        typedRow[field.name] = '';
        return;
      }

      if (field.type === 'Number') {
        typedRow[field.name] = isNaN(Number(val)) ? 0 : Number(val);
      } else if (field.type === 'Boolean') {
        typedRow[field.name] = typeof val === 'boolean' ? val : ['true', 'yes', '1'].includes(String(val).toLowerCase());
      } else {
        typedRow[field.name] = String(val);
      }
    });
    return typedRow;
  });

  const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9 _-]/g, '');
  const suggestedDbName = baseName ? baseName.charAt(0).toUpperCase() + baseName.slice(1) : 'Imported CSV Database';

  return {
    fileName,
    suggestedDbName,
    totalRows: typedRows.length,
    detectedFields,
    rows: typedRows,
  };
}

export function parseJSONText(jsonText: string, fileName = 'Imported_Data.json'): ParsedImportResult {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e: any) {
    throw new Error(`Invalid JSON file format: ${e.message}`);
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (items.length === 0) {
    throw new Error('JSON file contains an empty dataset.');
  }

  const keysSet = new Set<string>();
  items.forEach((item) => {
    if (item && typeof item === 'object') {
      Object.keys(item).forEach((k) => keysSet.add(k));
    }
  });

  if (keysSet.size === 0) {
    throw new Error('JSON data contains no property keys.');
  }

  const seenNames = new Set<string>();
  const fieldsInfo: { label: string; name: string }[] = [];

  Array.from(keysSet).forEach((key, idx) => {
    const name = sanitizeFieldName(key, idx, seenNames);
    fieldsInfo.push({ label: key, name });
  });

  const colValuesMap: Record<string, any[]> = {};
  fieldsInfo.forEach((f) => {
    colValuesMap[f.name] = [];
  });

  const rawRows: Record<string, any>[] = [];

  items.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const rowObj: Record<string, any> = {};

    fieldsInfo.forEach((f) => {
      const val = item[f.label] !== undefined ? item[f.label] : item[f.name];
      if (val !== undefined && val !== null && val !== '') {
        rowObj[f.name] = val;
        colValuesMap[f.name].push(val);
      } else {
        rowObj[f.name] = '';
      }
    });

    rawRows.push(rowObj);
  });

  const detectedFields: DetectedField[] = fieldsInfo.map((f, idx) => ({
    id: `f_${idx + 1}_${Date.now()}`,
    name: f.name,
    label: f.label,
    type: detectFieldType(colValuesMap[f.name] || []),
    required: false,
  }));

  const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9 _-]/g, '');
  const suggestedDbName = baseName ? baseName.charAt(0).toUpperCase() + baseName.slice(1) : 'Imported JSON Database';

  return {
    fileName,
    suggestedDbName,
    totalRows: rawRows.length,
    detectedFields,
    rows: rawRows,
  };
}
