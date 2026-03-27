'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface EditField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'time' | 'textarea' | 'select' | 'number';
  value: string | number;
  options?: { label: string; value: string }[];
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
}

interface EditButtonProps {
  onEdit: (id: string, data: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  itemId: string;
  itemName: string;
  fields: EditField[];
  title?: string;
  accentColor?: string;
}

export default function EditButton({ onEdit, itemId, itemName, fields, title, accentColor = 'blue' }: EditButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [values, setValues] = useState<Record<string, string | number>>(() => {
    const init: Record<string, string | number> = {};
    fields.forEach(f => { init[f.key] = f.value; });
    return init;
  });
  const router = useRouter();

  function handleOpen() {
    const init: Record<string, string | number> = {};
    fields.forEach(f => { init[f.key] = f.value; });
    setValues(init);
    setError('');
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const updates: Record<string, unknown> = {};
    fields.forEach(f => {
      const newVal = values[f.key];
      const oldVal = f.value;
      if (newVal !== oldVal && newVal !== '' && newVal !== undefined) {
        updates[f.key] = f.type === 'number' ? Number(newVal) : newVal;
      }
    });

    if (Object.keys(updates).length === 0) {
      setOpen(false);
      return;
    }

    startTransition(async () => {
      const result = await onEdit(itemId, updates);
      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error || 'ไม่สามารถแก้ไขได้');
      }
    });
  }

  const colorMap: Record<string, { btn: string; focus: string }> = {
    blue: { btn: 'bg-blue-600 hover:bg-blue-500', focus: 'focus:border-blue-500' },
    green: { btn: 'bg-[#00B900] hover:bg-[#00A000]', focus: 'focus:border-[#00B900]' },
    amber: { btn: 'bg-amber-600 hover:bg-amber-500', focus: 'focus:border-amber-500' },
    purple: { btn: 'bg-purple-600 hover:bg-purple-500', focus: 'focus:border-purple-500' },
    pink: { btn: 'bg-pink-600 hover:bg-pink-500', focus: 'focus:border-pink-500' },
  };
  const colors = colorMap[accentColor] || colorMap.blue;

  return (
    <>
      <button
        onClick={handleOpen}
        className="p-1.5 rounded-md text-gray-500 hover:text-orange-400 hover:bg-orange-400/10 transition-colors"
        title="แก้ไข"
      >
        <Pencil className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#333333]">
              <h2 className="text-lg font-semibold text-white">{title || `แก้ไข "${itemName}"`}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
              )}

              {fields.map(field => (
                <div key={field.key}>
                  <label className="block text-sm text-gray-400 mb-1">
                    {field.label} {field.required && '*'}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={values[field.key] || ''}
                      onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={3}
                      required={field.required}
                      className={`w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none ${colors.focus} resize-none`}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={values[field.key] || ''}
                      onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                      className={`w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white focus:outline-none ${colors.focus}`}
                    >
                      {field.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={values[field.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value }))}
                      placeholder={field.placeholder}
                      required={field.required}
                      min={field.min}
                      max={field.max}
                      className={`w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none ${colors.focus}`}
                    />
                  )}
                </div>
              ))}

              <Button
                type="submit"
                disabled={isPending}
                className={`w-full ${colors.btn} text-white disabled:opacity-50`}
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
