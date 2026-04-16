import { createClient } from '@/lib/supabase/server';

export interface Routine {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  routine_time: string;       // HH:mm
  days_of_week: number[];     // 0=อาทิตย์ ... 6=เสาร์
  remind_before_minutes: number;
  is_active: boolean;
  source_message?: string;
  last_reminded_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRoutineInput {
  title: string;
  description?: string;
  routine_time: string;
  days_of_week?: number[];
  remind_before_minutes?: number;
  source_message?: string;
}

export async function createRoutine(
  data: CreateRoutineInput
): Promise<{ success: boolean; routine?: Routine; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: routine, error } = await supabase
      .from('routines')
      .insert({
        user_id: user.id,
        title: data.title,
        description: data.description,
        routine_time: data.routine_time,
        days_of_week: data.days_of_week || [0, 1, 2, 3, 4, 5, 6],
        remind_before_minutes: data.remind_before_minutes ?? 10,
        source_message: data.source_message,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, routine: routine as Routine };
  } catch (err) {
    return { success: false, error: 'เกิดข้อผิดพลาดในการสร้างกิจวัตร' };
  }
}

export async function getUserRoutines(): Promise<{ routines: Routine[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { routines: [], error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data, error } = await supabase
      .from('routines')
      .select('*')
      .eq('user_id', user.id)
      .order('routine_time', { ascending: true });

    if (error) {
      return { routines: [], error: error.message };
    }

    return { routines: (data || []) as Routine[] };
  } catch {
    return { routines: [] };
  }
}

export async function updateRoutine(
  routineId: string,
  data: Partial<Pick<Routine, 'title' | 'description' | 'routine_time' | 'days_of_week' | 'remind_before_minutes'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };

    const { error } = await supabase
      .from('routines')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', routineId)
      .eq('user_id', user.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: 'เกิดข้อผิดพลาดในการแก้ไขกิจวัตร' };
  }
}

export async function toggleRoutine(
  routineId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('routines')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', routineId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: 'เกิดข้อผิดพลาด' };
  }
}

export async function deleteRoutine(
  routineId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('routines')
      .delete()
      .eq('id', routineId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: 'เกิดข้อผิดพลาด' };
  }
}

export async function deleteAllRoutines(): Promise<{ success: boolean; count: number }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, count: 0 };

    const { data, error } = await supabase
      .from('routines')
      .delete()
      .eq('user_id', user.id)
      .select('id');

    if (error) return { success: false, count: 0 };
    return { success: true, count: data?.length || 0 };
  } catch {
    return { success: false, count: 0 };
  }
}
