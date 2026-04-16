import { createClient } from '@/lib/supabase/server';
import {
  Event,
  CreateEventInput,
} from '@/lib/types/events';

/**
 * สร้าง Event พร้อม Checklist Items
 */
export async function createEventWithChecklist(
  data: CreateEventInput
): Promise<{ success: boolean; event?: Event; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        user_id: user.id,
        title: data.title,
        description: data.description,
        event_date: data.event_date,
        event_time: data.event_time,
        location: data.location,
        priority: data.priority || 'medium',
        status: 'pending',
        source_message: data.source_message,
      })
      .select()
      .single();

    if (eventError) {
      console.error('Error creating event:', eventError);
      return { success: false, error: 'ไม่สามารถสร้าง event ได้' };
    }

    if (data.checklist_items && data.checklist_items.length > 0) {
      const checklistItems = data.checklist_items.map((item, index) => ({
        event_id: event.id,
        title: item.title,
        assignee: item.assignee,
        order_index: index,
        completed: false
      }));

      const { error: checklistError } = await supabase
        .from('event_checklist_items')
        .insert(checklistItems);

      if (checklistError) {
        console.error('Error creating checklist items:', checklistError);
        return {
          success: true,
          event,
          error: 'สร้าง event สำเร็จ แต่ checklist items มีปัญหา'
        };
      }

      const { data: eventWithChecklist } = await supabase
        .from('events')
        .select(`
          *,
          checklist_items:event_checklist_items(*)
        `)
        .eq('id', event.id)
        .single();

      return { success: true, event: eventWithChecklist || event };
    }

    return { success: true, event };
  } catch (error) {
    console.error('Unexpected error in createEventWithChecklist:', error);
    return { success: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

/**
 * ดึงรายการ Events ทั้งหมดของ User
 */
export async function getUserEvents(): Promise<{ events?: Event[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: events, error: fetchError } = await supabase
      .from('events')
      .select(`
        *,
        checklist_items:event_checklist_items(*)
      `)
      .eq('user_id', user.id)
      .order('event_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching events:', fetchError);
      return { error: 'ไม่สามารถดึงข้อมูล events ได้' };
    }

    return { events: events || [] };
  } catch (error) {
    console.error('Unexpected error in getUserEvents:', error);
    return { error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

/**
 * แก้ไข Event ที่มีอยู่
 */
export async function updateEvent(
  eventId: string,
  updates: { title?: string; event_date?: string; event_time?: string; description?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    // กรองเฉพาะ field ที่มีค่า
    const cleanUpdates: Record<string, string> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        cleanUpdates[key] = value;
      }
    }

    if (Object.keys(cleanUpdates).length === 0) {
      return { success: false, error: 'ไม่มีข้อมูลที่ต้องแก้ไข' };
    }

    const { error } = await supabase
      .from('events')
      .update(cleanUpdates)
      .eq('id', eventId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating event:', error);
      return { success: false, error: 'ไม่สามารถแก้ไข event ได้' };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error in updateEvent:', error);
    return { success: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

/**
 * ลบ Event เดี่ยวตาม ID
 */
export async function deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: 'เกิดข้อผิดพลาด' };
  }
}

/**
 * ลบ Events ตาม filter (วันที่ และ/หรือ ชื่อ)
 */
export async function deleteEventsByFilter(filterDate?: string, titleKeyword?: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, count: 0, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    let query = supabase.from('events').select('id, title').eq('user_id', user.id);
    if (filterDate) {
      query = query.eq('event_date', filterDate);
    }
    if (titleKeyword) {
      query = query.ilike('title', `%${titleKeyword}%`);
    }

    const { data: events } = await query;

    if (events && events.length > 0) {
      const eventIds = events.map(e => e.id);
      await supabase.from('event_checklist_items').delete().in('event_id', eventIds);
      await supabase.from('events').delete().in('id', eventIds);
    }

    return { success: true, count: events?.length || 0 };
  } catch (error) {
    console.error('Unexpected error in deleteEventsByFilter:', error);
    return { success: false, count: 0, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

/**
 * ลบ Events ทั้งหมดของ User
 */
export async function deleteAllEvents(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, count: 0, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    // ดึง event ids เพื่อลบ checklist items ก่อน
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', user.id);

    if (events && events.length > 0) {
      const eventIds = events.map(e => e.id);
      await supabase
        .from('event_checklist_items')
        .delete()
        .in('event_id', eventIds);
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting all events:', error);
      return { success: false, count: 0, error: 'ไม่สามารถลบนัดหมายได้' };
    }

    return { success: true, count: events?.length || 0 };
  } catch (error) {
    console.error('Unexpected error in deleteAllEvents:', error);
    return { success: false, count: 0, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}
