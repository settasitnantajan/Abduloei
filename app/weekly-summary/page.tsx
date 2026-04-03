import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserEvents } from '@/app/actions/events';
import { getUserTasks } from '@/app/actions/tasks';
import { Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export default async function WeeklySummaryPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const { events } = await getUserEvents();
  const { tasks } = await getUserTasks();

  const now = new Date();
  const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const dayOfWeek = bangkokNow.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(bangkokNow);
  monday.setDate(bangkokNow.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const mondayStr = monday.toLocaleDateString('en-CA');
  const sundayStr = sunday.toLocaleDateString('en-CA');

  // Next week
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  const nextMondayStr = nextMonday.toLocaleDateString('en-CA');
  const nextSundayStr = nextSunday.toLocaleDateString('en-CA');

  const thisWeekEvents = events?.filter(e =>
    e.event_date && e.event_date >= mondayStr && e.event_date <= sundayStr
  ) || [];

  const nextWeekEvents = events?.filter(e =>
    e.event_date && e.event_date >= nextMondayStr && e.event_date <= nextSundayStr
  ) || [];

  const pendingTasks = tasks?.filter(t => t.status === 'pending') || [];
  const completedTasks = tasks?.filter(t => t.status === 'completed') || [];

  const formatThaiDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      weekday: 'short', day: 'numeric', month: 'short'
    });
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">สรุปรายสัปดาห์</h1>
          <p className="text-gray-400 text-sm">
            {formatThaiDate(mondayStr)} — {formatThaiDate(sundayStr)}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-[#00B900]">{thisWeekEvents.length}</p>
            <p className="text-xs text-gray-400 mt-1">นัดสัปดาห์นี้</p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{pendingTasks.length}</p>
            <p className="text-xs text-gray-400 mt-1">งานค้าง</p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{completedTasks.length}</p>
            <p className="text-xs text-gray-400 mt-1">ทำเสร็จ</p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{nextWeekEvents.length}</p>
            <p className="text-xs text-gray-400 mt-1">สัปดาห์หน้า</p>
          </div>
        </div>

        {/* นัดหมายสัปดาห์นี้ */}
        <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 md:p-5 mb-4">
          <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#00B900]" />
            นัดหมายสัปดาห์นี้
          </h2>
          {thisWeekEvents.length > 0 ? (
            <div className="space-y-2">
              {thisWeekEvents.map(e => (
                <div key={e.id} className="flex items-center gap-3 bg-[#111] rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-400 w-16 flex-shrink-0">{formatThaiDate(e.event_date!)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{e.title}</p>
                  </div>
                  {e.event_time && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {e.event_time.slice(0, 5)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">สัปดาห์นี้ไม่มีนัดหมาย</p>
          )}
        </div>

        {/* งานค้าง */}
        {pendingTasks.length > 0 && (
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 md:p-5 mb-4">
            <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-400" />
              งานค้าง
            </h2>
            <div className="space-y-2">
              {pendingTasks.slice(0, 10).map(t => (
                <div key={t.id} className="flex items-center gap-3 bg-[#111] rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{t.title}</p>
                  </div>
                  {t.due_date && (
                    <span className="text-xs text-gray-500">{formatThaiDate(t.due_date)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* สัปดาห์หน้า */}
        {nextWeekEvents.length > 0 && (
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 md:p-5 mb-4">
            <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              สัปดาห์หน้า
            </h2>
            <div className="space-y-2">
              {nextWeekEvents.map(e => (
                <div key={e.id} className="flex items-center gap-3 bg-[#111] rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-400 w-16 flex-shrink-0">{formatThaiDate(e.event_date!)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{e.title}</p>
                  </div>
                  {e.event_time && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {e.event_time.slice(0, 5)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* งานที่เสร็จ */}
        {completedTasks.length > 0 && (
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 md:p-5">
            <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              ทำเสร็จแล้ว
            </h2>
            <div className="space-y-2">
              {completedTasks.slice(0, 10).map(t => (
                <div key={t.id} className="flex items-center gap-3 bg-[#111] rounded-lg px-3 py-2.5">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <p className="text-sm text-gray-400 truncate line-through">{t.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
