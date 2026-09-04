import React, { useState } from 'react';
import { DatabaseSchema, FieldSchema, FieldType } from '../../types.js';
import { useDatabase } from '../../context/DatabaseContext.tsx';
import { DATABASE_TEMPLATES, DatabaseTemplate } from '../../data/databaseTemplates.ts';
import {
  Plus,
  Trash2,
  X,
  Database,
  Layers,
  Sparkles,
  GraduationCap,
  Package,
  Users,
  Activity,
  Briefcase,
  BookOpen,
  TrendingUp,
  Clock,
  DollarSign,
  CheckCircle2,
  LayoutTemplate,
} from 'lucide-react';

interface SchemaBuilderModalProps {
  existingDatabase?: DatabaseSchema | null;
  onClose: () => void;
}

export const SchemaBuilderModal: React.FC<SchemaBuilderModalProps> = ({
  existingDatabase,
  onClose,
}) => {
  const { createDatabase, updateDatabase } = useDatabase();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    existingDatabase ? '' : 'blank'
  );
  const [name, setName] = useState(existingDatabase?.name || '');
  const [description, setDescription] = useState(existingDatabase?.description || '');
  const [category, setCategory] = useState<any>(existingDatabase?.category || 'Custom');
  const [icon, setIcon] = useState(existingDatabase?.icon || 'Database');

  const [fields, setFields] = useState<FieldSchema[]>(
    existingDatabase?.fields || [
      { id: 'f_title', name: 'title', label: 'Item Name', type: 'Text', required: true, isPrimary: true },
      { id: 'f_desc', name: 'description', label: 'Description', type: 'Long Text' },
    ]
  );

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case 'GraduationCap':
        return <GraduationCap className="w-3.5 h-3.5" />;
      case 'Package':
        return <Package className="w-3.5 h-3.5" />;
      case 'Users':
        return <Users className="w-3.5 h-3.5" />;
      case 'Activity':
        return <Activity className="w-3.5 h-3.5" />;
      case 'Briefcase':
        return <Briefcase className="w-3.5 h-3.5" />;
      case 'BookOpen':
        return <BookOpen className="w-3.5 h-3.5" />;
      case 'TrendingUp':
        return <TrendingUp className="w-3.5 h-3.5" />;
      case 'Clock':
        return <Clock className="w-3.5 h-3.5" />;
      case 'DollarSign':
        return <DollarSign className="w-3.5 h-3.5" />;
      default:
        return <Database className="w-3.5 h-3.5" />;
    }
  };

  const handleSelectTemplate = (tpl: DatabaseTemplate) => {
    setSelectedTemplateId(tpl.id);
    if (tpl.id === 'blank') {
      setName('');
      setDescription('');
      setCategory('Custom');
      setIcon('Database');
      setFields([
        { id: `f_${Date.now()}_1`, name: 'title', label: 'Item Name', type: 'Text', required: true, isPrimary: true },
        { id: `f_${Date.now()}_2`, name: 'description', label: 'Description', type: 'Long Text' },
      ]);
    } else {
      setName(tpl.name);
      setDescription(tpl.description);
      setCategory(tpl.category);
      setIcon(tpl.icon);
      setFields(
        tpl.fields.map((f, i) => ({
          ...f,
          id: `f_${Date.now()}_${i + 1}_${f.name}`,
          options: f.options ? [...f.options] : undefined,
        }))
      );
    }
  };

  const fieldTypes: FieldType[] = [
    'Text',
    'Number',
    'Email',
    'Phone',
    'Date',
    'Boolean',
    'Dropdown',
    'Checkbox',
    'Image Upload',
    'File Upload',
    'Long Text',
    'URL',
  ];

  const handleAddField = () => {
    const fieldNum = fields.length + 1;
    const newField: FieldSchema = {
      id: 'f_' + Date.now() + '_' + fieldNum,
      name: `field_${fieldNum}`,
      label: `Custom Field ${fieldNum}`,
      type: 'Text',
      required: false,
    };
    setFields([...fields, newField]);
  };

  const handleUpdateField = (index: number, updates: Partial<FieldSchema>) => {
    const copy = [...fields];
    copy[index] = { ...copy[index], ...updates };

    // Auto update name key if label changes
    if (updates.label) {
      copy[index].name = updates.label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    }

    setFields(copy);
  };

  const handleRemoveField = (index: number) => {
    if (fields.length <= 1) return;
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (existingDatabase) {
      await updateDatabase(existingDatabase.id, {
        name,
        description,
        category,
        icon,
        fields,
      });
    } else {
      await createDatabase({
        name,
        description,
        category,
        icon,
        fields,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {existingDatabase ? 'Customize Schema' : 'Create Custom Database'}
              </h3>
              <p className="text-xs text-slate-400">
                {existingDatabase
                  ? 'Define fields & data types for your database'
                  : 'Choose a pre-built template or start with a blank database'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Template Selection Section (New Database only) */}
          {!existingDatabase && (
            <div className="space-y-2 pb-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <LayoutTemplate className="w-3.5 h-3.5 text-blue-500" />
                  <span>Choose Template</span>
                </label>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {selectedTemplateId === 'blank' ? 'Blank custom database' : `${fields.length} schema fields loaded`}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {DATABASE_TEMPLATES.map((tpl) => {
                  const isSelected = selectedTemplateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      id={`template-card-${tpl.id}`}
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all relative ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 shadow-sm ring-1 ring-blue-500/40 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <div
                          className="p-1.5 rounded-lg text-white"
                          style={{ backgroundColor: tpl.color }}
                        >
                          {getTemplateIcon(tpl.icon)}
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div className="font-bold text-[11px] leading-tight truncate w-full">
                        {tpl.name}
                      </div>
                      <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate w-full mt-0.5">
                        {tpl.id === 'blank' ? 'Empty' : `${tpl.fields.length} fields`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Basic Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Database Name *</label>
              <input
                type="text"
                required
                id="schema-db-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Asset Tracking, Library Catalog"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Category</label>
              <select
                id="schema-db-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="Custom">Custom</option>
                <option value="Education">Education</option>
                <option value="Operations">Operations</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Sales">Sales</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Inventory">Inventory</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Description</label>
              <input
                type="text"
                id="schema-db-desc-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief purpose of this database..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          {/* Fields Editor */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Schema Fields ({fields.length})
              </h4>
              <button
                type="button"
                id="schema-add-field-btn"
                onClick={handleAddField}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add Field
              </button>
            </div>

            <div className="space-y-3">
              {fields.map((field, idx) => (
                <div
                  key={field.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => handleUpdateField(idx, { label: e.target.value })}
                        placeholder="Field Label"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold"
                      />
                    </div>

                    <div className="w-40">
                      <select
                        value={field.type}
                        onChange={(e) => handleUpdateField(idx, { type: e.target.value as FieldType })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      >
                        {fieldTypes.map((ft) => (
                          <option key={ft} value={ft}>
                            {ft}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={Boolean(field.required)}
                        onChange={(e) => handleUpdateField(idx, { required: e.target.checked })}
                        className="rounded border-slate-300 dark:border-slate-700 text-blue-600"
                      />
                      <span>Req</span>
                    </label>

                    <button
                      type="button"
                      disabled={fields.length <= 1}
                      onClick={() => handleRemoveField(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* If Dropdown, allow specifying comma separated options */}
                  {field.type === 'Dropdown' && (
                    <div className="pl-2 border-l-2 border-blue-500">
                      <input
                        type="text"
                        value={field.options?.join(', ') || ''}
                        onChange={(e) =>
                          handleUpdateField(idx, {
                            options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        placeholder="Dropdown Options (comma separated: e.g. Active, Pending, Closed)"
                        className="w-full px-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              id="schema-cancel-btn"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="schema-create-db-submit-btn"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20"
            >
              {existingDatabase ? 'Save Schema' : 'Create Database'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

