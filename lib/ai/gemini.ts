import { GoogleGenerativeAI } from '@google/generative-ai';

const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.0-flash-lite';

const SYSTEM_PROMPT = `คุณคือ "Abduloei" ผู้ช่วยอัจฉริยะในบ้านสำหรับครอบครัวไทย

ตัวตนของคุณ:
- คุณเหมือน "พี่คนสนิท" ที่อยู่ในบ้าน — ไม่ใช่ AI, ไม่ใช่ผู้ช่วยทางการ
- พูดเหมือนคนไทยคุยกันจริงๆ ใน LINE หรือ Messenger ไม่ต้องเป็นทางการ
- ใช้ภาษาพูดตามธรรมชาติ ไม่ต้องสมบูรณ์แบบ เช่น "อืม", "เนอะ", "นะ", "ป่ะ", "อ่ะ"
- ถ้าเขาพิมพ์สั้นๆ ก็ตอบสั้นๆ ถ้าเขาพิมพ์ยาว ค่อยตอบยาว — match น้ำเสียงของเขา
- จำการสนทนาที่ผ่านมาได้ และอ้างอิงเมื่อเหมาะสม

ห้ามทำสิ่งเหล่านี้:
- ห้ามตอบแบบ template ซ้ำๆ (เช่น "สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?" ทุกครั้ง)
- ห้ามขึ้นต้นว่า "แน่นอนค่ะ!", "ยินดีค่ะ!", "ได้เลยค่ะ!" ทุกข้อความ — มันฟังดูเป็น robot
- ห้ามใช้ bullet points หรือ numbered list เกินจำเป็น — คนไทยไม่คุยกันแบบนั้น
- ห้ามตอบยาวเกินเหตุ ถ้าตอบได้ใน 1 ประโยคก็จบ
- ห้ามใช้ emoji เกิน 1-2 ตัวต่อข้อความ

การตอบอารมณ์ (สำคัญที่สุด):
- เครียด/กังวล → รับฟังก่อน ไม่รีบแนะนำ พูดเหมือนคนคุย เช่น "เอ้อ หนักเลยเนอะ", "เข้าใจเลยนะ ช่วงนี้มันเยอะจริงๆ"
- ดีใจ → ร่วมยินดีแบบจริงใจ เช่น "โห ดีจัง!", "เย้ ยินดีด้วยนะ"
- สับสน → ไม่ตัดสิน ค่อยๆ อธิบาย เช่น "ไม่เป็นไรนะ เดี๋ยวอธิบายให้ฟัง"
- เหนื่อย → "พักก่อนนะ ไม่ต้องรีบ"
- ถ้าพิมพ์ข้อความเดิมซ้ำ → ตอบมุมใหม่ อาจถามว่า "ยังกังวลอยู่เหรอ?" แทนที่จะ copy คำตอบเดิม

ตัวอย่างน้ำเสียงที่ถูกต้อง:
- "อ้อ พรุ่งนี้มีนัดหมอนะ อย่าลืมล่ะ"
- "เอาเลยๆ สร้างนัดให้แล้วนะ"
- "หนักเลยเนอะ ช่วงนี้ เล่าให้ฟังได้นะ"
- "อืม ลองแบบนี้ดูป่ะ..."
- "โอเคๆ จดไว้ให้แล้วนะ"

น้ำเสียงที่ผิด (ห้ามใช้):
- "สวัสดีค่ะ! ยินดีให้บริการค่ะ มีอะไรให้ช่วยเหลือไหมคะ?"
- "แน่นอนค่ะ! ดิฉันจะช่วยจัดการให้เรียบร้อยค่ะ"
- "ขอบคุณที่แจ้งให้ทราบค่ะ ดิฉันได้บันทึกข้อมูลเรียบร้อยแล้วค่ะ"

สิ่งที่คุณช่วยได้:
- ตอบคำถามทั่วไป ให้คำแนะนำเรื่องบ้านและชีวิต
- จัดการนัดหมาย งาน และบันทึกต่างๆ
- เตือนความจำ ช่วยวางแผนกิจกรรมครอบครัว
- รับฟังความรู้สึก ให้กำลังใจ ร่วมยินดี

วิธีตอบ:
- ตอบสั้นเท่าที่ตอบได้ เหมือนคนแชทกัน
- อ้างอิงการสนทนาที่ผ่านมาอย่างเป็นธรรมชาติ (เช่น "เมื่อกี้ที่บอกเรื่อง...อ่ะ")
- ถ้าเห็นว่ามีนัดหมายใกล้เข้ามา เตือนเบาๆ แทรกตามธรรมชาติ
- ถ้าต้องการข้อมูลมาก → แบ่งเป็นข้อ แต่ไม่เกิน 3-4 ข้อ`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Generate AI response with enhanced context and empathy
 * @param userMessage - Current user message
 * @param conversationHistory - Recent conversation history (up to 50 messages)
 * @param additionalContext - Extra context (events, tasks, memories)
 * @param emotionHint - Detected user emotion for empathetic response
 */
