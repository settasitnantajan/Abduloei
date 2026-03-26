'use server'

import { createClient } from '@/lib/supabase/server'
import {
  Event,
  EventChecklistItem,
  UpdateChecklistItemInput
} from '@/lib/types/events'

import * as eventsDb from '@/lib/db/events'
import { CreateEventInput } from '@/lib/types/events'

export async function createEventWithChecklist(data: CreateEventInput) {
  return eventsDb.createEventWithChecklist(data)
}

export async function getUserEvents() {
  return eventsDb.getUserEvents()
}

export async function deleteEvent(eventId: string) {
  return eventsDb.deleteEvent(eventId)
}

/**
 * อัพเดท Checklist Item (toggle completed, แก้ title, หรือ assignee)
 */
export async function updateChecklistItem(
  itemId: string,
  data: UpdateChecklistItemInput
): Promise<{ success: boolean; item?: EventChecklistItem; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }
    }

    const { data: item, error: checkError } = await supabase
      .from('event_checklist_items')
      .select(`
        *,
        event:events!inner(user_id)
      `)
      .eq('id', itemId)
      .single()

    if (checkError || !item) {
      return { success: false, error: 'ไม่พบ checklist item นี้' }
    }

    // @ts-ignore - Supabase nested select
    if (item.event.user_id !== user.id) {
      return { success: false, error: 'คุณไม่มีสิทธิ์แก้ไข item นี้' }
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from('event_checklist_items')
      .update(data)
      .eq('id', itemId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating checklist item:', updateError)
      return { success: false, error: 'ไม่สามารถอัพเดท checklist item ได้' }
    }

    return { success: true, item: updatedItem }
  } catch (error) {
    console.error('Unexpected error in updateChecklistItem:', error)
    return { success: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' }
  }
}

/**
 * เพิ่ม Checklist Item ใหม่ให้กับ Event
 */
export async function addChecklistItem(
  eventId: string,
  title: string,
  assignee?: string
): Promise<{ success: boolean; item?: EventChecklistItem; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }
    }

    const { data: event, error: checkError } = await supabase
      .from('events')
      .select('id, user_id')
      .eq('id', eventId)
      .single()

    if (checkError || !event) {
      return { success: false, error: 'ไม่พบ event นี้' }
    }

    if (event.user_id !== user.id) {
      return { success: false, error: 'คุณไม่มีสิทธิ์เพิ่ม checklist item ให้ event นี้' }
    }

    const { data: existingItems } = await supabase
      .from('event_checklist_items')
      .select('order_index')
      .eq('event_id', eventId)
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrderIndex = existingItems && existingItems.length > 0
      ? existingItems[0].order_index + 1
      : 0

    const { data: newItem, error: insertError } = await supabase
      .from('event_checklist_items')
      .insert({
        event_id: eventId,
        title,
        assignee,
        order_index: nextOrderIndex,
        completed: false
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error adding checklist item:', insertError)
      return { success: false, error: 'ไม่สามารถเพิ่ม checklist item ได้' }
    }

    return { success: true, item: newItem }
  } catch (error) {
    console.error('Unexpected error in addChecklistItem:', error)
    return { success: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' }
  }
}

/**
 * ลบ Checklist Item
 */
export async function deleteChecklistItem(
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }
    }

    const { data: item, error: checkError } = await supabase
      .from('event_checklist_items')
      .select(`
        *,
        event:events!inner(user_id)
      `)
      .eq('id', itemId)
      .single()

    if (checkError || !item) {
      return { success: false, error: 'ไม่พบ checklist item นี้' }
    }

    // @ts-ignore - Supabase nested select
    if (item.event.user_id !== user.id) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ลบ item นี้' }
    }

    const { error: deleteError } = await supabase
      .from('event_checklist_items')
      .delete()
      .eq('id', itemId)

    if (deleteError) {
      console.error('Error deleting checklist item:', deleteError)
      return { success: false, error: 'ไม่สามารถลบ checklist item ได้' }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error in deleteChecklistItem:', error)
    return { success: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' }
  }
}

/**
 * ดึงข้อมูล Event พร้อม Checklist Items
 */
export async function getEventWithChecklist(
  eventId: string
): Promise<{ event?: Event; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }
    }

    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select(`
        *,
        checklist_items:event_checklist_items(*)
      `)
      .eq('id', eventId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      console.error('Error fetching event:', fetchError)
      return { error: 'ไม่พบ event นี้' }
    }

    return { event }
  } catch (error) {
    console.error('Unexpected error in getEventWithChecklist:', error)
    return { error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' }
  }
}
