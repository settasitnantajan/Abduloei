export interface Note {
  id: string
  user_id: string
  title: string
  content?: string
  category?: string
  source_message?: string
  created_at: string
  updated_at: string
}

export interface CreateNoteInput {
  title: string
  content?: string
  category?: string
  source_message?: string
}

export interface UpdateNoteInput {
  title?: string
  content?: string
  category?: string
}
