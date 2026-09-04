import React, { useState, useEffect } from 'react';
import { DatabaseSchema, FieldSchema, RecordItem } from '../../types.js';
import { Check, X, Upload, Sparkles, AlertCircle } from 'lucide-react';

interface DynamicFormProps {
  database: DatabaseSchema;
  record?: RecordItem | null;
  onSubmit: (data: Record<string, any>) => void;
  onCancel: () => void;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  database,
  record,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (record) {
      setFormData(record.data || {});
    } else {
      // Set defaults
      const defaults: Record<string, any> = {};
      database.fields.forEach((f) => {
        if (f.defaultValue !== undefined) defaults[f.name] = f.defaultValue;
        else if (f.type === 'Boolean' || f.type === 'Checkbox') defaults[f.name] = false;
        else if (f.type === 'Dropdown' && f.options && f.options.length > 0) defaults[f.name] = f.options[0];
        else defaults[f.name] = '';
      });
      setFormData(defaults);
    }
  }, [database, record]);

  const handleChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    if (errors[fieldName]) {
      setErrors((prev) => {
        const c = { ...prev };
        delete c[fieldName];
        return c;
      });
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    database.fields.forEach((field) => {
      if (field.required) {
        const val = formData[field.name];
        if (val === undefined || val === null || val === '') {
          errs[field.name] = `${field.label} is required`;
        }
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  const renderFieldInput = (field: FieldSchema) => {
    const value = formData[field.name] ?? '';

    switch (field.type) {
      case 'Long Text':
        return (
          <textarea
            rows={3}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        );

      case 'Dropdown':
        return (
          <select
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="">Select option...</option>
            {field.options?.map((opt, i) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case 'Boolean':
      case 'Checkbox':
        return (
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleChange(field.name, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-slate-600 peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {value ? 'Yes / Enabled' : 'No / Disabled'}
            </span>
          </label>
        );

      case 'Number':
        return (
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="0"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        );

      case 'Date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        );

      case 'Email':
        return (
          <input
            type="email"
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder="email@domain.com"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        );

      case 'Phone':
        return (
          <input
            type="tel"
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        );

      case 'Image Upload':
      case 'File Upload':
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder="Paste file or image URL..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {database.fields.map((field) => (
          <div
            key={field.id}
            className={`space-y-1.5 ${field.type === 'Long Text' ? 'md:col-span-2' : ''}`}
          >
            <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>
                {field.label} {field.required && <span className="text-rose-500">*</span>}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{field.type}</span>
            </label>

            {renderFieldInput(field)}

            {errors[field.name] && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{errors[field.name]}</span>
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>

        <button
          type="submit"
          className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all hover:scale-105"
        >
          {record ? 'Save Changes' : 'Create Record'}
        </button>
      </div>
    </form>
  );
};