export async function generateAIResponse(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
  additionalContext?: string,
  emotionHint?: string
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Build conversation history — Gemini requires:
  // 1. History must start with 'user' role
  // 2. Roles must alternate (no consecutive same role)
  // 3. No empty content
  const rawHistory = conversationHistory
    .filter((msg) => msg.content && msg.content.trim().length > 0)
    .map((msg) => ({
      role: (msg.role === 'user' ? 'user' : 'model') as 'user' | 'model',
      parts: [{ text: msg.content }],
    }));

  // Merge consecutive same-role messages and ensure alternating pattern
  const history: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const entry of rawHistory) {
    const last = history[history.length - 1];
    if (last && last.role === entry.role) {
      last.parts[0].text += '\n' + entry.parts[0].text;
    } else {
      history.push(entry);
    }
  }

  // Gemini requires history to start with 'user' — drop leading 'model' entries
  while (history.length > 0 && history[0].role === 'model') {
    history.shift();
  }

  // Gemini requires history to end with 'model' — drop trailing entry if it's 'user'
  while (history.length > 0 && history[history.length - 1].role === 'user') {
    history.pop();
  }

  // Build context-aware prompt
  let fullPrompt = SYSTEM_PROMPT;

  if (additionalContext && additionalContext.trim().length > 0) {
    fullPrompt += `\n\n=== ข้อมูลบริบทเพิ่มเติม ===\n${additionalContext}\n`;
  }

  if (emotionHint && emotionHint.trim().length > 0) {
    const emotionMap: Record<string, string> = {
      stressed: '⚠️ ผู้ใช้กำลังเครียดและกังวลมาก — ตอบด้วยความอบอุ่น เข้าใจ และให้กำลังใจอย่างจริงใจ อย่าตอบแบบสูตรสำเร็จ',
      happy: '🎉 ผู้ใช้กำลังมีความสุขและดีใจ — ร่วมยินดีอย่างจริงใจ แสดงความตื่นเต้นด้วย',
      confused: '🤔 ผู้ใช้กำลังสับสนงง — ค่อยๆ อธิบายอย่างใจเย็น ไม่ตัดสิน',
      seeking_advice: '💭 ผู้ใช้กำลังขอคำแนะนำ — ฟังให้เข้าใจแล้วให้คำตอบที่เจาะจง',
    };
    const emotionInstruction = emotionMap[emotionHint] || `💡 อารมณ์ผู้ใช้: ${emotionHint}`;
    fullPrompt += `\n${emotionInstruction}\n`;
  }

  fullPrompt += `\n\nUser: ${userMessage}`;

  // Try primary model first, fallback on rate limit (429)
  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL];

  for (const modelName of modelsToTry) {
    // Retry up to 2 times per model (for short rate-limit windows)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const chat = model.startChat({
          history,
          generationConfig: {
            maxOutputTokens: 1500,
            temperature: 1.0,
          },
        });

        const result = await chat.sendMessage(fullPrompt);
        const response = await result.response;
        const text = response.text();

        return text || 'ขอโทษครับ ผมไม่สามารถตอบคำถามนี้ได้ในขณะนี้';
      } catch (error: any) {
        const status = error?.status ?? error?.httpStatusCode ?? error?.code;
        const errMsg = String(error?.message || '');
        const isRateLimit = status === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
        const isModelNotFound = status === 404 || errMsg.includes('not found') || errMsg.includes('NOT_FOUND');

        // ถ้า rate limit per minute → รอ 6 วินาทีแล้วลอง retry (attempt 0 → retry, attempt 1 → fallback)
        if (isRateLimit && attempt === 0 && errMsg.includes('retry')) {
          console.warn(`Rate limited on ${modelName}, retrying in 6s...`);
          await new Promise(resolve => setTimeout(resolve, 6000));
          continue;
        }

        // ถ้า rate limit หรือ model ไม่มี และยังมี model สำรอง → ลอง model ถัดไป
        if ((isRateLimit || isModelNotFound) && modelName !== FALLBACK_MODEL) {
          console.warn(`Error on ${modelName} (${isRateLimit ? 'rate limit' : 'not found'}), falling back to ${FALLBACK_MODEL}`);
          break; // break inner loop → next model
        }

        console.error(`Gemini API error (${modelName}):`, error);
        throw new Error('ไม่สามารถเชื่อมต่อกับ AI ได้ กรุณาลองใหม่อีกครั้ง');
      }
    }
  }

  throw new Error('ไม่สามารถเชื่อมต่อกับ AI ได้ กรุณาลองใหม่อีกครั้ง');
}

export function parseAICommands(content: string): {
  hasCommand: boolean;
  commandType?: 'event' | 'task' | 'note';
  extractedData?: Record<string, unknown>;
} {
  // TODO: Implement command parsing in future
  // This will detect if AI wants to create events/tasks/notes
  return {
    hasCommand: false,
  };
}
