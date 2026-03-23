'use server';

import { createClient } from '@/lib/supabase/server';
import { generateAIResponse } from '@/lib/ai/gemini';

/**
 * Generate daily morning summary for user
 */
export async function generateDailySummary(userId: string): Promise<string> {
  const supabase = await createClient();

  // Get today's events
  const today = new Date().toISOString().split('T')[0];
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .eq('event_date', today)
    .order('event_time');

  // Get pending tasks
  const { data: tasks } = await supabase
    .from('event_checklist_items')
    .select('*, events!inner(*)')
    .eq('events.user_id', userId)
    .eq('completed', false)
    .limit(5);

  let summary = '🌅 **สรุปวันนี้**\n\n';

  if (events && events.length > 0) {
    summary += `มีนัดหมาย ${events.length} รายการ:\n`;
    events.forEach(e => {
      summary += `- ${e.title}`;
      if (e.event_time) {
        summary += ` (${e.event_time})`;
      }
      summary += '\n';
    });
  } else {
    summary += 'วันนี้ไม่มีนัดหมายค่ะ\n';
  }

  if (tasks && tasks.length > 0) {
    summary += `\nมีงานที่ค้าง ${tasks.length} รายการ\n`;
  }

  summary += '\nขอให้เป็นวันที่ดีนะคะ! 😊';

  return summary;
}

/**
 * Generate reminders for upcoming events
 */
export async function generateReminders(userId: string): Promise<string[]> {
  const supabase = await createClient();

  // Get events happening in next 24 hours
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: upcomingEvents } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .gte('event_date', now.toISOString().split('T')[0])
    .lte('event_date', tomorrow.toISOString().split('T')[0])
    .order('event_date', { ascending: true });

  const reminders: string[] = [];

  if (upcomingEvents) {
    for (const event of upcomingEvents) {
      const reminderText = `⏰ เตือน: ${event.title}`;
      if (event.event_date) {
        const eventDate = new Date(event.event_date);
        const isToday = eventDate.toDateString() === now.toDateString();
        const dateText = isToday ? 'วันนี้' : 'พรุ่งนี้';
        reminders.push(`${reminderText} (${dateText}${event.event_time ? ` ${event.event_time}` : ''})`);
      } else {
        reminders.push(reminderText);
      }
    }
  }

  return reminders;
}

/**
 * Generate smart suggestions based on patterns
 */
export async function generateSuggestions(userId: string): Promise<string> {
  const supabase = await createClient();

  // Get user's recent activity patterns
  const hour = new Date().getHours();

  // Morning suggestions (6 AM - 12 PM)
  if (hour >= 6 && hour < 12) {
    // Check if user has morning events
    const today = new Date().toISOString().split('T')[0];
    const { data: morningEvents } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .eq('event_date', today)
      .limit(1);

    if (morningEvents && morningEvents.length > 0) {
      return 'อย่าลืมเตรียมตัวสำหรับนัดหมายวันนี้นะคะ 😊';
    } else {
      return 'สวัสดีตอนเช้าค่ะ อย่าลืมดื่มน้ำนะคะ 💧';
    }
  }

  // Afternoon suggestions (12 PM - 6 PM)
  if (hour >= 12 && hour < 18) {
    return 'พักผ่อนบ้างนะคะ ถึงเวลาพักเที่ยงแล้ว 🍽️';
  }

  // Evening suggestions (6 PM - 10 PM)
  if (hour >= 18 && hour < 22) {
    // Check for incomplete tasks
    const { data: tasks } = await supabase
      .from('event_checklist_items')
      .select('*, events!inner(*)')
      .eq('events.user_id', userId)
      .eq('completed', false)
      .limit(1);

    if (tasks && tasks.length > 0) {
      return 'ถึงเวลาพักผ่อนแล้ว อยากจัดการงานพรุ่งนี้ไหมคะ? 📝';
    } else {
      return 'ดีใจที่งานวันนี้เสร็จแล้ว พักผ่อนให้เต็มที่นะคะ 🌙';
    }
  }

  // Night suggestions (10 PM - 6 AM)
  if (hour >= 22 || hour < 6) {
    return 'ถึงเวลานอนแล้ว พรุ่งนี้เจอกันใหม่นะคะ ราตรีสวัสดิ์ 😴';
  }

  return '';
}

/**
 * Schedule a proactive action
 */
export async function scheduleAction(
  userId: string,
  actionType: 'reminder' | 'daily_summary' | 'suggestion',
  scheduleTime: Date,
  content: string,
  recurrence?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('ai_scheduled_actions')
      .insert({
        user_id: userId,
        action_type: actionType,
        schedule_time: scheduleTime.toISOString(),
        content,
        recurrence,
      });

    if (error) {
      console.error('Error scheduling action:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error scheduling action:', error);
    return { success: false, error: 'เกิดข้อผิดพลาด' };
  }
}

/**
 * Get pending scheduled actions
 */
export async function getPendingActions(userId: string): Promise<{
  actions: Array<{
    id: string;
    action_type: string;
    schedule_time: string;
    content: string;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('ai_scheduled_actions')
      .select('*')
      .eq('user_id', userId)
      .eq('executed', false)
      .lte('schedule_time', now)
      .order('schedule_time', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Error getting pending actions:', error);
      return { actions: [], error: error.message };
    }

    return { actions: data || [] };
  } catch (error) {
    console.error('Unexpected error getting pending actions:', error);
    return { actions: [], error: 'เกิดข้อผิดพลาด' };
  }
}

/**
 * Mark action as executed
 */
export async function markActionExecuted(actionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('ai_scheduled_actions')
      .update({
        executed: true,
        executed_at: new Date().toISOString(),
      })
      .eq('id', actionId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'เกิดข้อผิดพลาด' };
  }
}
