import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserEvents } from '@/app/actions/events';
import { getUserTasks } from '@/app/actions/tasks';
import { getUserRoutines } from '@/app/actions/routines';
import { getUserMonthlyRoutines } from '@/app/actions/monthly-routines';
import CountdownBoard from '@/components/dashboard/CountdownBoard';
import {
  bangkokToEpoch,
  nextDailyOccurrence,
  nextMonthlyOccurrence,
  describeDays,
  formatThaiDateTime,
  type CountdownItem,
} from '@/lib/utils/countdown';

export const dynamic = 'force-dynamic';

/**
 * ดึงข้อมูลทุกชนิดแล้วแปลงเป็นรายการนับถอยหลังชุดเดียว
 *
 * แยกออกจาก component เพราะต้องอ่านนาฬิกา (Date.now) เพื่อหารอบถัดไปของกิจวัตร
 * — งานที่ขึ้นกับเวลาแบบนี้ไม่ควรอยู่ใน render body
 */
async function buildCountdownItems(): Promise<CountdownItem[]> {
  const [eventsResult, tasksResult, routinesResult, monthlyRoutinesResult] = await Promise.all([
    getUserEvents(),
    getUserTasks(),
    getUserRoutines(),
    getUserMonthlyRoutines(),
  ]);

  // ใช้เวลาเดียวกันตลอดการคำนวณ เพื่อให้ผลลัพธ์สอดคล้องกัน
  const now = Date.now();
  const items: CountdownItem[] = [];

  // นัดหมาย — ต้องมีวันที่ถึงจะนับถอยหลังได้
  for (const e of eventsResult.events || []) {
    if (e.status === 'completed' || e.status === 'cancelled') continue;
    const targetMs = bangkokToEpoch(e.event_date, e.event_time);
    if (targetMs === null) continue;
    items.push({
      id: e.id,
      title: e.title,
      description: e.description,
      kind: 'event',
      targetMs,
      scheduleLabel: formatThaiDateTime(targetMs),
    });
  }

  // งาน — เฉพาะที่ยังไม่เสร็จและมีกำหนดส่ง
  for (const t of tasksResult.tasks || []) {
    if (t.status !== 'pending') continue;
    const targetMs = bangkokToEpoch(t.due_date, t.due_time);
    if (targetMs === null) continue;
    items.push({
      id: t.id,
      title: t.title,
      description: t.description,
      kind: 'task',
      targetMs,
      scheduleLabel: formatThaiDateTime(targetMs),
    });
  }

  // กิจวัตรรายวัน — คำนวณรอบถัดไปจากวันในสัปดาห์
  for (const r of routinesResult.routines || []) {
    if (!r.is_active) continue;
    const targetMs = nextDailyOccurrence(r.routine_time, r.days_of_week, now);
    if (targetMs === null) continue;
    items.push({
      id: r.id,
      title: r.title,
      description: r.description,
      kind: 'routine',
      targetMs,
      scheduleLabel: `${describeDays(r.days_of_week)} · ${r.routine_time.slice(0, 5)}`,
      remindBeforeMinutes: r.remind_before_minutes,
    });
  }

  // กิจวัตรรายเดือน — คำนวณรอบถัดไปจากวันที่ของเดือน
  for (const r of monthlyRoutinesResult.routines || []) {
    if (!r.is_active) continue;
    const targetMs = nextMonthlyOccurrence(r.routine_time, r.day_of_month, now);
    if (targetMs === null) continue;
    items.push({
      id: r.id,
      title: r.title,
      description: r.description,
      kind: 'monthly_routine',
      targetMs,
      scheduleLabel: `ทุกวันที่ ${r.day_of_month} · ${r.routine_time.slice(0, 5)}`,
      remindBeforeMinutes: r.remind_before_minutes,
    });
  }

  return items;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const items = await buildCountdownItems();

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <CountdownBoard items={items} />
      </div>
    </div>
  );
}
