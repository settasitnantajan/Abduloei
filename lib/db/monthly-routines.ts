import { createClient } from '@/lib/supabase/server';

export interface MonthlyRoutine {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  routine_time: string;
  day_of_month: number;
  remind_before_minutes: number;
  is_active: boolean;
  source_message?: string;
  last_reminded_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMonthlyRoutineInput {
  title: string;
  description?: string;
  routine_time: string;
  day_of_month: number;
  remind_before_minutes?: number;
  source_message?: string;
}

export async function createMonthlyRoutine(
  data: CreateMonthlyRoutineInput
): Promise<{ success: boolean; routine?: MonthlyRoutine; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: routine, error } = await supabase
      .from('monthly_routines')
      .insert({
        user_id: user.id,
        title: data.title,
        description: data.description,
        routine_time: data.routine_time,
        day_of_month: data.day_of_month,
        remind_before_minutes: data.remind_before_minutes ?? 10,
        source_message: data.source_message,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, routine: routine as MonthlyRoutine };
  } catch {
    return { success: false, error: 'เกิดข้อผิดพลาดในการสร้างกิจวัตรรายเดือน' };
  }
}

export async function getUserMonthlyRoutines(): Promise<{ routines: MonthlyRoutine[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { routines: [], error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data, error } = await supabase
      .from('monthly_routines')
      .select('*')
      .eq('user_id', user.id)
      .order('day_of_month', { ascending: true });

    if (error) {
      return { routines: [], error: error.message };
    }

    return { routines: (data || []) as MonthlyRoutine[] };
  } catch {
    return { routines: [] };
  }
}

export async function updateMonthlyRoutine(
  routineId: string,
  data: Partial<Pick<MonthlyRoutine, 'title' | 'description' | 'routine_time' | 'day_of_month' | 'remind_before_minutes'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };

    const { error } = await supabase
      .from('monthly_routines')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', routineId)
      .eq('user_id', user.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: 'เกิดข้อผิดพลาดในการแก้ไขกิจวัตรรายเดือน' };
  }
}

export async function deleteAllMonthlyRoutines(): Promise<{ success: boolean; count: number }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, count: 0 };

    const { data, error } = await supabase
      .from('monthly_routines')
      .delete()
      .eq('user_id', user.id)
      .select('id');

    if (error) return { success: false, count: 0 };
    return { success: true, count: data?.length || 0 };
  } catch {
    return { success: false, count: 0 };
  }
}

export async function toggleMonthlyRoutine(
  routineId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('monthly_routines')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', routineId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: 'เกิดข้อผิดพลาด' };
  }
}

export async function deleteMonthlyRoutine(
  routineId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('monthly_routines')
      .delete()
      .eq('id', routineId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: 'เกิดข้อผิดพลาด' };
  }
}
