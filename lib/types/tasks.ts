export interface Task {
  id: string
  user_id: string
  title: string
  description?: string
  due_date?: string
  due_time?: string
  priority?: 'low' | 'medium' | 'high'
  status: 'pending' | 'completed' | 'cancelled'
  source_message?: string
  created_at: string
  updated_at: string
}

export interface CreateTaskInput {
  title: string
  description?: string
  due_date?: string
  due_time?: string
  priority?: 'low' | 'medium' | 'high'
  source_message?: string
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  due_date?: string
  due_time?: string
  priority?: 'low' | 'medium' | 'high'
  status?: 'pending' | 'completed' | 'cancelled'
}
