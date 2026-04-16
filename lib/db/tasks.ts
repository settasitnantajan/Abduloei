import { createClient } from '@/lib/supabase/server';
import { Task, CreateTaskInput, UpdateTaskInput } from '@/lib/types/tasks';

export async function createTask(
  data: CreateTaskInput
): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title: data.title,
        description: data.description,
        due_date: data.due_date,
        due_time: data.due_time,
        priority: data.priority || 'medium',
        status: 'pending',
        source_message: data.source_message,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return { success: false, error: 'ไม่สามารถสร้างงานได้' };
    }

    return { success: true, task };
  } catch (error) {
    console.error('Unexpected error in createTask:', error);
    return { success: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

export async function getUserTasks(): Promise<{ tasks?: Task[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      return { error: 'ไม่สามารถดึงข้อมูลงานได้' };
    }

    return { tasks: tasks || [] };
  } catch (error) {
    console.error('Unexpected error in getUserTasks:', error);
    return { error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

export async function updateTask(
  taskId: string,
  data: UpdateTaskInput
): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .update(data)
      .eq('id', taskId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating task:', error);
      return { success: false, error: 'ไม่สามารถอัปเดตงานได้' };
    }

    return { success: true, task };
  } catch (error) {
    console.error('Unexpected error in updateTask:', error);
    return { success: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

export async function deleteAllTasks(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, count: 0, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', user.id);

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting all tasks:', error);
      return { success: false, count: 0, error: 'ไม่สามารถลบงานได้' };
    }

    return { success: true, count: tasks?.length || 0 };
  } catch (error) {
    console.error('Unexpected error in deleteAllTasks:', error);
    return { success: false, count: 0, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

export async function deleteTask(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting task:', error);
      return { success: false, error: 'ไม่สามารถลบงานได้' };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error in deleteTask:', error);
    return { success: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}
