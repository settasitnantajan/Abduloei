import { createClient } from '@/lib/supabase/server';
import { getChatMessages } from '@/lib/db/chat';
import { getUserEvents } from '@/lib/db/events';
import { retrieveMemories } from '@/lib/db/memories';
import { formatMemoriesForAI } from '@/lib/ai/memory-utils';

export interface AIContext {
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  upcomingEvents: Array<{
    title: string;
    date: string;
    time?: string;
    daysUntil: number;
  }>;
  pendingTasks: Array<{
    title: string;
    priority?: string;
  }>;
  userPreferences?: Record<string, unknown>;
  conversationSummary?: string;
  memories?: string; // Formatted memories for AI
}

/**
 * สร้าง context สำหรับ AI โดยรวบรวมข้อมูลที่เกี่ยวข้อง
 * ใช้ก่อนที่จะ generate AI response
 */
export async function buildAIContext(
  conversationId: string,
  currentUserMessage: string,
  messageLimit = 50
): Promise<AIContext> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        recentMessages: [],
        upcomingEvents: [],
        pendingTasks: [],
      };
    }

    // 1. ดึงข้อความล่าสุด 50 ข้อความ (เพิ่มจาก 10 เป็น 50)
    const { messages } = await getChatMessages(conversationId, messageLimit);
    const recentMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // 2. ดึง Events ที่กำลังจะมาถึง (7 วันข้างหน้า)
    const { events } = await getUserEvents();
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    const upcomingEvents = (events || [])
      .filter(event => {
        if (!event.event_date) return false;
        const eventDate = new Date(event.event_date);
        return eventDate >= now && eventDate <= sevenDaysLater;
      })
      .map(event => {
        const eventDate = new Date(event.event_date!);
        const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          title: event.title,
          date: event.event_date!, // Already filtered out null/undefined above
          time: event.event_time || undefined,
          daysUntil,
        };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5); // แสดงแค่ 5 events ที่ใกล้ที่สุด

    // 3. ดึง Pending Tasks (จาก event checklist items ที่ยังไม่เสร็จ)
    const pendingTasks: Array<{ title: string; priority?: string }> = [];
    if (events && events.length > 0) {
      events.forEach(event => {
        if (event.checklist_items && Array.isArray(event.checklist_items)) {
          event.checklist_items.forEach((item: any) => {
            if (!item.completed) {
              pendingTasks.push({
                title: `${item.title} (${event.title})`,
                priority: event.priority,
              });
            }
          });
        }
      });
    }

    // 4. ดึง Long-term memories ของ user
    const { memories: userMemories } = await retrieveMemories(user.id);
    const formattedMemories = userMemories.length > 0 ? formatMemoriesForAI(userMemories) : undefined;

    // User preferences (legacy support)
    const userPreferences = {};

    // 5. สร้าง conversation summary (ถ้าข้อความมีมากกว่า 20 ข้อความ)
    let conversationSummary: string | undefined;
    if (recentMessages.length > 20) {
      // คร่าวๆ วิเคราะห์ theme ของการสนทนา
      const topics: string[] = [];

      // ดูว่ามีการพูดถึง events, tasks, หรือ notes บ้างไหม
      const conversationText = recentMessages.map(m => m.content).join(' ').toLowerCase();
      if (conversationText.includes('นัดหมาย') || conversationText.includes('event')) {
        topics.push('นัดหมาย');
      }
      if (conversationText.includes('งาน') || conversationText.includes('task')) {
        topics.push('งาน');
      }
      if (conversationText.includes('บันทึก') || conversationText.includes('note')) {
        topics.push('บันทึก');
      }

      if (topics.length > 0) {
        conversationSummary = `การสนทนาล่าสุดเกี่ยวกับ: ${topics.join(', ')}`;
      } else {
        conversationSummary = 'การสนทนาทั่วไป';
      }
    }

    return {
      recentMessages,
      upcomingEvents,
      pendingTasks: pendingTasks.slice(0, 10), // แสดงแค่ 10 tasks แรก
      userPreferences,
      conversationSummary,
      memories: formattedMemories,
    };
  } catch (error) {
    console.error('Error building AI context:', error);
    return {
      recentMessages: [],
      upcomingEvents: [],
      pendingTasks: [],
    };
  }
}

// Re-export utility functions from context-utils
export { contextToPrompt, detectUserEmotion } from './context-utils';
