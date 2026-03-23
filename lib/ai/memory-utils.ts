/**
 * Memory utility functions (client-safe, no server actions)
 */

export interface Memory {
  id: string;
  user_id: string;
  category: 'personal' | 'family' | 'preferences' | 'important_dates' | 'habits' | 'goals';
  key: string;
  value: string;
  confidence: number;
  source_message_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Format memories for AI context
 */
export function formatMemoriesForAI(memories: Memory[]): string {
  if (memories.length === 0) return '';

  const grouped = memories.reduce((acc, mem) => {
    if (!acc[mem.category]) acc[mem.category] = [];
    acc[mem.category].push(mem);
    return acc;
  }, {} as Record<string, Memory[]>);

  const categoryNames: Record<string, string> = {
    family: 'ครอบครัว',
    personal: 'ข้อมูลส่วนตัว',
    preferences: 'ความชอบ',
    habits: 'กิจวัตร',
    important_dates: 'วันสำคัญ',
    goals: 'เป้าหมาย',
  };

  let output = '=== ข้อมูลที่ระบบจำได้ ===\n';

  for (const [category, mems] of Object.entries(grouped)) {
    output += `\n${categoryNames[category] || category}:\n`;
    for (const mem of mems) {
      output += `- ${mem.key.replace(/_/g, ' ')}: ${mem.value}\n`;
    }
  }

  return output;
}
