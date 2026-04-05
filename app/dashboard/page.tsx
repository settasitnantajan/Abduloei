import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserEvents } from '@/app/actions/events';
import { getUserTasks } from '@/app/actions/tasks';
import { getUserNotes } from '@/app/actions/notes';
import { getUserRoutines } from '@/app/actions/routines';
import { getUserMonthlyRoutines } from '@/app/actions/monthly-routines';
import DashboardTabs from '@/components/dashboard/DashboardTabs';
import Link from 'next/link';
import { Calendar, CheckSquare, StickyNote, Repeat, CalendarDays } from 'lucide-react';
import type { CalendarEvent } from '@/components/dashboard/CalendarView';

export const dynamic = 'force-dynamic';

// สร้างวันที่สำหรับ routines ที่ตรง days_of_week ใน N วันข้างหน้า
function generateRoutineDates(routine: { days_of_week: number[] }, days: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

  for (let i = 0; i < days; i++) {
    const d = new Date(bangkokNow);
    d.setDate(bangkokNow.getDate() + i);
    if (routine.days_of_week.includes(d.getDay())) {
      dates.push(d.toLocaleDateString('en-CA'));
    }
  }
  return dates;
}

// สร้างวันที่สำหรับ monthly routines ใน N เดือนข้างหน้า
function generateMonthlyRoutineDates(routine: { day_of_month: number }, months: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

  for (let m = 0; m < months; m++) {
    const year = bangkokNow.getFullYear();
    const month = bangkokNow.getMonth() + m;
    const d = new Date(year, month, 1);

    if (routine.day_of_month === 32) {
      // สิ้นเดือน
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(lastDay);
    } else {
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      if (routine.day_of_month > lastDay) continue;
      d.setDate(routine.day_of_month);
    }

    dates.push(d.toLocaleDateString('en-CA'));
  }
  return dates;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // ดึงข้อมูลทั้งหมดพร้อมกัน
  const [eventsResult, tasksResult, notesResult, routinesResult, monthlyRoutinesResult] = await Promise.all([
    getUserEvents(),
    getUserTasks(),
    getUserNotes(),
    getUserRoutines(),
    getUserMonthlyRoutines(),
  ]);

  // รวมทุกอย่างเป็น calendar events
  const calendarEvents: CalendarEvent[] = [
    ...(eventsResult.events || []).map(e => ({
      id: e.id,
      title: e.title,
      date: e.event_date || '',
      time: e.event_time || undefined,
      priority: e.priority,
      type: 'event' as const,
      description: e.description,
      status: e.status,
      source_message: e.source_message,
      checklist_items: e.checklist_items?.map(ci => ({
        id: ci.id,
        title: ci.title,
        completed: ci.completed,
      })),
    })),
    ...(tasksResult.tasks || []).map(t => ({
      id: t.id,
      title: t.title,
      date: t.due_date || t.created_at.split('T')[0],
      time: t.due_time || undefined,
      priority: t.priority,
      type: 'task' as const,
      description: t.description,
      status: t.status,
      source_message: t.source_message,
    })),
    ...(notesResult.notes || []).map(n => ({
      id: n.id,
      title: n.title,
      date: n.created_at.split('T')[0],
      type: 'note' as const,
      description: n.content,
      source_message: n.source_message,
    })),
    // Routines: แปลง days_of_week → วันที่จริงใน 60 วันข้างหน้า
    ...(routinesResult.routines || [])
      .filter(r => r.is_active)
      .flatMap(r => {
        return generateRoutineDates(r, 60).map(dateStr => ({
          id: `routine-${r.id}-${dateStr}`,
          title: r.title,
          date: dateStr,
          time: r.routine_time?.slice(0, 5),
          type: 'routine' as const,
          description: r.description,
        }));
      }),
    // Monthly Routines: แปลง day_of_month → วันที่จริง
    ...(monthlyRoutinesResult.routines || [])
      .filter(r => r.is_active)
      .flatMap(r => {
        return generateMonthlyRoutineDates(r, 3).map(dateStr => ({
          id: `monthly-${r.id}-${dateStr}`,
          title: r.title,
          date: dateStr,
          time: r.routine_time?.slice(0, 5),
          type: 'monthly_routine' as const,
          description: r.description,
        }));
      }),
  ];

  // นับสถิติ
  const totalEvents = eventsResult.events?.length || 0;
  const totalTasks = tasksResult.tasks?.length || 0;
  const pendingTasks = tasksResult.tasks?.filter(t => t.status === 'pending').length || 0;
  const totalNotes = notesResult.notes?.length || 0;
  const activeRoutines = routinesResult.routines?.filter(r => r.is_active).length || 0;
  const activeMonthlyRoutines = monthlyRoutinesResult.routines?.filter(r => r.is_active).length || 0;

  // เตรียม data สำหรับ TodayView
  const now = new Date();
  const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const todayStr = bangkokNow.toLocaleDateString('en-CA');
  const todayDow = bangkokNow.getDay();
  const todayDom = bangkokNow.getDate();
  const lastDayOfMonth = new Date(bangkokNow.getFullYear(), bangkokNow.getMonth() + 1, 0).getDate();
  const isLastDay = todayDom === lastDayOfMonth;

  const tomorrow = new Date(bangkokNow);
  tomorrow.setDate(bangkokNow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA');
  const tomorrowDow = tomorrow.getDay();

  const todayEvents: CalendarEvent[] = (eventsResult.events || [])
    .filter(e => e.event_date === todayStr)
    .map(e => ({
      id: e.id,
      title: e.title,
      date: e.event_date || '',
      time: e.event_time?.slice(0, 5) || undefined,
      priority: e.priority,
      type: 'event' as const,
      description: e.description,
      status: e.status,
    }));

  const todayTasks: CalendarEvent[] = (tasksResult.tasks || [])
    .filter(t => t.status === 'pending' && t.due_date === todayStr)
    .map(t => ({
      id: t.id,
      title: t.title,
      date: t.due_date || '',
      time: t.due_time?.slice(0, 5) || undefined,
      priority: t.priority,
      type: 'task' as const,
      description: t.description,
      status: t.status,
    }));

  const todayRoutines: CalendarEvent[] = (routinesResult.routines || [])
    .filter(r => r.is_active && r.days_of_week.includes(todayDow))
    .map(r => ({
      id: `routine-${r.id}-${todayStr}`,
      title: r.title,
      date: todayStr,
      time: r.routine_time?.slice(0, 5),
      type: 'routine' as const,
      description: r.description,
    }));

  const matchDays = isLastDay ? [todayDom, 32] : [todayDom];
  const todayMonthlyRoutines: CalendarEvent[] = (monthlyRoutinesResult.routines || [])
    .filter(r => r.is_active && matchDays.includes(r.day_of_month))
    .map(r => ({
      id: `monthly-${r.id}-${todayStr}`,
      title: r.title,
      date: todayStr,
      time: r.routine_time?.slice(0, 5),
      type: 'monthly_routine' as const,
      description: r.description,
    }));

  // พรุ่งนี้: events + routines
  const tomorrowItems: CalendarEvent[] = [
    ...(eventsResult.events || [])
      .filter(e => e.event_date === tomorrowStr)
      .map(e => ({
        id: e.id,
        title: e.title,
        date: tomorrowStr,
        time: e.event_time?.slice(0, 5) || undefined,
        type: 'event' as const,
        description: e.description,
      })),
    ...(routinesResult.routines || [])
      .filter(r => r.is_active && r.days_of_week.includes(tomorrowDow))
      .map(r => ({
        id: `routine-${r.id}-${tomorrowStr}`,
        title: r.title,
        date: tomorrowStr,
        time: r.routine_time?.slice(0, 5),
        type: 'routine' as const,
        description: r.description,
      })),
  ];

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">ภาพรวม</h1>
          <p className="text-gray-400 text-sm">ภาพรวมกิจกรรมของคุณ</p>
        </div>

        {/* Stats — กดไปหน้าแต่ละโหมด */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <Link href="/events" className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 flex items-center gap-3 hover:border-[#00B900]/50 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-[#00B900]/20 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-[#00B900]" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{totalEvents}</p>
              <p className="text-xs text-gray-500">นัดหมาย</p>
            </div>
          </Link>
          <Link href="/tasks" className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 flex items-center gap-3 hover:border-blue-500/50 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
              <CheckSquare className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{pendingTasks}<span className="text-gray-500 text-sm font-normal">/{totalTasks}</span></p>
              <p className="text-xs text-gray-500">งานรอทำ</p>
            </div>
          </Link>
          <Link href="/notes" className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 flex items-center gap-3 hover:border-amber-500/50 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <StickyNote className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{totalNotes}</p>
              <p className="text-xs text-gray-500">บันทึก</p>
            </div>
          </Link>
          <Link href="/routines" className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 flex items-center gap-3 hover:border-purple-500/50 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
              <Repeat className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{activeRoutines}</p>
              <p className="text-xs text-gray-500">กิจวัตร</p>
            </div>
          </Link>
          <Link href="/monthly-routines" className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 flex items-center gap-3 hover:border-pink-500/50 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{activeMonthlyRoutines}</p>
              <p className="text-xs text-gray-500">รายเดือน</p>
            </div>
          </Link>
        </div>

        {/* Calendar / Timeline / Today Tabs */}
        <DashboardTabs
          events={calendarEvents}
          todayEvents={todayEvents}
          todayTasks={todayTasks}
          todayRoutines={todayRoutines}
          todayMonthlyRoutines={todayMonthlyRoutines}
          tomorrowItems={tomorrowItems}
        />
      </div>
    </div>
  );
}
