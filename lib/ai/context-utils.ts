/**
 * Context utility functions (client-safe, synchronous)
 * These can be used in both server and client components
 */

import { AIContext } from './context-builder';

/**
 * แปลง context เป็น text prompt ที่ AI เข้าใจ
 */
export function contextToPrompt(context: AIContext): string {
  const parts: string[] = [];

  // Memories (ข้อมูลส่วนตัวที่จำไว้)
  if (context.memories) {
    parts.push(context.memories);
    parts.push('');
  }

  // Upcoming events
  if (context.upcomingEvents.length > 0) {
    parts.push('📅 นัดหมายที่กำลังจะมาถึง:');
    context.upcomingEvents.forEach(event => {
      const timeStr = event.time ? ` เวลา ${event.time} น.` : '';
      const daysStr = event.daysUntil === 0 ? 'วันนี้' : event.daysUntil === 1 ? 'พรุ่งนี้' : `อีก ${event.daysUntil} วัน`;
      parts.push(`- ${event.title} (${daysStr}${timeStr})`);
    });
    parts.push('');
  }

  // Pending tasks
  if (context.pendingTasks.length > 0) {
    parts.push('✓ งานที่รออยู่:');
    context.pendingTasks.slice(0, 5).forEach(task => {
      const priorityIcon = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
      parts.push(`${priorityIcon} ${task.title}`);
    });
    if (context.pendingTasks.length > 5) {
      parts.push(`... และอีก ${context.pendingTasks.length - 5} งาน`);
    }
    parts.push('');
  }

  // Conversation summary
  if (context.conversationSummary) {
    parts.push(`💬 ${context.conversationSummary}`);
    parts.push('');
  }

  return parts.length > 0 ? parts.join('\n') : '';
}

/**
 * วิเคราะห์อารมณ์จากข้อความของ User
 */
export function detectUserEmotion(message: string): {
  emotion: 'stressed' | 'happy' | 'confused' | 'seeking_advice' | 'neutral';
  confidence: number;
} {
  const lowerMessage = message.toLowerCase();

  // Helper: match keyword only when it's NOT embedded inside another word
  // For Thai text (no spaces between words), we check that the surrounding
  // characters don't form common compound words that create false positives.
  const falsePositiveCompounds = [
    'แต่งงาน', 'งานแต่ง', 'สนุกสุด', 'ที่สุด', 'สุดท้าย', 'สุดยอด',
    'เรื่องง่าย', 'อย่างไง', 'ทำไง',
  ];

  function matchKeyword(text: string, kw: string): boolean {
    if (!text.includes(kw)) return false;
    // Check if this keyword is part of a known compound that changes meaning
    if (kw.length <= 2) {
      // For very short keywords, check they're not inside a longer compound
      for (const compound of falsePositiveCompounds) {
        if (compound.includes(kw) && text.includes(compound)) {
          return false;
        }
      }
    }
    return true;
  }

  // Stressed/Anxious indicators
  const stressedKeywords = ['เครียด', 'กังวล', 'ไม่รู้จะทำยังไง', 'ช่วยด้วย', 'ยุ่ง', 'วุ่นวาย', 'ไม่ไหว', 'ท้อ'];
  if (stressedKeywords.some(kw => matchKeyword(lowerMessage, kw))) {
    return { emotion: 'stressed', confidence: 0.8 };
  }

  // Happy indicators (removed 'สุด' — too many false positives like 'ที่สุด', 'สุดท้าย')
  const happyKeywords = ['ดีใจ', 'สนุก', 'ยินดี', 'ชอบมาก', 'เยี่ยม', 'เจ๋ง', '555', 'ฮาๆ'];
  if (happyKeywords.some(kw => matchKeyword(lowerMessage, kw))) {
    return { emotion: 'happy', confidence: 0.8 };
  }

  // Confused indicators (removed 'งง' and 'ไง' — too many false positives like 'แต่งงาน')
  const confusedKeywords = ['งงมาก', 'งงเลย', 'รู้สึกงง', 'ไม่เข้าใจ', 'อธิบายให้', 'ทำไมถึง', 'ยังไงดี'];
  if (confusedKeywords.some(kw => matchKeyword(lowerMessage, kw))) {
    return { emotion: 'confused', confidence: 0.7 };
  }

  // Seeking advice indicators
  const adviceKeywords = ['แนะนำ', 'ควรจะ', 'ดีไหม', 'คิดว่ายังไง', 'ช่วยบอก', 'อยากรู้', 'มีวิธี'];
  if (adviceKeywords.some(kw => matchKeyword(lowerMessage, kw))) {
    return { emotion: 'seeking_advice', confidence: 0.75 };
  }

  return { emotion: 'neutral', confidence: 0.5 };
}

/**
 * สร้าง empathy prefix ตาม emotion
 */
export function getEmpatheticPrefix(emotion: 'stressed' | 'happy' | 'confused' | 'seeking_advice' | 'neutral'): string {
  switch (emotion) {
    case 'stressed':
      return 'เข้าใจเลยค่ะว่าตอนนี้รู้สึกเครียด ';
    case 'happy':
      return 'ดีใจด้วยนะคะ! ';
    case 'confused':
      return 'ให้ช่วยอธิบายให้เข้าใจง่ายๆ นะคะ ';
    case 'seeking_advice':
      return 'เข้าใจค่ะ ';
    default:
      return '';
  }
}
