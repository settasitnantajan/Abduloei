/**
 * Event Types for Event Management System
 * รองรับ events และ checklist items
 */

export interface Event {
  id: string
  user_id: string
  home_id?: string
  title: string
  description?: string
  event_date?: string // ISO date format: YYYY-MM-DD
  event_time?: string // 24-hour time format: HH:mm
  location?: string
  priority?: 'low' | 'medium' | 'high'
  status: string
  assigned_member_id?: string
  source_message?: string
  created_at: string
  updated_at: string
  checklist_items?: EventChecklistItem[]
}

export interface EventChecklistItem {
  id: string
  event_id: string
  title: string
  completed: boolean
  assignee?: string
  order_index: number
  created_at: string
  updated_at: string
}

export interface CreateEventInput {
  title: string
  description?: string
  event_date?: string
  event_time?: string
  location?: string
  priority?: 'low' | 'medium' | 'high'
  assigned_member_id?: string
  source_message?: string
  checklist_items?: Array<{
    title: string
    assignee?: string
  }>
}

export interface UpdateChecklistItemInput {
  completed?: boolean
  title?: string
  assignee?: string
}
