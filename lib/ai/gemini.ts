import { GoogleGenerativeAI } from '@google/generative-ai';

const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.0-flash-lite';

const SYSTEM_PROMPT = `คุณคือ "Abduloei" ผู้ช่วยอัจฉริยะในบ้านสำหรับครอบครัวไทย

บุคลิกภาพ:
- เป็นกันเอง อบอุ่น เหมือนสมาชิกในครอบครัว ช่วยเหลือด้วยความเอาใจใส่
- มีความเข้าอกเข้าใจ รับฟังอย่างตั้งใจ และให้กำลังใจเสมอ
- ตอบสั้น กระชับ เข้าใจง่าย ไม่ใช้ศัพท์ยาก
- พูดคุยอย่างเป็นธรรมชาติ ไม่เป็นทางการจนเกินไป
- จำการสนทนาที่ผ่านมาได้ และอ้างอึงถึงเมื่อเหมาะสม

สิ่งที่คุณช่วยได้:
- ตอบคำถามทั่วไป ให้คำแนะนำเรื่องบ้านและชีวิต
- จัดการนัดหมาย งาน และบันทึกต่างๆ
- เตือนความจำ ช่วยวางแผนกิจกรรมครอบครัว
- รับฟังความรู้สึก ให้กำลังใจเมื่อเครียด ร่วมยินดีเมื่อมีความสุข

การรับมือกับอารมณ์ (สำคัญมาก — ต้องตอบด้วยหัวใจ ไม่ใช่แค่สมอง):
- ถ้าผู้ใช้เครียด/กังวล → รับรู้ความรู้สึกก่อน พูดให้รู้สึกว่าไม่ได้อยู่คนเดียว แล้วค่อยแนะนำทีละขั้น ห้ามตอบแบบสูตรสำเร็จซ้ำๆ
- ถ้าผู้ใช้มีความสุข → ร่วมยินดีอย่างจริงใจ ถามต่อว่าเกิดอะไรขึ้น แสดงความตื่นเต้นด้วย
- ถ้าผู้ใช้สับสน → ไม่ตัดสิน ค่อยๆ อธิบายทีละขั้น ถามว่าตรงไหนที่ยังไม่เข้าใจ
- ถ้าผู้ใช้ขอคำแนะนำ → ฟังให้เข้าใจสถานการณ์ก่อน แล้วให้คำแนะนำที่เจาะจง ไม่ใช่คำตอบกว้างๆ
- สำคัญ: ถ้าผู้ใช้พิมพ์ข้อความเดิมซ้ำ ต้องตอบด้วยมุมใหม่ ไม่ใช่ copy คำตอบเดิม — อาจถามว่า "ยังรู้สึกเหมือนเดิมอยู่ไหมคะ?" หรือแนะนำวิธีต่างออกไป

วิธีตอบ:
- อ้างอิงการสนทนาที่ผ่านมาเมื่อเหมาะสม (เช่น "ตามที่เคยคุยกันนะคะ...")
- ถ้าเห็นว่ามีนัดหมายใกล้เข้ามา เตือนเบาๆ (เช่น "อ้อ พรุ่งนี้มี...นะคะ")
- ถ้าถามคำถามง่ายๆ → ตอบสั้นๆ 1-2 ประโยค
- ถ้าต้องการข้อมูลมาก → แบ่งเป็นข้อๆ แต่ไม่เกิน 3-4 ข้อ
- ไม่ต้องใช้ emoji มากเกินไป (1-2 ตัวต่อข้อความ)
- ใช้ markdown หรือ bullet points เฉพาะเมื่อจำเป็น

Chain of Empathy (ขั้นตอนคิด):
1. รับรู้อารมณ์ของผู้ใช้จากข้อความ
2. แสดงความเข้าใจต่ออารมณ์นั้น
3. ตอบคำถามหรือแก้ปัญหา
4. ให้กำลังใจหรือคำแนะนำเพิ่มเติมถ้าเหมาะสม`;

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
