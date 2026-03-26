import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserEvents } from '@/app/actions/events';
import { getUserTasks } from '@/app/actions/tasks';
import { getUserNotes } from '@/app/actions/notes';
import DashboardTabs from '@/components/dashboard/DashboardTabs';
import Link from 'next/link';
import { Calendar, CheckSquare, StickyNote } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // ดึงข้อมูลทั้ง 3 แบบพร้อมกัน
  const [eventsResult, tasksResult, notesResult] = await Promise.all([
    getUserEvents(),
    getUserTasks(),
    getUserNotes(),
  ]);

  // รวมทุกอย่างเป็น calendar events
  const calendarEvents = [
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
  ];

  // นับสถิติ
  const totalEvents = eventsResult.events?.length || 0;
  const totalTasks = tasksResult.tasks?.length || 0;
  const pendingTasks = tasksResult.tasks?.filter(t => t.status === 'pending').length || 0;
  const totalNotes = notesResult.notes?.length || 0;

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">ภาพรวม</h1>
          <p className="text-gray-400 text-sm">ภาพรวมกิจกรรมของคุณ</p>
        </div>

        {/* Stats — กดไปหน้าแต่ละโหมด */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
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
        </div>

        {/* Calendar / Timeline Tabs */}
        <DashboardTabs events={calendarEvents} />
      </div>
    </div>
  );
}
