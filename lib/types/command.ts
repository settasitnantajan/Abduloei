/**
 * Command Types for Keyword-Based Parsing
 * Thai Language Command Parsing System
 */

export type CommandType =
  | 'create_event' | 'create_task' | 'create_note' | 'create_routine' | 'create_monthly_routine'
  | 'edit_event' | 'edit_task' | 'edit_note' | 'edit_routine' | 'edit_monthly_routine'
  | 'delete_all' | 'delete_event' | 'delete_task' | 'delete_note' | 'delete_routine' | 'delete_monthly_routine'

export type Priority = 'low' | 'medium' | 'high'

export interface ChecklistItemParsed {
  title: string
  assignee?: string
}

export interface ParsedCommand {
  type: CommandType
  title: string
  date?: string // ISO format: YYYY-MM-DD
  time?: string // 24-hour format: HH:mm
  description?: string
  priority?: Priority
  checklist_items?: ChecklistItemParsed[] // สำหรับ events ที่มี checklist
  // สำหรับ create_routine
  routine_time?: string        // HH:mm
  days_of_week?: number[]      // 0=อาทิตย์ ... 6=เสาร์
  remind_before_minutes?: number
  // สำหรับ create_monthly_routine
  day_of_month?: number        // 1-31 (32 = สิ้นเดือน)
  deleteFilter?: {
    date?: string
    type?: 'create_event' | 'create_task' | 'create_note' | 'create_routine'
    titleKeyword?: string
    all?: boolean
  }
  editTarget?: {
    titleKeyword?: string
    date?: string // วันที่เดิมของนัดที่จะแก้ไข (YYYY-MM-DD)
  }
  assigned_to?: string // ชื่อสมาชิกที่จะ assign
  assigned_member_id?: string // ID ของสมาชิก (resolved จาก assigned_to)
  targetEventId?: string // ID ของ event ที่จะแก้ไข (ใส่ตอน confirm)
  targetId?: string // ID ของรายการที่จะแก้ไข/ลบ (ใช้ร่วมกันทุกประเภท)
  raw: string // Original user message
}

export interface CommandMetadata {
  command?: ParsedCommand
  parsed: boolean
  executed: boolean
  executedAt?: string // ISO timestamp
  pending_confirmation?: boolean // รอ User ยืนยัน
  rejected?: boolean // User ปฏิเสธ
}

export interface ChatMessageWithCommand {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  metadata: CommandMetadata
  created_at: string
}

// Query results for "มีนัดอะไรบ้าง"
export interface CommandQueryResult {
  type: CommandType
  title: string
  date?: string
  time?: string
  executed: boolean
  createdAt: string
}
