'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, CheckSquare, StickyNote, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  priority?: string;
  type: 'event' | 'task' | 'note';
  description?: string;
  status?: string;
  source_message?: string;
  checklist_items?: Array<{ id: string; title: string; completed: boolean }>;
}

interface CalendarViewProps {
  events: CalendarEvent[];
}

const DAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MONTHS_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

function getTypeConfig(type: string) {
  switch (type) {
    case 'event': return { icon: Calendar, color: 'bg-[#00B900]', text: 'text-[#00B900]', label: 'นัดหมาย' };
    case 'task': return { icon: CheckSquare, color: 'bg-blue-500', text: 'text-blue-400', label: 'งาน' };
    case 'note': return { icon: StickyNote, color: 'bg-amber-500', text: 'text-amber-400', label: 'บันทึก' };
    default: return { icon: Calendar, color: 'bg-gray-500', text: 'text-gray-400', label: '' };
  }
}

export default function CalendarView({ events }: CalendarViewProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<CalendarEvent | null>(null);

  // จัด events ตามวันที่
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(e => {
      if (e.date) {
        const dateKey = e.date.split('T')[0];
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(e);
      }
    });
    return map;
  }, [events]);

  // สร้าง calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: Array<{ day: number; dateStr: string } | null> = [];

    // วันว่างก่อนวันที่ 1
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // วันในเดือน
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, dateStr });
    }

    return days;
  }, [currentMonth, currentYear]);

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          {MONTHS_TH[currentMonth]} {currentYear + 543}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-[#2A2A2A] hover:bg-[#333333] transition-colors"
          >
            วันนี้
          </button>
          <button
            onClick={goToPrevMonth}
            className="p-2 rounded-lg bg-[#2A2A2A] hover:bg-[#333333] text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg bg-[#2A2A2A] hover:bg-[#333333] text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-[#2A2A2A]">
          {DAYS_TH.map((day, i) => (
            <div
              key={day}
              className={`py-3 text-center text-xs font-medium ${
                i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Date Cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((cell, i) => {
            if (!cell) {
              return <div key={`empty-${i}`} className="min-h-[60px] md:min-h-[72px] border-b border-r border-[#2A2A2A] last:border-r-0" />;
            }

            const { day, dateStr } = cell;
            const dayEvents = eventsByDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`min-h-[60px] md:min-h-[72px] p-1.5 border-b border-r border-[#2A2A2A] last:border-r-0 text-left transition-colors relative ${
                  isSelected ? 'bg-[#00B900]/10' : 'hover:bg-[#222222]'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 text-xs sm:text-sm rounded-full ${
                    isToday
                      ? 'bg-[#00B900] text-white font-bold'
                      : dayOfWeek === 0
                        ? 'text-red-400'
                        : dayOfWeek === 6
                          ? 'text-blue-400'
                          : 'text-gray-300'
                  }`}
                >
                  {day}
                </span>

                {/* Event items - desktop: text, mobile: dots only */}
                {dayEvents.length > 0 && (
                  <>
                    {/* Mobile: dot indicators */}
                    <div className="mt-1 flex items-center gap-0.5 sm:hidden justify-center">
                      {dayEvents.slice(0, 4).map(ev => {
                        const config = getTypeConfig(ev.type);
                        return (
                          <div key={ev.id} className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
                        );
                      })}
                      {dayEvents.length > 4 && (
                        <span className="text-[10px] text-gray-500">+</span>
                      )}
                    </div>
                    {/* Desktop: text labels */}
                    <div className="mt-1 space-y-0.5 hidden sm:block">
                      {dayEvents.slice(0, 3).map(ev => {
                        const config = getTypeConfig(ev.type);
                        return (
                          <div
                            key={ev.id}
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItem(ev);
                            }}
                            className="flex items-center gap-1 px-1 rounded hover:bg-white/10 cursor-pointer transition-colors"
                          >
                            <div className={`w-1.5 h-1.5 rounded-full ${config.color} shrink-0`} />
                            <span className="text-[11px] text-gray-400 truncate leading-tight hover:text-white transition-colors">
                              {ev.title}
                            </span>
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className="text-[11px] text-gray-500 px-1">
                          +{dayEvents.length - 3}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
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
                    {/* Header */}
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

                    {/* Title */}
                    <h3 className="text-lg font-semibold text-white mb-3">{selectedItem.title}</h3>

                    {/* Details */}
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

                      {/* Checklist */}
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

                      {/* Source Message */}
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

      {/* Selected Date Detail */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('th-TH', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-1 rounded-lg hover:bg-[#2A2A2A] text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedEvents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">ไม่มีรายการในวันนี้</p>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map(ev => {
                  const config = getTypeConfig(ev.type);
                  const Icon = config.icon;
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedItem(ev)}
                      className="w-full flex items-start gap-3 p-3 rounded-lg bg-[#111111] border border-[#2A2A2A] hover:border-[#444444] hover:bg-[#1A1A1A] transition-colors text-left"
                    >
                      <div className={`mt-0.5 ${config.text}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs ${config.text}`}>{config.label}</span>
                          {ev.priority === 'high' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">ด่วน</span>
                          )}
                          {ev.status === 'completed' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">เสร็จ</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-white">{ev.title}</p>
                        {ev.time && (
                          <p className="text-xs text-gray-400 mt-0.5">{ev.time} น.</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-600 mt-1 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
