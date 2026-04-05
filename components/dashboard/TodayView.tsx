'use client';

import { useState } from 'react';
import { Calendar, CheckSquare, Repeat, CalendarDays, ChevronRight, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CalendarEvent } from './CalendarView';

interface TodayViewProps {
  todayEvents: CalendarEvent[];
  todayTasks: CalendarEvent[];
  todayRoutines: CalendarEvent[];
  todayMonthlyRoutines: CalendarEvent[];
  tomorrowItems: CalendarEvent[];
}

const DAYS_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const MONTHS_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

function getTypeConfig(type: string) {
  switch (type) {
    case 'event': return { icon: Calendar, color: 'bg-[#00B900]', bg: 'bg-green-900/30', text: 'text-[#00B900]', label: 'นัดหมาย' };
    case 'task': return { icon: CheckSquare, color: 'bg-blue-500', bg: 'bg-blue-900/30', text: 'text-blue-400', label: 'งาน' };
    case 'routine': return { icon: Repeat, color: 'bg-purple-500', bg: 'bg-purple-900/30', text: 'text-purple-400', label: 'กิจวัตร' };
    case 'monthly_routine': return { icon: CalendarDays, color: 'bg-pink-500', bg: 'bg-pink-900/30', text: 'text-pink-400', label: 'รายเดือน' };
    default: return { icon: Calendar, color: 'bg-gray-500', bg: 'bg-gray-800/30', text: 'text-gray-400', label: '' };
  }
}

function Section({ title, emoji, count, children }: { title: string; emoji: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{emoji}</span>
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
        <span className="text-xs text-gray-500">({count})</span>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function ItemCard({ item, onClick }: { item: CalendarEvent; onClick: () => void }) {
  const config = getTypeConfig(item.type);
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#111111] border border-[#2A2A2A] hover:border-[#444444] hover:bg-[#1A1A1A] transition-colors text-left group"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${config.bg} shrink-0`}>
        <Icon className={`w-4 h-4 ${config.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate group-hover:text-[#00B900] transition-colors">
          {item.title}
        </p>
        {item.description && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{item.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.time && (
          <span className="text-xs text-gray-400 font-mono">{item.time} น.</span>
        )}
        {item.priority === 'high' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">ด่วน</span>
        )}
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
      </div>
    </button>
  );
}

export default function TodayView({ todayEvents, todayTasks, todayRoutines, todayMonthlyRoutines, tomorrowItems }: TodayViewProps) {
  const [selectedItem, setSelectedItem] = useState<CalendarEvent | null>(null);

  const today = new Date();
  const bangkokToday = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const dayName = DAYS_TH[bangkokToday.getDay()];
  const day = bangkokToday.getDate();
  const month = MONTHS_TH[bangkokToday.getMonth()];
  const year = bangkokToday.getFullYear() + 543;

  const totalItems = todayEvents.length + todayTasks.length + todayRoutines.length + todayMonthlyRoutines.length;

  // sort by time
  const sortByTime = (a: CalendarEvent, b: CalendarEvent) => (a.time || '99:99').localeCompare(b.time || '99:99');
  const sortedRoutines = [...todayRoutines].sort(sortByTime);
  const sortedEvents = [...todayEvents].sort(sortByTime);
  const sortedTasks = [...todayTasks].sort(sortByTime);
  const sortedMonthly = [...todayMonthlyRoutines].sort(sortByTime);
  const sortedTomorrow = [...tomorrowItems].sort(sortByTime);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-5">
        <div className="flex items-center gap-3 mb-1">
          <Clock className="w-5 h-5 text-[#00B900]" />
          <h2 className="text-lg font-bold text-white">
            วัน{dayName}ที่ {day} {month} {year}
          </h2>
        </div>
        {totalItems > 0 ? (
          <p className="text-sm text-gray-400 ml-8">
            {totalItems} รายการวันนี้
          </p>
        ) : (
          <p className="text-sm text-gray-500 ml-8">
            วันนี้ว่างๆ ไม่มีนัด ไม่มีงาน
          </p>
        )}
      </div>

      {/* Content */}
      <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-5">
        {totalItems === 0 && tomorrowItems.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-lg mb-1">วันนี้ว่างๆ</p>
            <p className="text-gray-600 text-sm">ไม่มีนัด ไม่มีงาน ไม่มีกิจวัตร</p>
          </div>
        ) : (
          <>
            <Section title="กิจวัตร" emoji="⏰" count={sortedRoutines.length}>
              {sortedRoutines.map(item => (
                <ItemCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
              ))}
            </Section>

            <Section title="นัดหมาย" emoji="📌" count={sortedEvents.length}>
              {sortedEvents.map(item => (
                <ItemCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
              ))}
            </Section>

            <Section title="งานวันนี้" emoji="📋" count={sortedTasks.length}>
              {sortedTasks.map(item => (
                <ItemCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
              ))}
            </Section>

            <Section title="กิจวัตรรายเดือน" emoji="📅" count={sortedMonthly.length}>
              {sortedMonthly.map(item => (
                <ItemCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
              ))}
            </Section>

            {sortedTomorrow.length > 0 && (
              <Section title="พรุ่งนี้" emoji="🔜" count={sortedTomorrow.length}>
                {sortedTomorrow.map(item => (
                  <ItemCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
                ))}
              </Section>
            )}
          </>
        )}
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
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bg}`}>
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
