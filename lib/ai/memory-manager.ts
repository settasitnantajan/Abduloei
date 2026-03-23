// DB operations moved to lib/db/memories.ts
// This file kept for backward compatibility - delegates to lib/db/memories
import { createClient } from '@/lib/supabase/server';
import { type Memory } from './memory-utils';

// Cannot re-export types from 'use server' files
// Import Memory directly from './memory-utils' where needed

/**
 * Extract memories from conversation using AI analysis
 * ตัวอย่าง: "ชื่อแม่ผมคือสมหญิง" → {category: 'family', key: 'mother_name', value: 'สมหญิง'}
 */
export async function extractMemoriesFromText(
  text: string,
  userId: string,
  messageId?: string
): Promise<Memory[]> {
  const memories: Partial<Memory>[] = [];

  // Simple keyword-based extraction (ในอนาคตอาจใช้ AI ขั้นสูง)

  // Pattern 1: Family members
  const familyPatterns = [
    /(?:ชื่อ)?(?:แม่|พ่อ|พี่|น้อง|ลูก|สามี|ภรรยา|ปู่|ย่า|ตา|ยาย)(?:ผม|ดิฉัน|ของผม|ของฉัน|ชื่อ)?(?:คือ|ชื่อ|ว่า)\s*([ก-๙a-zA-Z]+)/gi,
  ];

  for (const pattern of familyPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const relation = match[0].match(/แม่|พ่อ|พี่|น้อง|ลูก|สามี|ภรรยา|ปู่|ย่า|ตา|ยาย/)?.[0] || '';
      const name = match[1];

      memories.push({
        user_id: userId,
        category: 'family',
        key: `${relation}_name`,
        value: name,
        confidence: 0.9,
        source_message_id: messageId,
      });
    }
  }

  // Pattern 2: Preferences (ชอบ/ไม่ชอบ)
  const likePattern = /(?:ชอบ|ชื่นชอบ|รัก)([^แต่และ]+?)(?=\.|$|ครับ|ค่ะ|นะ)/gi;
  const dislikePattern = /(?:ไม่ชอบ|เกลียด|รังเกียจ)([^และ]+?)(?=\.|$|ครับ|ค่ะ|นะ)/gi;

  const likes = text.matchAll(likePattern);
  for (const match of likes) {
    const item = match[1].trim();
    if (item.length > 2 && item.length < 100) {
      memories.push({
        user_id: userId,
        category: 'preferences',
        key: `likes_${item.substring(0, 20).replace(/\s/g, '_')}`,
        value: item,
        confidence: 0.85,
        source_message_id: messageId,
      });
    }
  }

  const dislikes = text.matchAll(dislikePattern);
  for (const match of dislikes) {
    const item = match[1].trim();
    if (item.length > 2 && item.length < 100) {
      memories.push({
        user_id: userId,
        category: 'preferences',
        key: `dislikes_${item.substring(0, 20).replace(/\s/g, '_')}`,
        value: `ไม่ชอบ${item}`,
        confidence: 0.85,
        source_message_id: messageId,
      });
    }
  }

  // Pattern 3: Habits (ทำ...ทุก...)
  const habitPattern = /(ทำ|ไป|เล่น|กิน)([^ทุก]+?)ทุก(วัน|เช้า|เย็น|สัปดาห์|เดือน|[ก-๙]+)/gi;
  const habits = text.matchAll(habitPattern);
  for (const match of habits) {
    const activity = match[2].trim();
    const frequency = match[3];
    if (activity.length > 2 && activity.length < 100) {
      memories.push({
        user_id: userId,
        category: 'habits',
        key: `routine_${activity.substring(0, 15).replace(/\s/g, '_')}`,
        value: `${activity} ทุก${frequency}`,
        confidence: 0.8,
        source_message_id: messageId,
      });
    }
  }

  // Pattern 4: Goals (เป้าหมาย/อยาก/ต้องการ)
  const goalPattern = /(?:เป้าหมาย|อยาก|ต้องการ|จะ|วางแผน)([^\.ครับค่ะนะ]+?)(?=\.|$|ครับ|ค่ะ|นะ)/gi;
  const goals = text.matchAll(goalPattern);
  for (const match of goals) {
    const goal = match[1].trim();
    if (goal.length > 5 && goal.length < 100 && !goal.includes('?')) {
      memories.push({
        user_id: userId,
        category: 'goals',
        key: `goal_${goal.substring(0, 15).replace(/\s/g, '_')}`,
        value: goal,
        confidence: 0.75,
        source_message_id: messageId,
      });
    }
  }

  // Pattern 5: Important dates (วันเกิด/วันครบรอบ)
  const datePattern = /(?:วันเกิด|ครบรอบ|วันสำคัญ)(?:ของ)?([^คือ]+?)(?:คือ|ตรงกับ|เป็น)\s*([0-9]{1,2}[\/\-][0-9]{1,2}|[ก-๙]+)/gi;
  const dates = text.matchAll(datePattern);
  for (const match of dates) {
    const person = match[1].trim();
    const date = match[2].trim();
    memories.push({
      user_id: userId,
      category: 'important_dates',
      key: `date_${person.substring(0, 15).replace(/\s/g, '_')}`,
      value: `${person}: ${date}`,
      confidence: 0.9,
      source_message_id: messageId,
    });
  }

  return memories as Memory[];
}

/**
 * Store memory in database (with ADD/UPDATE/DELETE logic)
 */
export async function storeMemory(
  userId: string,
  category: Memory['category'],
  key: string,
  value: string,
  confidence: number = 1.0,
  messageId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('user_memories')
      .upsert({
        user_id: userId,
        category,
        key,
        value,
        confidence,
        source_message_id: messageId,
      }, {
        onConflict: 'user_id,category,key',
      });

    if (error) {
      console.error('Error storing memory:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error storing memory:', error);
    return { success: false, error: 'เกิดข้อผิดพลาด' };
  }
}

/**
 * Retrieve memories from database
 */
export async function retrieveMemories(
  userId: string,
  category?: Memory['category'],
  minConfidence: number = 0.5
): Promise<{ memories: Memory[]; error?: string }> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .gte('confidence', minConfidence)
      .order('updated_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error retrieving memories:', error);
      return { memories: [], error: error.message };
    }

    return { memories: data || [] };
  } catch (error) {
    console.error('Unexpected error retrieving memories:', error);
    return { memories: [], error: 'เกิดข้อผิดพลาด' };
  }
}

/**
 * Update existing memory
 */
export async function updateMemory(
  memoryId: string,
  updates: Partial<Pick<Memory, 'value' | 'confidence' | 'metadata'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('user_memories')
      .update(updates)
      .eq('id', memoryId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'เกิดข้อผิดพลาด' };
  }
}

/**
 * Delete memory
 */
export async function deleteMemory(memoryId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('user_memories')
      .delete()
      .eq('id', memoryId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'เกิดข้อผิดพลาด' };
  }
}

// formatMemoriesForAI moved to memory-utils.ts (non-server-action file)
