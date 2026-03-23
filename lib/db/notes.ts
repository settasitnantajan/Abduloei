import { createClient } from '@/lib/supabase/server';
import { Note, CreateNoteInput, UpdateNoteInput } from '@/lib/types/notes';

export async function createNote(
  data: CreateNoteInput
): Promise<{ success: boolean; note?: Note; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: note, error } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        title: data.title,
        content: data.content,
        category: data.category,
        source_message: data.source_message,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating note:', error);
      return { success: false, error: 'ไม่สามารถสร้างบันทึกได้' };
    }

    return { success: true, note };
  } catch (error) {
    console.error('Unexpected error in createNote:', error);
    return { success: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

export async function getUserNotes(): Promise<{ notes?: Note[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notes:', error);
      return { error: 'ไม่สามารถดึงข้อมูลบันทึกได้' };
    }

    return { notes: notes || [] };
  } catch (error) {
    console.error('Unexpected error in getUserNotes:', error);
    return { error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

export async function updateNote(
  noteId: string,
  data: UpdateNoteInput
): Promise<{ success: boolean; note?: Note; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: note, error } = await supabase
      .from('notes')
      .update(data)
      .eq('id', noteId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating note:', error);
      return { success: false, error: 'ไม่สามารถอัปเดตบันทึกได้' };
    }

    return { success: true, note };
  } catch (error) {
    console.error('Unexpected error in updateNote:', error);
    return { success: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

export async function deleteAllNotes(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, count: 0, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: notes } = await supabase
      .from('notes')
      .select('id')
      .eq('user_id', user.id);

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting all notes:', error);
      return { success: false, count: 0, error: 'ไม่สามารถลบบันทึกได้' };
    }

    return { success: true, count: notes?.length || 0 };
  } catch (error) {
    console.error('Unexpected error in deleteAllNotes:', error);
    return { success: false, count: 0, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

export async function deleteNote(
  noteId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting note:', error);
      return { success: false, error: 'ไม่สามารถลบบันทึกได้' };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error in deleteNote:', error);
    return { success: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}
