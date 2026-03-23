'use client';

import { useState, useMemo } from 'react';
import { Calendar, CheckSquare, StickyNote, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CalendarEvent } from './CalendarView';

function getTypeConfig(type: string) {
  switch (type) {
    case 'event': return { icon: Calendar, color: 'bg-[#00B900]', text: 'text-[#00B900]', label: 'นัดหมาย' };
    case 'task': return { icon: CheckSquare, color: 'bg-blue-500', text: 'text-blue-400', label: 'งาน' };
    case 'note': return { icon: StickyNote, color: 'bg-amber-500', text: 'text-amber-400', label: 'บันทึก' };
    default: return { icon: Calendar, color: 'bg-gray-500', text: 'text-gray-400', label: '' };
  }
}

function formatDateThai(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface TimelineViewProps {
  events: CalendarEvent[];
}

export default function TimelineView({ events }: TimelineViewProps) {
  const [selectedItem, setSelectedItem] = useState<CalendarEvent | null>(null);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateB !== dateA) return dateB.localeCompare(dateA);
      const timeA = a.time || '';
      const timeB = b.time || '';
      return timeB.localeCompare(timeA);
    });
  }, [events]);

  if (sortedEvents.length === 0) {
    return (
      <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-8 text-center">
        <p className="text-gray-500">ยังไม่มีรายการ</p>
      </div>
    );
  }

  // จัดกลุ่มตามวันที่
  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: CalendarEvent[] }[] = [];
    let currentDate = '';
    sortedEvents.forEach(ev => {
      const d = ev.date?.split('T')[0] || '';
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, items: [ev] });
      } else {
        groups[groups.length - 1].items.push(ev);
      }
    });
    return groups;
  }, [sortedEvents]);

  return (
    <div className="relative pl-10">
      {/* เส้น timeline แนวตั้ง */}
      <div className="absolute left-[15px] top-3 bottom-3 w-[2px] bg-[#2A2A2A] rounded-full" />

      <div className="space-y-8">
        {groupedByDate.map((group) => (
          <div key={group.date}>
            {/* Date header */}
            <div className="relative flex items-center gap-3 mb-4">
              <div className="absolute -left-10 w-[32px] flex justify-center">
                <div className="w-3 h-3 rounded-full bg-[#2A2A2A] border-[3px] border-black z-10" />
              </div>
              <span className="text-sm font-semibold text-gray-300">
                {formatDateThai(group.date)}
              </span>
            </div>

            {/* Items */}
            <div className="space-y-3">
              {group.items.map((ev) => {
                const config = getTypeConfig(ev.type);
                const Icon = config.icon;
                const dotColor = ev.type === 'event' ? 'bg-[#00B900]' : ev.type === 'task' ? 'bg-blue-500' : 'bg-amber-500';

                return (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedItem(ev)}
                    className="relative w-full flex items-center gap-4 p-4 rounded-xl bg-[#1A1A1A] border border-[#333333] hover:border-[#444444] hover:bg-[#222222] transition-colors text-left group"
                  >
                    {/* Node dot บนเส้น */}
                    <div className="absolute -left-10 w-[32px] flex justify-center">
                      <div className={`w-2.5 h-2.5 rounded-full ${dotColor} ring-[3px] ring-black z-10 group-hover:scale-150 transition-transform`} />
                    </div>

                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.color}/20 shrink-0`}>
                      <Icon className={`w-5 h-5 ${config.text}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-white truncate group-hover:text-[#00B900] transition-colors">{ev.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs ${config.text}`}>{config.label}</span>
                        {ev.time && (
                          <span className="text-xs text-gray-500">{ev.time} น.</span>
                        )}
                        {ev.description && (
                          <span className="text-xs text-gray-600 truncate hidden md:inline">{ev.description}</span>
                        )}
                      </div>
                    </div>

                    {/* Badges + Arrow */}
                    <div className="flex items-center gap-2 shrink-0">
                      {ev.priority === 'high' && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/20 text-red-400">ด่วน</span>
                      )}
                      {ev.status === 'completed' && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/20 text-green-400">เสร็จ</span>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Item Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setSelectedItem(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-[15%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50 bg-[#1A1A1A] border border-[#333333] rounded-xl p-6 shadow-2xl max-h-[70vh] overflow-y-auto"
            >
              {(() => {
                const config = getTypeConfig(selectedItem.type);
                const Icon = config.icon;
                return (
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.color}/20`}>
                          <Icon className={`w-4 h-4 ${config.text}`} />
                        </div>
                        <span className={`text-sm font-medium ${config.text}`}>{config.label}</span>
                        {selectedItem.priority === 'high' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">ด่วน</span>
                        )}
                        {selectedItem.status === 'completed' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">เสร็จแล้ว</span>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedItem(null)}
                        className="p-1.5 rounded-lg hover:bg-[#2A2A2A] text-gray-500 hover:text-white transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-3">{selectedItem.title}</h3>

                    <div className="space-y-3">
                      {selectedItem.date && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-300">
                            {new Date(selectedItem.date + 'T00:00:00').toLocaleDateString('th-TH', {
                              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                            })}
                          </span>
                        </div>
                      )}
                      {selectedItem.time && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="w-4 h-4 text-center text-gray-500 text-xs leading-4">🕐</span>
                          <span className="text-gray-300">{selectedItem.time} น.</span>
                        </div>
                      )}
                      {selectedItem.description && (
                        <div className="bg-[#111111] rounded-lg p-3 border border-[#2A2A2A]">
                          <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedItem.description}</p>
                        </div>
                      )}

                      {selectedItem.checklist_items && selectedItem.checklist_items.length > 0 && (
                        <div className="border-t border-[#2A2A2A] pt-3">
                          <p className="text-xs text-gray-500 font-medium mb-2">
                            รายการ ({selectedItem.checklist_items.filter(i => i.completed).length}/{selectedItem.checklist_items.length})
                          </p>
                          <div className="space-y-2">
                            {selectedItem.checklist_items.map(item => (
                              <div key={item.id} className="flex items-center gap-2 text-sm">
                                <span className={item.completed ? 'text-green-500' : 'text-gray-500'}>
                                  {item.completed ? '✓' : '○'}
                                </span>
                                <span className={item.completed ? 'text-gray-500 line-through' : 'text-gray-200'}>
                                  {item.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedItem.source_message && (
                        <div className="border-t border-[#2A2A2A] pt-3">
                          <p className="text-xs text-gray-500 mb-1">ข้อความต้นทาง</p>
                          <p className="text-sm text-gray-400 italic">&quot;{selectedItem.source_message}&quot;</p>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
