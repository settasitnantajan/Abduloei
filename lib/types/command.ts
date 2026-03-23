/**
 * Command Types for Keyword-Based Parsing
 * Thai Language Command Parsing System
 */

export type CommandType = 'create_event' | 'create_task' | 'create_note' | 'delete_all' | 'edit_event'

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
  deleteFilter?: {
    date?: string
    type?: 'create_event' | 'create_task' | 'create_note'
    titleKeyword?: string
    all?: boolean
  }
  editTarget?: {
    titleKeyword?: string
    date?: string // วันที่เดิมของนัดที่จะแก้ไข (YYYY-MM-DD)
  }
  targetEventId?: string // ID ของ event ที่จะแก้ไข (ใส่ตอน confirm)
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
